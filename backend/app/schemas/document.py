from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field

class DocumentSegmentResponse(BaseModel):
    id: str
    document_id: str
    page_number: Optional[int] = None
    section_title: Optional[str] = None
    paragraph_index: Optional[int] = None
    text: str
    start_offset: int
    end_offset: int
    bbox_json: Optional[str] = None
    is_ocr: bool = False

    model_config = {"from_attributes": True}

class DocumentResponse(BaseModel):
    id: str
    filename: str
    file_type: str
    file_size: int
    created_at: datetime
    status: str
    error_message: Optional[str] = None
    page_count: Optional[int] = None
    is_scanned: bool = False
    ocr_applied: bool = False
    summary: Optional[str] = None

    model_config = {"from_attributes": True}

class DocumentDetailResponse(DocumentResponse):
    raw_text: Optional[str] = None
    segments: List[DocumentSegmentResponse] = []

class ClauseInfo(BaseModel):
    title: str
    page_number: Optional[int] = None
    start_offset: int
    end_offset: int
    text_preview: str
