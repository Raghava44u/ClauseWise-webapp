import os
import re
import uuid
import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from fastapi import UploadFile, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from backend.app.core.config import settings
from backend.app.models.document import Document, DocumentSegment
from backend.app.services.pdf_service import PDFService
from backend.app.services.docx_service import DOCXService
from backend.app.services.ocr_service import OCRService

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {".pdf", ".docx"}

class DocumentService:
    @staticmethod
    def sanitize_filename(filename: str) -> str:
        clean = re.sub(r'[^a-zA-Z0-9_.-]', '_', filename)
        return clean or "document"

    @classmethod
    async def save_uploaded_file(cls, file: UploadFile) -> Tuple[str, str, str, int]:
        """
        Validates and saves uploaded PDF or DOCX file to safe storage.
        Returns: (doc_id, safe_filename, file_type, file_size)
        """
        original_name = file.filename or "uploaded_contract"
        ext = Path(original_name).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format '{ext}'. Only PDF (.pdf) and Word (.docx) contracts are supported."
            )

        safe_name = cls.sanitize_filename(original_name)
        doc_id = str(uuid.uuid4())
        stored_filename = f"{doc_id}_{safe_name}"
        destination = settings.upload_path / stored_filename

        # Read content and enforce size limits
        content = await file.read()
        file_size = len(content)

        if file_size == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
        if file_size > max_bytes:
            raise HTTPException(
                status_code=400,
                detail=f"File size ({round(file_size/(1024*1024), 2)} MB) exceeds maximum allowed limit ({settings.MAX_UPLOAD_SIZE_MB} MB)."
            )

        with open(destination, "wb") as f:
            f.write(content)

        file_type = "pdf" if ext == ".pdf" else "docx"
        return doc_id, original_name, str(destination), file_type, file_size

    @classmethod
    async def process_document(cls, doc_id: str, db: AsyncSession) -> Document:
        """
        Extracts native text, applies OCR for scanned pages if needed,
        stores structured segments, and updates status to ready.
        """
        stmt = select(Document).where(Document.id == doc_id)
        result = await db.execute(stmt)
        doc = result.scalar_one_or_none()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        doc.status = "processing"
        await db.commit()

        try:
            file_path = doc.file_path
            raw_text = ""
            segments_data = []
            page_count = 1
            is_scanned = False
            ocr_applied = False

            if doc.file_type == "pdf":
                extracted = PDFService.extract_pdf_data(file_path)
                page_count = extracted["page_count"]
                raw_text = extracted["raw_text"]
                is_scanned = extracted["is_scanned"]
                scanned_pages = extracted["scanned_pages"]

                # Collect native segments
                for p_info in extracted["pages"]:
                    segments_data.extend(p_info["segments"])

                # If pages require OCR
                if scanned_pages and settings.ENABLE_OCR:
                    logger.info(f"Document {doc_id} has {len(scanned_pages)} scanned pages. Initiating OCR...")
                    ocr_segments = []
                    ocr_text_parts = []

                    for p_num in scanned_pages:
                        try:
                            img_bytes = PDFService.render_page_to_image(file_path, p_num)
                            ocr_res = OCRService.process_image_bytes(img_bytes, page_number=p_num)
                            if ocr_res.get("success"):
                                ocr_applied = True
                                p_text = ocr_res.get("text", "")
                                if p_text:
                                    ocr_text_parts.append(p_text)
                                ocr_segments.extend(ocr_res.get("segments", []))
                        except Exception as ocr_err:
                            logger.error(f"OCR error on page {p_num}: {ocr_err}")

                    if ocr_applied:
                        # Combine native text and OCR text
                        if not raw_text.strip():
                            raw_text = "\n\n".join(ocr_text_parts)
                            segments_data = ocr_segments
                        else:
                            raw_text += "\n\n" + "\n\n".join(ocr_text_parts)
                            segments_data.extend(ocr_segments)

            elif doc.file_type == "docx":
                extracted = DOCXService.extract_docx_data(file_path)
                page_count = extracted["page_count"]
                raw_text = extracted["raw_text"]
                segments_data = extracted["segments"]

            # Validate that extraction yielded usable text
            if not raw_text.strip():
                doc.status = "failed"
                doc.error_message = (
                    "No usable text could be extracted from this document. "
                    "If this is a scanned contract, please ensure OCR is enabled and the file is legible."
                )
                await db.commit()
                return doc

            # Recalculate character offsets across segments cleanly
            running_offset = 0
            for seg in segments_data:
                seg_text = seg.get("text", "")
                seg["start_offset"] = running_offset
                seg["end_offset"] = running_offset + len(seg_text)
                running_offset += len(seg_text) + 2

            # Store segments in database
            # Clear existing segments if reprocessing
            await db.execute(delete(DocumentSegment).where(DocumentSegment.document_id == doc_id))

            for s in segments_data:
                db_seg = DocumentSegment(
                    document_id=doc_id,
                    page_number=s.get("page_number"),
                    section_title=s.get("section_title"),
                    paragraph_index=s.get("paragraph_index"),
                    text=s.get("text"),
                    start_offset=s.get("start_offset", 0),
                    end_offset=s.get("end_offset", 0),
                    bbox_json=json.dumps(s.get("bbox")) if s.get("bbox") else None,
                    is_ocr=s.get("is_ocr", False)
                )
                db.add(db_seg)

            doc.raw_text = raw_text
            doc.page_count = page_count
            doc.is_scanned = is_scanned
            doc.ocr_applied = ocr_applied
            doc.status = "ready"
            doc.error_message = None

            await db.commit()
            await db.refresh(doc)
            return doc

        except Exception as e:
            logger.error(f"Error processing document {doc_id}: {e}")
            doc.status = "failed"
            doc.error_message = str(e)
            await db.commit()
            return doc

    @classmethod
    async def delete_document(cls, doc_id: str, db: AsyncSession) -> bool:
        stmt = select(Document).where(Document.id == doc_id)
        result = await db.execute(stmt)
        doc = result.scalar_one_or_none()
        if not doc:
            return False

        # Remove physical file
        try:
            if os.path.exists(doc.file_path):
                os.remove(doc.file_path)
        except Exception as err:
            logger.warning(f"Failed to remove file on disk {doc.file_path}: {err}")

        await db.delete(doc)
        await db.commit()
        return True

    @classmethod
    async def get_or_generate_suggested_questions(cls, doc: Document, db: AsyncSession) -> List[str]:
        """
        Retrieves cached dynamic suggested questions or generates 4 tailored questions
        specifically derived from the document's actual contents, entities, and clauses.
        """
        # Check if already cached in summary
        if doc.summary:
            try:
                cached = json.loads(doc.summary)
                if isinstance(cached, list) and len(cached) >= 3 and all(isinstance(q, str) for q in cached):
                    return cached
            except Exception:
                pass

        # Text excerpt for analysis
        text_excerpt = (doc.raw_text or "")[:3500].strip()
        filename = doc.filename or "Uploaded Document"

        # Try AI generation first
        from backend.app.services.grok_service import GrokService
        try:
            prompt = (
                f"You are an expert legal and document intelligence analyst. "
                f"Review the following text excerpt from the uploaded document '{filename}'. "
                f"Generate exactly 4 insightful, specific, dynamic questions that a user or reviewer would want to ask about THIS SPECIFIC document. "
                f"Each question must directly relate to the specific content, entities, role, skills, terms, clauses, or details present in this document "
                f"(do NOT use generic boilerplate questions like 'limitation of liability' unless the document actually has a liability clause).\n\n"
                f"Document excerpt:\n{text_excerpt}\n\n"
                f"Respond with a JSON array of exactly 4 strings, e.g. [\"question 1\", \"question 2\", \"question 3\", \"question 4\"]. Only output valid JSON without any markdown formatting."
            )

            res = await GrokService.chat_completion(
                [{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=600
            )

            content = res.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
            # Clean possible markdown formatting
            if content.startswith("```"):
                lines = content.splitlines()
                content = "\n".join([line for line in lines if not line.strip().startswith("```")]).strip()

            parsed = json.loads(content)
            if isinstance(parsed, list) and len(parsed) >= 3:
                clean_qs = [str(q).strip().strip('"').strip("'") for q in parsed[:4] if str(q).strip()]
                if len(clean_qs) >= 3:
                    doc.summary = json.dumps(clean_qs)
                    await db.commit()
                    return clean_qs
        except Exception as ai_err:
            logger.warning(f"AI question generation failed for doc {doc.id}, falling back to content analyzer: {ai_err}")

        # Fallback: Content-aware dynamic questions
        lower_text = text_excerpt.lower()
        lower_filename = filename.lower()
        questions = []

        is_profile = any(k in lower_text or k in lower_filename for k in [
            "profile", "resume", "curriculum", "skills", "experience", "education",
            "developer", "engineer", "intern", "hugging face", "github", "linkedin", "operations"
        ])
        is_nda = any(k in lower_text or k in lower_filename for k in [
            "non-disclosure", "nda", "confidentiality", "proprietary information", "disclosing party"
        ])
        is_amendment = any(k in lower_text or k in lower_filename for k in [
            "amendment", "addendum", "modification", "amended and restated"
        ])

        if is_profile:
            questions = [
                f"What are the core operational skills, technical proficiencies, and tools documented in '{filename}'?",
                "What specific professional responsibilities and data integrity workflows are highlighted?",
                "What educational background, academic achievements, and degrees are listed?",
                "What key projects, benchmark audits, and case studies are detailed?"
            ]
        elif is_nda:
            questions = [
                "What specific categories of data and materials are classified as Confidential Information?",
                "What are the receiving party's non-disclosure obligations and permitted exceptions?",
                "What is the duration of the confidentiality obligations and post-termination survival period?",
                "What remedies, injunctive relief, and governing jurisdiction are specified?"
            ]
        elif is_amendment:
            questions = [
                "What original agreement provisions or sections are modified by this amendment?",
                "What are the revised terms, effective dates, or financial adjustments introduced?",
                "How does this amendment impact liabilities, warranties, or termination clauses?",
                "What conditions precedent or signatures are required for execution?"
            ]
        else:
            # Check segments for actual clause titles
            stmt = select(DocumentSegment).where(
                DocumentSegment.document_id == doc.id,
                DocumentSegment.section_title.isnot(None)
            ).limit(10)
            seg_res = await db.execute(stmt)
            titles = [s.section_title for s in seg_res.scalars().all() if s.section_title and len(s.section_title) > 3]
            titles = list(dict.fromkeys(titles))  # deduplicate preserving order

            if len(titles) >= 4:
                questions = [f"What specific terms and obligations are outlined under '{t}'?" for t in titles[:4]]
            else:
                questions = [
                    f"What are the primary rights, duties, and core obligations established in '{filename}'?",
                    "What are the financial, compensation, or payment settlement conditions?",
                    "What are the termination requirements, notice periods, and breach provisions?",
                    "How are liabilities, warranties, and dispute resolution governed in this contract?"
                ]

        doc.summary = json.dumps(questions)
        try:
            await db.commit()
        except Exception:
            pass

        return questions

