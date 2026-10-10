import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from backend.app.core.database import Base

class AgentRun(Base):
    __tablename__ = "agent_runs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String(36), nullable=True)
    query = Column(Text, nullable=False)
    document_ids_json = Column(Text, nullable=False)
    rounds_count = Column(Integer, default=0, nullable=False)
    status = Column(String(30), default="running", nullable=False)  # "running", "completed", "failed", "stopped"
    final_answer = Column(Text, nullable=True)
    citations_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    tool_calls = relationship("AgentToolCall", back_populates="agent_run", cascade="all, delete-orphan", lazy="selectin", order_by="AgentToolCall.created_at")

    __table_args__ = (
        Index("ix_agent_runs_created", "created_at"),
    )

class AgentToolCall(Base):
    __tablename__ = "agent_tool_calls"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    agent_run_id = Column(String(36), ForeignKey("agent_runs.id", ondelete="CASCADE"), nullable=False)
    round_number = Column(Integer, nullable=False)
    tool_name = Column(String(100), nullable=False)
    arguments_json = Column(Text, nullable=False)
    result_summary = Column(Text, nullable=True)
    raw_result_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    agent_run = relationship("AgentRun", back_populates="tool_calls")

    __table_args__ = (
        Index("ix_agent_tool_run_round", "agent_run_id", "round_number"),
    )
