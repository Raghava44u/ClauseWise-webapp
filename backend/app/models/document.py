import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from backend.app.core.database import Base

class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String(255), nullable=False)
    file_type = Column(String(20), nullable=False)  # "pdf" or "docx"
    file_size = Column(Integer, nullable=False)     # in bytes
    file_path = Column(String(512), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    status = Column(String(30), default="uploading", nullable=False)  # "uploading", "processing", "ready", "failed"
    error_message = Column(Text, nullable=True)
    page_count = Column(Integer, nullable=True)
    is_scanned = Column(Boolean, default=False, nullable=False)
    ocr_applied = Column(Boolean, default=False, nullable=False)
    raw_text = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)

    segments = relationship("DocumentSegment", back_populates="document", cascade="all, delete-orphan", lazy="selectin")
    conversations = relationship("Conversation", back_populates="document", cascade="all, delete-orphan", lazy="selectin")

    __table_args__ = (
        Index("ix_documents_status", "status"),
        Index("ix_documents_created_at", "created_at"),
    )

class DocumentSegment(BaseModel := Base):
    __tablename__ = "document_segments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    page_number = Column(Integer, nullable=True)        # 1-based
    section_title = Column(String(255), nullable=True)
    paragraph_index = Column(Integer, nullable=True)    # 0-based
    text = Column(Text, nullable=False)
    start_offset = Column(Integer, nullable=False)      # char offset in doc raw_text
    end_offset = Column(Integer, nullable=False)        # char offset in doc raw_text
    bbox_json = Column(Text, nullable=True)             # JSON bounding box data if OCR
    is_ocr = Column(Boolean, default=False, nullable=False)

    document = relationship("Document", back_populates="segments")

    __table_args__ = (
        Index("ix_segments_doc_page", "document_id", "page_number"),
        Index("ix_segments_doc_offset", "document_id", "start_offset"),
    )
