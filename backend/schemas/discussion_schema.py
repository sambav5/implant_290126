from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class SendMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    mentions: List[str] = Field(default_factory=list)
    parent_message_id: Optional[str] = None


class AddReactionRequest(BaseModel):
    reaction_type: str


class ReactionSummary(BaseModel):
    reactionType: str
    count: int
    userIds: List[str]


class DiscussionMessageResponse(BaseModel):
    id: str
    case_id: str
    sender_id: str
    sender_name: str
    sender_role: str
    message: str
    mentions: List[str]
    parent_message_id: Optional[str]
    created_at: datetime
    deleted: bool
    reactions: List[ReactionSummary] = Field(default_factory=list)
    reply_count: int = 0


class DiscussionListResponse(BaseModel):
    messages: List[DiscussionMessageResponse]
    pagination: dict
