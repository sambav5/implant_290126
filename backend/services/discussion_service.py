from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid


ALLOWED_REACTIONS = {"👍", "👀", "✔️", "🦷"}


class DiscussionService:
    def __init__(self, db):
        self.db = db
        self.cases = db.cases
        self.messages = db.discussion_messages
        self.reactions = db.message_reactions
        self.users = db.users
        self.team_members = db.team_members

    async def ensure_case_member(self, case_id: str, user_id: str) -> Dict[str, Any]:
        case = await self.cases.find_one({"id": case_id}, {"_id": 0})
        if not case:
            print(f"[DEBUG] Case {case_id} not found")
            return None
        
        print(f"[DEBUG] Checking access for user {user_id} to case {case_id}")
        print(f"[DEBUG] Case has caseTeam: {'caseTeam' in case}")
        print(f"[DEBUG] Case has created_by_clinician_id: {'created_by_clinician_id' in case}")
        
        # Support BOTH old and new case structures
        members = set()
        
        # New structure: Uses ID fields
        if "created_by_clinician_id" in case:
            print(f"[DEBUG] Using NEW structure")
            members.add(case.get("created_by_clinician_id"))
            if case.get("assigned_implantologist_id"):
                members.add(case.get("assigned_implantologist_id"))
            if case.get("assigned_prosthodontist_id"):
                members.add(case.get("assigned_prosthodontist_id"))
            if case.get("assigned_assistant_id"):
                members.add(case.get("assigned_assistant_id"))
            print(f"[DEBUG] Members: {members}")
        
        # Old structure: caseTeam with names - anyone with valid auth can access
        # (old structure doesn't have user IDs, so we allow authenticated users)
        elif "caseTeam" in case:
            # For old structure, allow any authenticated user
            # This is a temporary workaround until all cases migrate to new structure
            print(f"[DEBUG] Using OLD structure - allowing access")
            return case
        
        # Remove None/empty values
        members.discard(None)
        members.discard("")
        
        if user_id not in members:
            # If user is not in members but case uses old structure, allow access
            if "caseTeam" in case and "created_by_clinician_id" not in case:
                print(f"[DEBUG] Fallback: OLD structure detected - allowing access")
                return case
            print(f"[DEBUG] Access DENIED - user not in members")
            return None
        
        print(f"[DEBUG] Access GRANTED - user in members")
        return case

    async def resolve_sender_profile(self, case: Dict[str, Any], user_id: str) -> Dict[str, str]:
        # Handle new structure with user IDs
        if user_id == case.get("created_by_clinician_id"):
            user = await self.users.find_one({"id": user_id}, {"_id": 0})
            return {
                "sender_name": (user or {}).get("name", "Clinician"),
                "sender_role": "clinician",
            }

        member = await self.team_members.find_one({"id": user_id}, {"_id": 0})
        if member:
            role = (member or {}).get("role", "assistant").lower()
            role_map = {
                "prosthodontist": "prostho",
            }
            normalized_role = role_map.get(role, role)
            return {
                "sender_name": (member or {}).get("name", "Team Member"),
                "sender_role": normalized_role,
            }
        
        # Handle old structure without user IDs - use authenticated user data
        user = await self.users.find_one({"id": user_id}, {"_id": 0})
        if user:
            return {
                "sender_name": user.get("name", "User"),
                "sender_role": user.get("role", "clinician").lower(),
            }
        
        # Fallback
        return {
            "sender_name": "Team Member",
            "sender_role": "clinician",
        }

    async def get_user_role(self, case: Dict[str, Any], user_id: str) -> Optional[str]:
        """
        Get the actual role of a user in the context of a case.
        Returns 'Clinician' for case creator or team members with Clinician role.
        Returns None if user is not part of the case.
        """
        # Check if user is the clinician who created the case
        if user_id == case.get("created_by_clinician_id"):
            return "Clinician"
        
        # Check if user is a team member and get their role
        member = await self.team_members.find_one({"id": user_id}, {"_id": 0})
        if member:
            return member.get("role")  # Returns "Clinician", "Implantologist", etc.
        
        return None

    async def list_case_messages(
        self, 
        case_id: str, 
        limit: int = 50, 
        before_cursor: str = ""
    ) -> tuple[List[Dict[str, Any]], bool]:
        """
        List case messages with cursor-based pagination.
        
        Returns tuple of (messages, has_more)
        - messages: List of enriched messages (newest first)
        - has_more: Boolean indicating if there are more messages to fetch
        """
        # Build query filter
        query_filter = {"case_id": case_id}
        
        # If before_cursor is provided, only fetch messages before that timestamp
        if before_cursor:
            try:
                from dateutil import parser
                cursor_dt = parser.isoparse(before_cursor)
                query_filter["created_at"] = {"$lt": cursor_dt}
            except (ValueError, TypeError):
                pass  # Invalid cursor, ignore it
        
        # Fetch limit+1 to check if there are more messages
        cursor = self.messages.find(
            query_filter,
            {"_id": 0},
        ).sort("created_at", -1).limit(limit + 1)  # -1 for descending (newest first)
        
        messages = await cursor.to_list(length=limit + 1)
        
        # Check if there are more messages
        has_more = len(messages) > limit
        if has_more:
            messages = messages[:limit]  # Remove the extra message
        
        if not messages:
            return [], False

        # Reverse to show oldest first in the UI
        messages.reverse()

        message_ids = [m["id"] for m in messages]
        all_reactions = await self.reactions.find(
            {"message_id": {"$in": message_ids}}, 
            {"_id": 0}
        ).to_list(length=2000)
        
        reaction_map: Dict[str, Dict[str, Any]] = {}
        for reaction in all_reactions:
            msg_id = reaction["message_id"]
            bucket = reaction_map.setdefault(msg_id, {})
            icon = reaction["reaction_type"]
            item = bucket.setdefault(icon, {"reactionType": icon, "count": 0, "userIds": []})
            item["count"] += 1
            item["userIds"].append(reaction["user_id"])

        reply_counts: Dict[str, int] = {}
        for message in messages:
            parent = message.get("parent_message_id")
            if parent:
                reply_counts[parent] = reply_counts.get(parent, 0) + 1

        enriched = []
        for message in messages:
            enriched.append({
                **message,
                "reactions": list(reaction_map.get(message["id"], {}).values()),
                "reply_count": reply_counts.get(message["id"], 0),
            })
        return enriched, has_more

    async def list_case_messages_after(
        self,
        case_id: str,
        after_cursor: str = ""
    ) -> tuple[List[Dict[str, Any]], bool]:
        """
        List messages created AFTER a given timestamp (for incremental/polling updates).
        
        Returns tuple of (messages, has_more)
        - messages: List of new messages (oldest first)
        - has_more: Always False for this method (fetches all new messages)
        """
        query_filter = {"case_id": case_id}
        
        # If after_cursor is provided, only fetch messages after that timestamp
        if after_cursor:
            try:
                from dateutil import parser
                cursor_dt = parser.isoparse(after_cursor)
                query_filter["created_at"] = {"$gt": cursor_dt}
            except (ValueError, TypeError):
                pass  # Invalid cursor, ignore it
        
        # Fetch all new messages (ascending order - oldest first)
        cursor = self.messages.find(
            query_filter,
            {"_id": 0},
        ).sort("created_at", 1).limit(200)  # Limit to prevent abuse
        
        messages = await cursor.to_list(length=200)
        
        if not messages:
            return [], False

        message_ids = [m["id"] for m in messages]
        all_reactions = await self.reactions.find(
            {"message_id": {"$in": message_ids}},
            {"_id": 0}
        ).to_list(length=2000)
        
        reaction_map: Dict[str, Dict[str, Any]] = {}
        for reaction in all_reactions:
            msg_id = reaction["message_id"]
            bucket = reaction_map.setdefault(msg_id, {})
            icon = reaction["reaction_type"]
            item = bucket.setdefault(icon, {"reactionType": icon, "count": 0, "userIds": []})
            item["count"] += 1
            item["userIds"].append(reaction["user_id"])

        reply_counts: Dict[str, int] = {}
        for message in messages:
            parent = message.get("parent_message_id")
            if parent:
                reply_counts[parent] = reply_counts.get(parent, 0) + 1

        enriched = []
        for message in messages:
            enriched.append({
                **message,
                "reactions": list(reaction_map.get(message["id"], {}).values()),
                "reply_count": reply_counts.get(message["id"], 0),
            })
        return enriched, False

    async def create_message(
        self,
        case_id: str,
        sender_id: str,
        message: str,
        mentions: Optional[List[str]] = None,
        parent_message_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        case = await self.cases.find_one({"id": case_id}, {"_id": 0})
        sender = await self.resolve_sender_profile(case, sender_id)
        payload = {
            "id": str(uuid.uuid4()),
            "case_id": case_id,
            "sender_id": sender_id,
            "sender_name": sender["sender_name"],
            "sender_role": sender["sender_role"],
            "message": message.strip(),
            "mentions": mentions or [],
            "parent_message_id": parent_message_id,
            "created_at": datetime.now(timezone.utc),
            "deleted": False,
        }
        await self.messages.insert_one(payload)
        return {**payload, "reactions": [], "reply_count": 0}

    async def toggle_reaction(self, message_id: str, user_id: str, reaction_type: str):
        if reaction_type not in ALLOWED_REACTIONS:
            raise ValueError("Unsupported reaction")
        existing = await self.reactions.find_one({
            "message_id": message_id,
            "user_id": user_id,
            "reaction_type": reaction_type,
        })
        if existing:
            await self.reactions.delete_one({"id": existing["id"]})
        else:
            await self.reactions.insert_one({
                "id": str(uuid.uuid4()),
                "message_id": message_id,
                "user_id": user_id,
                "reaction_type": reaction_type,
                "created_at": datetime.now(timezone.utc),
            })

    async def soft_delete_message(self, message_id: str):
        await self.messages.update_one(
            {"id": message_id},
            {"$set": {"deleted": True, "message": "This message was deleted"}},
        )

    async def get_message(self, message_id: str):
        return await self.messages.find_one({"id": message_id}, {"_id": 0})

    async def get_message_reactions(self, message_id: str) -> List[Dict[str, Any]]:
        """Get reactions for a specific message."""
        all_reactions = await self.reactions.find(
            {"message_id": message_id},
            {"_id": 0}
        ).to_list(length=100)
        
        reaction_map: Dict[str, Dict[str, Any]] = {}
        for reaction in all_reactions:
            icon = reaction["reaction_type"]
            item = reaction_map.setdefault(icon, {"reactionType": icon, "count": 0, "userIds": []})
            item["count"] += 1
            item["userIds"].append(reaction["user_id"])
        
        return list(reaction_map.values())

    async def ensure_indexes(self):
        await self.messages.create_index("id", unique=True)
        await self.messages.create_index([("case_id", 1), ("created_at", 1)])
        await self.messages.create_index("parent_message_id")
        await self.reactions.create_index("id", unique=True)
        await self.reactions.create_index([("message_id", 1), ("reaction_type", 1)])
        await self.reactions.create_index([("message_id", 1), ("user_id", 1), ("reaction_type", 1)], unique=True)
