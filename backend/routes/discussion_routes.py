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


def normalize_role(role: str) -> str:
    return (role or "").strip().lower()


@router.get("/cases/{case_id}/messages", response_model=DiscussionListResponse)
async def get_case_messages(
    case_id: str,
    request: Request,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    service = DiscussionService(get_db(request))
    case = await service.ensure_case_member(case_id, current_user["userId"])
    if not case:
        raise HTTPException(status_code=403, detail="Only case members can access discussion")

    messages = await service.list_case_messages(case_id=case_id, skip=skip, limit=limit)
    return {
        "messages": messages,
        "pagination": {"skip": skip, "limit": limit, "count": len(messages)},
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

    messages = await service.list_case_messages(message["case_id"], skip=0, limit=200)
    updated = next((m for m in messages if m["id"] == message_id), None)
    return {"message": "Reaction updated", "reactions": (updated or {}).get("reactions", [])}


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

    role = "clinician" if current_user["userId"] == case.get("created_by_clinician_id") else "member"
    if role != "clinician":
        raise HTTPException(status_code=403, detail="Only clinician can delete messages")

    await service.soft_delete_message(message_id)
    return {"message": "Message deleted"}


@router.get("/cases/{case_id}/discussion-events")
async def get_discussion_events(
    case_id: str,
    request: Request,
    since: str = Query(default=""),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    service = DiscussionService(get_db(request))
    case = await service.ensure_case_member(case_id, current_user["userId"])
    if not case:
        raise HTTPException(status_code=403, detail="Only case members can access discussion")

    skip = 0
    if since:
        try:
            payload = json.loads(since)
            skip = int(payload.get("count", 0))
        except Exception:
            skip = 0

    messages = await service.list_case_messages(case_id=case_id, skip=max(skip - 20, 0), limit=200)
    return {"messages": messages, "cursor": json.dumps({"count": len(messages)})}
