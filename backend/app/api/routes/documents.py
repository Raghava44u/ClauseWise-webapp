import os
from typing import List
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.core.database import get_db
from backend.app.models.document import Document, DocumentSegment
from backend.app.schemas.document import DocumentResponse, DocumentDetailResponse, ClauseInfo
from backend.app.services.document_service import DocumentService
from backend.app.services.comparison_service import ComparisonService

router = APIRouter(prefix="/api/v1/documents", tags=["Documents"])

@router.post("", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Uploads a PDF or DOCX contract, validates format and size, and executes the extraction pipeline.
    """
    doc_id, original_name, file_path, file_type, file_size = await DocumentService.save_uploaded_file(file)

    doc = Document(
        id=doc_id,
        filename=original_name,
        file_type=file_type,
        file_size=file_size,
        file_path=file_path,
        status="uploading"
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # Process extraction, OCR, and segmentation
    processed_doc = await DocumentService.process_document(doc_id, db)
    return processed_doc

@router.get("", response_model=List[DocumentResponse])
async def list_documents(db: AsyncSession = Depends(get_db)):
    """
    Lists all uploaded contracts in the library.
    """
    stmt = select(Document).order_by(Document.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/{document_id}", response_model=DocumentDetailResponse)
async def get_document(document_id: str, db: AsyncSession = Depends(get_db)):
    """
    Retrieves full contract metadata and structured segments.
    """
    stmt = select(Document).where(Document.id == document_id)
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc

@router.get("/{document_id}/status")
async def get_document_status(document_id: str, db: AsyncSession = Depends(get_db)):
    """
    Returns real-time processing status of the document.
    """
    stmt = select(Document).where(Document.id == document_id)
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {
        "id": doc.id,
        "status": doc.status,
        "is_scanned": doc.is_scanned,
        "ocr_applied": doc.ocr_applied,
        "error_message": doc.error_message,
        "page_count": doc.page_count
    }

@router.get("/{document_id}/content")
async def get_document_content(document_id: str, db: AsyncSession = Depends(get_db)):
    """
    Serves the raw contract file for in-browser PDF or DOCX rendering.
    """
    stmt = select(Document).where(Document.id == document_id)
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()
    if not doc or not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="Document file not found on disk")

    media_type = "application/pdf" if doc.file_type == "pdf" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    return FileResponse(
        doc.file_path,
        media_type=media_type,
        filename=doc.filename
    )

@router.get("/{document_id}/clauses", response_model=List[ClauseInfo])
async def get_document_clauses(document_id: str, db: AsyncSession = Depends(get_db)):
    """
    Returns list of detected clauses and section titles for the document.
    """
    stmt = select(Document).where(Document.id == document_id)
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    segments_dicts = [
        {
            "section_title": s.section_title,
            "text": s.text,
            "page_number": s.page_number,
            "start_offset": s.start_offset,
            "end_offset": s.end_offset
        }
        for s in doc.segments
    ]
    clauses_dict = ComparisonService.group_segments_into_clauses(segments_dicts, doc.raw_text or "")
    
    clause_list = []
    for title, info in clauses_dict.items():
        page_val = None
        try:
            page_val = int(str(info["page"]).split("-")[0])
        except Exception:
            page_val = 1

        clause_list.append(ClauseInfo(
            title=title,
            page_number=page_val,
            start_offset=info["start_offset"],
            end_offset=info["end_offset"],
            text_preview=info["text"][:200]
        ))

    return clause_list

@router.delete("/{document_id}")
async def delete_document(document_id: str, db: AsyncSession = Depends(get_db)):
    """
    Safely deletes a contract, associated database segments, and disk files.
    """
    deleted = await DocumentService.delete_document(document_id, db)
    if not deleted:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"message": "Document successfully deleted", "id": document_id}
