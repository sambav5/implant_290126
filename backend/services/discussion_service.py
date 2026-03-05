from datetime import datetime
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
            return None
        members = {
            case.get("created_by_clinician_id"),
            case.get("assigned_implantologist_id"),
            case.get("assigned_prosthodontist_id"),
            case.get("assigned_assistant_id"),
        }
        if user_id not in members:
            return None
        return case

    async def resolve_sender_profile(self, case: Dict[str, Any], user_id: str) -> Dict[str, str]:
        if user_id == case.get("created_by_clinician_id"):
            user = await self.users.find_one({"id": user_id}, {"_id": 0})
            return {
                "sender_name": (user or {}).get("name", "Clinician"),
                "sender_role": "clinician",
            }

        member = await self.team_members.find_one({"id": user_id}, {"_id": 0})
        role = (member or {}).get("role", "assistant").lower()
        role_map = {
            "prosthodontist": "prostho",
        }
        normalized_role = role_map.get(role, role)
        return {
            "sender_name": (member or {}).get("name", "Team Member"),
            "sender_role": normalized_role,
        }

    async def list_case_messages(self, case_id: str, skip: int = 0, limit: int = 50) -> List[Dict[str, Any]]:
        cursor = self.messages.find(
            {"case_id": case_id},
            {"_id": 0},
        ).sort("created_at", 1).skip(skip).limit(limit)
        messages = await cursor.to_list(length=limit)
        if not messages:
            return []

        message_ids = [m["id"] for m in messages]
        all_reactions = await self.reactions.find({"message_id": {"$in": message_ids}}, {"_id": 0}).to_list(length=2000)
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
        return enriched

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
            "created_at": datetime.utcnow(),
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
                "created_at": datetime.utcnow(),
            })

    async def soft_delete_message(self, message_id: str):
        await self.messages.update_one(
            {"id": message_id},
            {"$set": {"deleted": True, "message": "This message was deleted"}},
        )

    async def get_message(self, message_id: str):
        return await self.messages.find_one({"id": message_id}, {"_id": 0})

    async def ensure_indexes(self):
        await self.messages.create_index("id", unique=True)
        await self.messages.create_index([("case_id", 1), ("created_at", 1)])
        await self.messages.create_index("parent_message_id")
        await self.reactions.create_index("id", unique=True)
        await self.reactions.create_index([("message_id", 1), ("reaction_type", 1)])
        await self.reactions.create_index([("message_id", 1), ("user_id", 1), ("reaction_type", 1)], unique=True)
