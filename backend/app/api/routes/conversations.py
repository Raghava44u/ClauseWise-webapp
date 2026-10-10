import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.core.database import get_db
from backend.app.models.conversation import Conversation, Message
from backend.app.schemas.chat import ConversationResponse, CreateConversationRequest, MessageResponse, Citation

router = APIRouter(tags=["Conversations"])

def format_message_response(msg: Message) -> MessageResponse:
    citations = []
    if msg.citations_json:
        try:
            cites_raw = json.loads(msg.citations_json)
            citations = [Citation(**c) for c in cites_raw]
        except Exception:
            citations = []
    return MessageResponse(
        id=msg.id,
        conversation_id=msg.conversation_id,
        role=msg.role,
        content=msg.content,
        citations=citations,
        is_interrupted=msg.is_interrupted,
        created_at=msg.created_at
    )

def format_conversation_response(conv: Conversation) -> ConversationResponse:
    doc_ids = []
    if conv.document_ids_json:
        try:
            doc_ids = json.loads(conv.document_ids_json)
        except Exception:
            doc_ids = []
    elif conv.document_id:
        doc_ids = [conv.document_id]

    formatted_msgs = [format_message_response(m) for m in conv.messages]
    return ConversationResponse(
        id=conv.id,
        title=conv.title,
        document_id=conv.document_id,
        document_ids=doc_ids,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        messages=formatted_msgs
    )

@router.post("/api/v1/conversations", response_model=ConversationResponse)
async def create_conversation(
    req: CreateConversationRequest,
    db: AsyncSession = Depends(get_db)
):
    doc_ids_json = json.dumps(req.document_ids) if req.document_ids else None
    primary_doc_id = req.document_id or (req.document_ids[0] if req.document_ids else None)

    conv = Conversation(
        title=req.title or "New Analysis",
        document_id=primary_doc_id,
        document_ids_json=doc_ids_json
    )
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return format_conversation_response(conv)

@router.get("/api/v1/documents/{document_id}/conversations", response_model=List[ConversationResponse])
async def get_document_conversations(document_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Conversation).where(Conversation.document_id == document_id).order_by(Conversation.updated_at.desc())
    result = await db.execute(stmt)
    convs = result.scalars().all()
    return [format_conversation_response(c) for c in convs]

@router.get("/api/v1/conversations/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(conversation_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Conversation).where(Conversation.id == conversation_id)
    result = await db.execute(stmt)
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return format_conversation_response(conv)

@router.delete("/api/v1/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Conversation).where(Conversation.id == conversation_id)
    result = await db.execute(stmt)
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await db.delete(conv)
    await db.commit()
    return {"message": "Conversation deleted", "id": conversation_id}
