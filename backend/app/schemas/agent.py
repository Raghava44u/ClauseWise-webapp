from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel
from backend.app.schemas.chat import Citation

class ToolCallInfo(BaseModel):
    id: Optional[str] = None
    round_number: int
    tool_name: str
    arguments: Dict[str, Any]
    result_summary: Optional[str] = None
    raw_result: Optional[Any] = None
    created_at: Optional[datetime] = None

class AgentResearchRequest(BaseModel):
    query: str
    document_ids: List[str]
    conversation_id: Optional[str] = None
    max_rounds: Optional[int] = 6

class AgentRunResponse(BaseModel):
    id: str
    query: str
    document_ids: List[str]
    rounds_count: int
    status: str
    final_answer: Optional[str] = None
    citations: List[Citation] = []
    tool_calls: List[ToolCallInfo] = []
    created_at: datetime

    model_config = {"from_attributes": True}
