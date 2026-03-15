import json
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from auth.security import get_current_user
from schemas.discussion_schema import (
    AddReactionRequest,
    DiscussionListResponse,
    SendMessageRequest,
)
from services.discussion_service import DiscussionService

router = APIRouter(tags=["Discussion"])


def get_db(request: Request):
    return request.app.state.db


@router.get("/cases/{case_id}/messages", response_model=DiscussionListResponse)
async def get_case_messages(
    case_id: str,
    request: Request,
    limit: int = Query(default=50, ge=1, le=100),
    before: str = Query(default="", description="Fetch messages before this timestamp (ISO format)"),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Get case messages with cursor-based pagination.
    
    - limit: Number of messages to fetch (max 100)
    - before: ISO timestamp cursor for pagination (fetch messages before this time)
    - Returns messages in descending order (newest first) for efficient loading
    """
    service = DiscussionService(get_db(request))
    case = await service.ensure_case_member(case_id, current_user["userId"])
    if not case:
        raise HTTPException(status_code=403, detail="Only case members can access discussion")

    messages, has_more = await service.list_case_messages(
        case_id=case_id, 
        limit=limit, 
        before_cursor=before
    )
    
    # Compute next cursor (timestamp of oldest message in result)
    next_cursor = messages[-1]["created_at"].isoformat() if messages and has_more else None
    
    return {
        "messages": messages,
        "pagination": {
            "limit": limit,
            "count": len(messages),
            "has_more": has_more,
            "next_cursor": next_cursor
        },
    }


@router.post("/cases/{case_id}/messages", status_code=status.HTTP_201_CREATED)
async def send_message(
    case_id: str,
    payload: SendMessageRequest,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    service = DiscussionService(get_db(request))
    case = await service.ensure_case_member(case_id, current_user["userId"])
    if not case:
        raise HTTPException(status_code=403, detail="Only case members can post messages")

    message = await service.create_message(
        case_id=case_id,
        sender_id=current_user["userId"],
        message=payload.message,
        mentions=payload.mentions,
        parent_message_id=payload.parent_message_id,
    )
    return message


@router.post("/messages/{message_id}/reaction")
async def add_reaction(
    message_id: str,
    payload: AddReactionRequest,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    service = DiscussionService(get_db(request))
    message = await service.get_message(message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    case = await service.ensure_case_member(message["case_id"], current_user["userId"])
    if not case:
        raise HTTPException(status_code=403, detail="Only case members can react")

    try:
        await service.toggle_reaction(message_id, current_user["userId"], payload.reaction_type)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Return updated reactions for this specific message only
    updated_reactions = await service.get_message_reactions(message_id)
    return {"message": "Reaction updated", "reactions": updated_reactions}


@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: str,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    service = DiscussionService(get_db(request))
    message = await service.get_message(message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    case = await service.ensure_case_member(message["case_id"], current_user["userId"])
    if not case:
        raise HTTPException(status_code=403, detail="Only case members can delete")

    # SECURITY FIX: Check actual user role from database
    user_role = await service.get_user_role(case, current_user["userId"])
    if user_role != "Clinician":
        raise HTTPException(status_code=403, detail="Only Clinician role can delete messages")

    await service.soft_delete_message(message_id)
    return {"message": "Message deleted"}


@router.get("/cases/{case_id}/discussion-events")
async def get_discussion_events(
    case_id: str,
    request: Request,
    since: str = Query(default="", description="ISO timestamp - fetch messages after this time"),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Get new discussion messages since a given timestamp (for polling/incremental updates).
    
    - since: ISO timestamp of the last message the client has
    - Returns only messages created after the 'since' timestamp
    """
    service = DiscussionService(get_db(request))
    case = await service.ensure_case_member(case_id, current_user["userId"])
    if not case:
        raise HTTPException(status_code=403, detail="Only case members can access discussion")

    messages, _ = await service.list_case_messages_after(case_id=case_id, after_cursor=since)
    
    # Return the timestamp of the latest message as the new cursor
    latest_cursor = messages[-1]["created_at"].isoformat() if messages else since
    
    return {
        "messages": messages,
        "cursor": latest_cursor
    }
