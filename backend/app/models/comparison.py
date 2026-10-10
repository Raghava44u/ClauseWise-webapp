import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Boolean, Index
from sqlalchemy.orm import relationship
from backend.app.core.database import Base

class Comparison(Base):
    __tablename__ = "comparisons"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    base_document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    target_document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    summary = Column(Text, nullable=True)
    status = Column(String(30), default="processing", nullable=False)  # "processing", "ready", "failed"
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    base_document = relationship("Document", foreign_keys=[base_document_id])
    target_document = relationship("Document", foreign_keys=[target_document_id])
    items = relationship("ComparisonItem", back_populates="comparison", cascade="all, delete-orphan", lazy="selectin")

    __table_args__ = (
        Index("ix_comparisons_docs", "base_document_id", "target_document_id"),
        Index("ix_comparisons_created", "created_at"),
    )

class ComparisonItem(Base):
    __tablename__ = "comparison_items"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    comparison_id = Column(String(36), ForeignKey("comparisons.id", ondelete="CASCADE"), nullable=False)
    clause_name = Column(String(255), nullable=False)
    change_type = Column(String(30), nullable=False)  # "added", "removed", "modified", "unchanged"
    original_text = Column(Text, nullable=True)
    revised_text = Column(Text, nullable=True)
    explanation = Column(Text, nullable=False)
    significance = Column(String(20), default="medium", nullable=False)  # "critical", "high", "medium", "low"
    is_numeric_change = Column(Boolean, default=False, nullable=False)
    base_page = Column(String(50), nullable=True)
    target_page = Column(String(50), nullable=True)
    base_citation_json = Column(Text, nullable=True)
    target_citation_json = Column(Text, nullable=True)

    comparison = relationship("Comparison", back_populates="items")

    __table_args__ = (
        Index("ix_comp_items_significance", "comparison_id", "significance"),
    )
