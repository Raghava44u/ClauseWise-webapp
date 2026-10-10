from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
from backend.app.schemas.chat import Citation

class ComparisonRequest(BaseModel):
    base_document_id: str
    target_document_id: str

class ComparisonItemResponse(BaseModel):
    id: str
    clause_name: str
    change_type: str  # "added", "removed", "modified", "unchanged"
    original_text: Optional[str] = None
    revised_text: Optional[str] = None
    explanation: str
    significance: str  # "critical", "high", "medium", "low"
    is_numeric_change: bool = False
    base_page: Optional[str] = None
    target_page: Optional[str] = None
    base_citation: Optional[Citation] = None
    target_citation: Optional[Citation] = None

    model_config = {"from_attributes": True}

class ComparisonResponse(BaseModel):
    id: str
    base_document_id: str
    target_document_id: str
    base_document_title: Optional[str] = None
    target_document_title: Optional[str] = None
    summary: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    created_at: datetime
    items: List[ComparisonItemResponse] = []

    model_config = {"from_attributes": True}
