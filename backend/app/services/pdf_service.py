import fitz  # PyMuPDF
import json
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional

class PDFService:
    @staticmethod
    def is_page_scanned(page: fitz.Page, min_char_count: int = 50) -> bool:
        """
        Determines if a PDF page appears to be scanned or image-based.
        If page has negligible extracted text but contains images or drawing paths, it's considered scanned.
        """
        text = page.get_text("text").strip()
        if len(text) >= min_char_count:
            return False
            
        images = page.get_images()
        drawings = page.get_drawings()
        # If very little text but has images or heavy drawings, treat as scanned
        if len(images) > 0 or len(drawings) > 0 or len(text) == 0:
            return True
            
        return False

    @staticmethod
    def extract_pdf_data(file_path: str) -> Dict[str, Any]:
        """
        Extracts native text, blocks, pages, and identifies scanned pages from a PDF.
        Returns document metadata, page details, and initial segments.
        """
        doc = fitz.open(file_path)
        page_count = len(doc)
        pages_data = []
        full_text_parts = []
        scanned_page_numbers = []
        raw_offset = 0

        for page_idx in range(page_count):
            page = doc[page_idx]
            page_num = page_idx + 1
            is_scanned = PDFService.is_page_scanned(page)

            if is_scanned:
                scanned_page_numbers.append(page_num)

            # Extract structured text blocks: (x0, y0, x1, y1, text, block_no, block_type)
            # block_type 0 is text, 1 is image
            blocks = page.get_text("blocks")
            page_text_parts = []
            page_segments = []

            for b_idx, block in enumerate(blocks):
                b_type = block[6]
                if b_type != 0:
                    continue  # skip image blocks
                
                block_text = block[4].strip()
                if not block_text:
                    continue

                bbox = [round(block[0], 2), round(block[1], 2), round(block[2], 2), round(block[3], 2)]
                
                # Check for possible section heading (e.g. short line, bold/all caps or numbered)
                is_heading = False
                lines = block_text.splitlines()
                first_line = lines[0].strip() if lines else ""
                if len(first_line) < 80 and (first_line.isupper() or any(first_line.startswith(prefix) for prefix in ["Section", "Clause", "Article", "1.", "2.", "3.", "4.", "5.", "6.", "7.", "8.", "9.", "10."])):
                    is_heading = True

                segment_start = raw_offset + len("\n\n".join(page_text_parts) + ("\n\n" if page_text_parts else ""))
                segment_end = segment_start + len(block_text)

                page_segments.append({
                    "page_number": page_num,
                    "paragraph_index": b_idx,
                    "section_title": first_line if is_heading else None,
                    "text": block_text,
                    "bbox": bbox,
                    "start_offset": segment_start,
                    "end_offset": segment_end,
                    "is_ocr": False
                })
                page_text_parts.append(block_text)

            page_full_text = "\n\n".join(page_text_parts)
            pages_data.append({
                "page_number": page_num,
                "is_scanned": is_scanned,
                "text": page_full_text,
                "segments": page_segments
            })

            if page_full_text:
                full_text_parts.append(page_full_text)
                raw_offset += len(page_full_text) + 2  # account for "\n\n"

        doc.close()

        combined_raw_text = "\n\n".join(full_text_parts)
        is_entirely_scanned = (len(scanned_page_numbers) == page_count) if page_count > 0 else False

        return {
            "page_count": page_count,
            "raw_text": combined_raw_text,
            "is_scanned": is_entirely_scanned,
            "scanned_pages": scanned_page_numbers,
            "pages": pages_data
        }

    @staticmethod
    def render_page_to_image(file_path: str, page_number: int, dpi: int = 150) -> bytes:
        """
        Renders a specific PDF page to PNG image bytes for OCR processing.
        """
        doc = fitz.open(file_path)
        if page_number < 1 or page_number > len(doc):
            doc.close()
            raise ValueError(f"Page number {page_number} out of range (1..{len(doc)})")
        
        page = doc[page_number - 1]
        zoom = dpi / 72.0
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        img_bytes = pix.tobytes("png")
        doc.close()
        return img_bytes
