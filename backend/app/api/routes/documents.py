import os
import uuid
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
    Serves the raw contract file for in-browser PDF or DOCX rendering without triggering download.
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
        content_disposition_type="inline",
        headers={"Content-Disposition": f'inline; filename="{doc.filename}"'}
    )

@router.get("/{document_id}/pages/{page_number}/image")
async def get_page_image(document_id: str, page_number: int, db: AsyncSession = Depends(get_db)):
    """
    Renders an original PDF page as a high-resolution PNG image for zero-download in-browser viewing.
    """
    from fastapi.responses import Response
    from backend.app.services.pdf_service import PDFService

    stmt = select(Document).where(Document.id == document_id)
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()
    if not doc or not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="Document file not found")

    if doc.file_type != "pdf":
        raise HTTPException(status_code=400, detail="Page images are only supported for PDF documents")

    try:
        img_bytes = PDFService.render_page_to_image(doc.file_path, page_number, dpi=150)
        return Response(content=img_bytes, media_type="image/png", headers={"Cache-Control": "public, max-age=86400"})
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to render page image: {e}")

@router.get("/{document_id}/pages/{page_number}/info")
async def get_page_info(document_id: str, page_number: int, db: AsyncSession = Depends(get_db)):
    """
    Returns original PDF page dimensions in points for coordinate mapping.
    """
    import fitz

    stmt = select(Document).where(Document.id == document_id)
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()
    if not doc or not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="Document file not found")

    doc_fitz = fitz.open(doc.file_path)
    if page_number < 1 or page_number > len(doc_fitz):
        doc_fitz.close()
        raise HTTPException(status_code=404, detail="Page number out of range")

    page = doc_fitz[page_number - 1]
    width = float(page.rect.width)
    height = float(page.rect.height)
    doc_fitz.close()

    return {"page_number": page_number, "width": width, "height": height}


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

@router.post("/{document_id}/create-amendment-demo", response_model=DocumentResponse)
async def create_amendment_demo(document_id: str, db: AsyncSession = Depends(get_db)):
    """
    Generates a synthetic redlined amendment contract based on an existing document.
    Enables immediate evaluation of version comparison, numeric deltas, and risk classifications.
    """
    import fitz
    from backend.app.core.config import settings

    stmt = select(Document).where(Document.id == document_id)
    result = await db.execute(stmt)
    base_doc = result.scalar_one_or_none()
    if not base_doc:
        raise HTTPException(status_code=404, detail="Base document not found")

    new_doc_id = str(uuid.uuid4())
    base_stem = os.path.splitext(base_doc.filename)[0]
    new_filename = f"{base_stem}_v2_Amended.pdf"
    stored_filename = f"{new_doc_id}_{new_filename}"
    destination = settings.upload_path / stored_filename

    # Create amended PDF with PyMuPDF
    doc = fitz.open()
    page1 = doc.new_page(width=595, height=842)

    text_lines = [
        "CONTRACT AMENDMENT & REDLINE REVISION NO. 1",
        f"Reference Agreement: {base_doc.filename}",
        "Date of Amendment: October 2026",
        "",
        "SECTION 1: REVISED PAYMENT TERMS & PENALTIES",
        "All undisputed invoices shall be payable strictly within sixty (60) calendar days of invoice receipt (previously thirty (30) days). Any past due balance shall accrue a late financing charge of 1.5% per month.",
        "",
        "SECTION 2: REVISED LIMITATION OF LIABILITY & INDEMNIFICATION",
        "Notwithstanding any prior provisions, the aggregate liability of either party arising under or related to this Agreement shall be capped at AED 1,000,000 (increased from AED 500,000). Both parties agree to mutual indemnification for direct third-party gross negligence claims.",
        "",
        "SECTION 3: TERMINATION FOR CONVENIENCE & CANCELLATION FEE",
        "Either party may terminate this Agreement without cause upon ninety (90) calendar days prior written notice (amended from thirty (30) days). In the event of early termination by Client, an early termination settlement fee of USD $25,000 shall immediately become due.",
        "",
        "SECTION 4: DATA PROTECTION, SECURITY AUDIT & BREACH PROTOCOL",
        "Vendor shall implement SOC2 Type II controls. In the event of any confirmed security incident or data breach, Vendor shall notify Client within seventy-two (72) hours. Client retains the right to conduct an independent annual cybersecurity audit.",
        "",
        "SECTION 5: GOVERNING LAW & ARBITRATION VENUE",
        "This Agreement shall be governed by and construed in accordance with the laws of England and Wales. Any controversy or dispute shall be settled by binding arbitration administered by the London Court of International Arbitration (LCIA) in London, UK."
    ]

    p = fitz.Point(50, 60)
    for line in text_lines:
        if line.startswith("CONTRACT AMENDMENT"):
            page1.insert_text(p, line, fontsize=15, fontname="helv", color=(0.1, 0.2, 0.5))
            p.y += 24
        elif line.startswith("SECTION"):
            page1.insert_text(p, line, fontsize=12, fontname="helv", color=(0.05, 0.45, 0.4))
            p.y += 18
        elif line.startswith("Reference") or line.startswith("Date"):
            page1.insert_text(p, line, fontsize=9, fontname="helv", color=(0.4, 0.4, 0.4))
            p.y += 14
        elif not line:
            p.y += 10
        else:
            rect = fitz.Rect(50, p.y, 545, p.y + 70)
            page1.insert_textbox(rect, line, fontsize=10, fontname="helv", color=(0.15, 0.15, 0.15))
            p.y += 55

    doc.save(str(destination))
    doc.close()

    file_size = os.path.getsize(str(destination))

    new_doc = Document(
        id=new_doc_id,
        filename=new_filename,
        file_type="pdf",
        file_size=file_size,
        file_path=str(destination),
        status="uploading"
    )
    db.add(new_doc)
    await db.commit()
    await db.refresh(new_doc)

    processed = await DocumentService.process_document(new_doc_id, db)
    return processed

@router.delete("/{document_id}")
async def delete_document(document_id: str, db: AsyncSession = Depends(get_db)):
    """
    Safely deletes a contract, associated database segments, and disk files.
    """
    deleted = await DocumentService.delete_document(document_id, db)
    if not deleted:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"message": "Document successfully deleted", "id": document_id}

