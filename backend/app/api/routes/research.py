import json
import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.core.database import get_db, AsyncSessionLocal
from backend.app.models.document import Document
from backend.app.models.agent_run import AgentRun, AgentToolCall
from backend.app.schemas.agent import AgentResearchRequest
from backend.app.services.agent_service import AgentService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/research", tags=["Research"])

@router.post("/stream")
async def stream_agent_research(
    req: AgentResearchRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Executes Part C Option 2: Autonomous Agentic Document Research.
    Streams model tool calls, tool results, progress stages, and verified citations.
    """
    if not req.document_ids:
        raise HTTPException(status_code=400, detail="Must provide at least one document ID to research.")

    docs_stmt = select(Document).where(Document.id.in_(req.document_ids))
    docs_res = await db.execute(docs_stmt)
    documents = docs_res.scalars().all()

    if not documents:
        raise HTTPException(status_code=404, detail="Referenced document(s) not found.")

    docs_data = []
    for d in documents:
        docs_data.append({
            "id": d.id,
            "filename": d.filename,
            "page_count": d.page_count,
            "file_type": d.file_type,
            "is_scanned": d.is_scanned,
            "ocr_applied": d.ocr_applied,
            "raw_text": d.raw_text or "",
            "summary": d.summary,
            "segments": [
                {
                    "id": s.id,
                    "page_number": s.page_number,
                    "section_title": s.section_title,
                    "paragraph_index": s.paragraph_index,
                    "text": s.text,
                    "start_offset": s.start_offset,
                    "end_offset": s.end_offset,
                    "bbox": json.loads(s.bbox_json) if s.bbox_json else None
                }
                for s in d.segments
            ]
        })

    # Initialize agent run record
    run_record = AgentRun(
        conversation_id=req.conversation_id,
        query=req.query,
        document_ids_json=json.dumps(req.document_ids),
        status="running"
    )
    db.add(run_record)
    await db.commit()
    await db.refresh(run_record)
    run_id = run_record.id

    async def sse_generator():
        final_answer = ""
        tool_calls_saved = []
        citations_saved = []

        try:
            async for event in AgentService.run_agent_loop(
                query=req.query,
                documents=docs_data,
                max_rounds=req.max_rounds or 6
            ):
                if await request.is_disconnected():
                    logger.info("Agent research stream was disconnected by client.")
                    break

                ev_type = event.get("type", "status")
                yield f"event: {ev_type}\ndata: {json.dumps(event)}\n\n"

                if ev_type == "tool_call":
                    pass
                elif ev_type == "tool_result":
                    pass
                elif ev_type == "citations":
                    citations_saved = event.get("citations", [])
                elif ev_type == "done":
                    final_answer = event.get("final_answer", "")
                    tool_calls_saved = event.get("tool_calls", [])
                    citations_saved = event.get("citations", [])

        except Exception as err:
            logger.error(f"Error in agent research loop: {err}")
            yield f"event: error\ndata: {json.dumps({'message': str(err)})}\n\n"

        # Update run record in db
        async with AsyncSessionLocal() as update_db:
            run_stmt = select(AgentRun).where(AgentRun.id == run_id)
            res = await update_db.execute(run_stmt)
            run_obj = res.scalar_one_or_none()
            if run_obj:
                run_obj.status = "completed" if final_answer else "stopped"
                run_obj.final_answer = final_answer
                run_obj.citations_json = json.dumps(citations_saved)
                run_obj.rounds_count = len(tool_calls_saved)

                for tc in tool_calls_saved:
                    call_obj = AgentToolCall(
                        agent_run_id=run_id,
                        round_number=tc.get("round_number", 1),
                        tool_name=tc.get("tool_name", ""),
                        arguments_json=json.dumps(tc.get("arguments", {})),
                        result_summary=tc.get("result_summary", ""),
                        raw_result_json=json.dumps(tc.get("raw_result")) if tc.get("raw_result") else None
                    )
                    update_db.add(call_obj)

                await update_db.commit()

        yield f"event: run_id\ndata: {json.dumps({'run_id': run_id})}\n\n"

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
