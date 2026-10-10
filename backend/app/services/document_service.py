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
