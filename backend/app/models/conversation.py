import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Boolean, Index
from sqlalchemy.orm import relationship
from backend.app.core.database import Base

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False, default="New Conversation")
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=True)
    document_ids_json = Column(Text, nullable=True)  # JSON array for multi-document cross-examination
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    document = relationship("Document", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan", lazy="selectin", order_by="Message.created_at")

    __table_args__ = (
        Index("ix_conversations_doc", "document_id"),
        Index("ix_conversations_updated", "updated_at"),
    )

class Message(Base):
    __tablename__ = "messages"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String(36), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), nullable=False)  # "user", "assistant", "system"
    content = Column(Text, nullable=False)
    citations_json = Column(Text, nullable=True)  # JSON list of verified/unverified citation dicts
    is_interrupted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    conversation = relationship("Conversation", back_populates="messages")

    __table_args__ = (
        Index("ix_messages_conv_created", "conversation_id", "created_at"),
    )
