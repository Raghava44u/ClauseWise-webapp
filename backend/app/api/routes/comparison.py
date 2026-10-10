import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.core.database import get_db
from backend.app.models.document import Document
from backend.app.models.comparison import Comparison, ComparisonItem
from backend.app.schemas.comparison import ComparisonRequest, ComparisonResponse, ComparisonItemResponse
from backend.app.schemas.chat import Citation
from backend.app.services.comparison_service import ComparisonService

router = APIRouter(tags=["Comparison"])

def format_comparison_response(comp: Comparison, base_title: str, target_title: str) -> ComparisonResponse:
    items = []
    for item in comp.items:
        b_cite = None
        t_cite = None
        if item.base_citation_json:
            try:
                b_cite = Citation(**json.loads(item.base_citation_json))
            except Exception:
                pass
        if item.target_citation_json:
            try:
                t_cite = Citation(**json.loads(item.target_citation_json))
            except Exception:
                pass

        items.append(ComparisonItemResponse(
            id=item.id,
            clause_name=item.clause_name,
            change_type=item.change_type,
            original_text=item.original_text,
            revised_text=item.revised_text,
            explanation=item.explanation,
            significance=item.significance,
            is_numeric_change=item.is_numeric_change,
            base_page=item.base_page,
            target_page=item.target_page,
            base_citation=b_cite,
            target_citation=t_cite
        ))

    return ComparisonResponse(
        id=comp.id,
        base_document_id=comp.base_document_id,
        target_document_id=comp.target_document_id,
        base_document_title=base_title,
        target_document_title=target_title,
        summary=comp.summary,
        status=comp.status,
        error_message=comp.error_message,
        created_at=comp.created_at,
        items=items
    )

@router.post("/api/v1/documents/compare", response_model=ComparisonResponse)
async def compare_documents(
    req: ComparisonRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Compares two contracts (base version vs target version).
    Aligns clauses, detects additions/deletions/modifications, highlights numeric shifts,
    computes legal significance, and verifies citations.
    """
    stmt_b = select(Document).where(Document.id == req.base_document_id)
    res_b = await db.execute(stmt_b)
    base_doc = res_b.scalar_one_or_none()

    stmt_t = select(Document).where(Document.id == req.target_document_id)
    res_t = await db.execute(stmt_t)
    target_doc = res_t.scalar_one_or_none()

    if not base_doc or not target_doc:
        raise HTTPException(status_code=404, detail="One or both contracts not found")

    base_dict = {
        "id": base_doc.id,
        "filename": base_doc.filename,
        "raw_text": base_doc.raw_text or "",
        "segments": [
            {
                "id": s.id,
                "page_number": s.page_number,
                "section_title": s.section_title,
                "text": s.text,
                "start_offset": s.start_offset,
                "end_offset": s.end_offset
            }
            for s in base_doc.segments
        ]
    }

    target_dict = {
        "id": target_doc.id,
        "filename": target_doc.filename,
        "raw_text": target_doc.raw_text or "",
        "segments": [
            {
                "id": s.id,
                "page_number": s.page_number,
                "section_title": s.section_title,
                "text": s.text,
                "start_offset": s.start_offset,
                "end_offset": s.end_offset
            }
            for s in target_doc.segments
        ]
    }

    comp = Comparison(
        base_document_id=base_doc.id,
        target_document_id=target_doc.id,
        status="processing"
    )
    db.add(comp)
    await db.commit()
    await db.refresh(comp)

    try:
        diff_res = await ComparisonService.compare_documents(base_dict, target_dict)

        comp.summary = diff_res.get("summary")
        comp.status = "ready"

        for item_data in diff_res.get("items", []):
            db_item = ComparisonItem(
                comparison_id=comp.id,
                clause_name=item_data["clause_name"],
                change_type=item_data["change_type"],
                original_text=item_data.get("original_text"),
                revised_text=item_data.get("revised_text"),
                explanation=item_data["explanation"],
                significance=item_data["significance"],
                is_numeric_change=item_data.get("is_numeric_change", False),
                base_page=item_data.get("base_page"),
                target_page=item_data.get("target_page"),
                base_citation_json=json.dumps(item_data["base_citation"]) if item_data.get("base_citation") else None,
                target_citation_json=json.dumps(item_data["target_citation"]) if item_data.get("target_citation") else None
            )
            db.add(db_item)

        await db.commit()
        await db.refresh(comp)
        return format_comparison_response(comp, base_doc.filename, target_doc.filename)

    except Exception as e:
        comp.status = "failed"
        comp.error_message = str(e)
        await db.commit()
        raise HTTPException(status_code=500, detail=f"Comparison failed: {e}")

@router.get("/api/v1/comparisons/{comparison_id}", response_model=ComparisonResponse)
async def get_comparison(comparison_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Comparison).where(Comparison.id == comparison_id)
    res = await db.execute(stmt)
    comp = res.scalar_one_or_none()
    if not comp:
        raise HTTPException(status_code=404, detail="Comparison record not found")

    base_title = comp.base_document.filename if comp.base_document else "Base Document"
    target_title = comp.target_document.filename if comp.target_document else "Target Document"
    return format_comparison_response(comp, base_title, target_title)
