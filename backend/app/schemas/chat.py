from typing import Optional, List, Any
from datetime import datetime
from pydantic import BaseModel, Field

class Citation(BaseModel):
    id: Optional[str] = None
    document_id: str
    document_title: str
    page_number: Optional[int] = None
    quote: str
    verified: bool = False
    start_offset: Optional[int] = None
    end_offset: Optional[int] = None
    confidence: float = 0.0
    verification_note: Optional[str] = None
    bbox: Optional[Any] = None

class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    citations: List[Citation] = []
    is_interrupted: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}

class ConversationResponse(BaseModel):
    id: str
    title: str
    document_id: Optional[str] = None
    document_ids: List[str] = []
    created_at: datetime
    updated_at: datetime
    messages: List[MessageResponse] = []

    model_config = {"from_attributes": True}

class CreateConversationRequest(BaseModel):
    title: Optional[str] = "New Conversation"
    document_id: Optional[str] = None
    document_ids: Optional[List[str]] = None

class ChatStreamRequest(BaseModel):
    conversation_id: str
    query: str
    document_ids: Optional[List[str]] = None  # If multi-doc or overrides conversation doc
