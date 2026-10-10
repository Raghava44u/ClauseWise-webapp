import json
import asyncio
import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.core.database import get_db, AsyncSessionLocal
from backend.app.models.conversation import Conversation, Message
from backend.app.models.document import Document
from backend.app.schemas.chat import ChatStreamRequest
from backend.app.services.retrieval_service import RetrievalService
from backend.app.services.citation_service import CitationService
from backend.app.services.grok_service import GrokService, GrokAPIError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/chat", tags=["Chat"])

@router.post("/stream")
async def stream_chat(
    req: ChatStreamRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Server-Sent Events streaming chat endpoint.
    Retrieves evidence, streams tokens from Grok, verifies quotations server-side,
    and persists message history even if interrupted.
    """
    stmt = select(Conversation).where(Conversation.id == req.conversation_id)
    result = await db.execute(stmt)
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Determine which documents to search
    doc_ids = req.document_ids or []
    if not doc_ids and conv.document_ids_json:
        try:
            doc_ids = json.loads(conv.document_ids_json)
        except Exception:
            doc_ids = []
    if not doc_ids and conv.document_id:
        doc_ids = [conv.document_id]

    if not doc_ids:
        # Fallback to querying all available documents in the library
        all_docs_stmt = select(Document.id)
        all_docs_res = await db.execute(all_docs_stmt)
        doc_ids = [row[0] for row in all_docs_res.all()]

    if not doc_ids:
        raise HTTPException(status_code=400, detail="No documents uploaded yet. Please upload a contract first.")

    # Fetch document records
    docs_stmt = select(Document).where(Document.id.in_(doc_ids))
    docs_res = await db.execute(docs_stmt)
    documents = docs_res.scalars().all()

    if not documents:
        raise HTTPException(status_code=404, detail="Referenced document(s) not found.")

    docs_data = []
    for d in documents:
        docs_data.append({
            "id": d.id,
            "filename": d.filename,
            "raw_text": d.raw_text or "",
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

    # Save user message to database
    user_msg = Message(
        conversation_id=conv.id,
        role="user",
        content=req.query
    )
    db.add(user_msg)
    await db.commit()

    # Load existing messages for context
    history_stmt = select(Message).where(Message.conversation_id == conv.id).order_by(Message.created_at)
    hist_res = await db.execute(history_stmt)
    past_msgs = hist_res.scalars().all()

    async def event_generator():
        yield f"event: status\ndata: {json.dumps({'message': 'Searching document passages via BM25 index...'})}\n\n"

        # Multi-document retrieval across all target documents
        search_res = RetrievalService.search_multiple_documents(
            query=req.query,
            documents_data=docs_data,
            top_k_per_doc=6,
            total_token_budget=3600
        )
        retrieved_segments = search_res.get("segments", [])

        if not retrieved_segments:
            yield f"event: status\ndata: {json.dumps({'message': 'Analyzing full document index...'})}\n\n"

        # Format context for Grok
        context_blocks = []
        for s in retrieved_segments:
            doc_name = s.get("origin_document_title", "Contract")
            p_num = s.get("page_number", 1)
            sec = s.get("section_title") or "General"
            context_blocks.append(
                f"[Document: {doc_name} | Page: {p_num} | Section: {sec}]\n{s.get('text')}"
            )
        context_text = "\n\n---\n\n".join(context_blocks)

        system_prompt = (
            "You are ClauseWise, an elite legal contract and document intelligence AI assistant. "
            "You are assisting a user or legal counsel with analysis of the uploaded document(s) (contracts, agreements, resumes, policies). "
            "The extracted text of the document(s) is provided below under RELEVANT DOCUMENT EXCERPTS.\n\n"
            "Follow these mandatory guidelines:\n"
            "1. Ground all answers directly on the provided document excerpts below.\n"
            "2. When the user asks general or overview questions (such as 'what does this pdf tell about?', 'what is it all about?', 'what is his name?', 'who is this?', 'summarize this document'), "
            "provide a direct, comprehensive, and helpful answer summarizing the document's subject, purpose, parties/person, or background based on the provided excerpts.\n"
            "3. When answering specific contractual or factual questions, support every key claim with the exact verbatim quotation enclosed in double quotes (\"...\") and state which document and page number the quote comes from.\n"
            "4. If multiple documents are included in the excerpts, synthesize evidence across ALL of them, comparing and contrasting their provisions, and clearly attribute each finding to its originating document (e.g., [Document: filename]).\n"
            "5. If the provided excerpts genuinely lack information on the topic after exhaustive review, state clearly: "
            "'Based on the contract text, there is no provision or insufficient evidence regarding this topic.'\n"
            "6. Never claim you cannot read or access PDF files or external documents; the text has already been parsed and provided to you below.\n\n"
            f"--- RELEVANT DOCUMENT EXCERPTS ---\n{context_text}\n--- END EXCERPTS ---"
        )

        model_messages = [{"role": "system", "content": system_prompt}]
        for m in past_msgs[-6:]:  # last 6 messages
            model_messages.append({"role": m.role, "content": m.content})

        yield f"event: status\ndata: {json.dumps({'message': 'Generating response with Grok...'})}\n\n"

        accumulated_text = ""
        is_interrupted = False
        generation_error = None

        try:
            async for chunk in GrokService.stream_chat_completion(
                messages=model_messages,
                temperature=0.1
            ):
                if await request.is_disconnected():
                    is_interrupted = True
                    break

                token = chunk.get("content", "")
                if token:
                    accumulated_text += token
                    yield f"event: token\ndata: {json.dumps({'content': token})}\n\n"

                if chunk.get("done"):
                    break

        except asyncio.CancelledError:
            is_interrupted = True
            logger.info("Chat stream was cancelled by client.")
        except Exception as err:
            logger.error(f"Error during AI chat generation: {err}")
            generation_error = str(err)
            yield f"event: error\ndata: {json.dumps({'message': str(err)})}\n\n"

        # Perform deterministic server-side quotation verification
        yield f"event: status\ndata: {json.dumps({'message': 'Verifying quotations against source documents...'})}\n\n"

        verified_citations = []
        for d in docs_data:
            cites = CitationService.extract_and_verify_citations(
                text_with_citations=accumulated_text,
                document_text=d["raw_text"],
                document_id=d["id"],
                document_title=d["filename"],
                segments=d["segments"]
            )
            verified_citations.extend(cites)

        yield f"event: citation\ndata: {json.dumps({'citations': verified_citations})}\n\n"

        # Determine final message content
        if is_interrupted:
            final_content = accumulated_text or "Generation stopped by user before completion."
        elif generation_error:
            final_content = accumulated_text or f"⚠️ Analysis generation could not be completed: {generation_error}"
        else:
            final_content = accumulated_text or "Based on the contract text, there is no provision or insufficient evidence regarding this topic."

        # Persist assistant message in independent database session
        async with AsyncSessionLocal() as save_db:
            asst_msg = Message(
                conversation_id=conv.id,
                role="assistant",
                content=final_content,
                citations_json=json.dumps(verified_citations),
                is_interrupted=is_interrupted
            )
            save_db.add(asst_msg)
            await save_db.commit()
            await save_db.refresh(asst_msg)
            msg_id = asst_msg.id

        yield f"event: done\ndata: {json.dumps({'message_id': msg_id, 'is_interrupted': is_interrupted, 'citations_count': len(verified_citations)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
