import docx
from typing import List, Dict, Any, Optional

class DOCXService:
    @staticmethod
    def extract_docx_data(file_path: str) -> Dict[str, Any]:
        """
        Extracts structured paragraphs, headings, tables, and character offsets from a DOCX file.
        """
        doc = docx.Document(file_path)
        segments = []
        raw_text_parts = []
        current_offset = 0
        current_section = None
        paragraph_idx = 0

        # Estimate page count roughly (~3000 characters per typical contract page)
        for p in doc.paragraphs:
            text = p.text.strip()
            if not text:
                continue

            style_name = p.style.name.lower() if p.style else ""
            is_heading = "heading" in style_name or "title" in style_name
            
            # If line looks like a clause heading
            if is_heading or (len(text) < 100 and (text.isupper() or any(text.startswith(prefix) for prefix in ["Clause", "Section", "Article", "1.", "2.", "3.", "4.", "5.", "6.", "7.", "8.", "9.", "10."]))):
                current_section = text

            # Approximate page number based on running character count
            approx_page = max(1, (current_offset // 2500) + 1)
            start_offset = current_offset
            end_offset = start_offset + len(text)

            segments.append({
                "page_number": approx_page,
                "paragraph_index": paragraph_idx,
                "section_title": current_section,
                "text": text,
                "bbox": None,
                "start_offset": start_offset,
                "end_offset": end_offset,
                "is_ocr": False
            })

            raw_text_parts.append(text)
            current_offset += len(text) + 2  # account for "\n\n"
            paragraph_idx += 1

        # Also extract table text
        for table in doc.tables:
            for row in table.rows:
                row_cells_text = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                if not row_cells_text:
                    continue
                row_text = " | ".join(row_cells_text)
                approx_page = max(1, (current_offset // 2500) + 1)
                start_offset = current_offset
                end_offset = start_offset + len(row_text)

                segments.append({
                    "page_number": approx_page,
                    "paragraph_index": paragraph_idx,
                    "section_title": current_section or "Table Content",
                    "text": row_text,
                    "bbox": None,
                    "start_offset": start_offset,
                    "end_offset": end_offset,
                    "is_ocr": False
                })
                raw_text_parts.append(row_text)
                current_offset += len(row_text) + 2
                paragraph_idx += 1

        combined_raw_text = "\n\n".join(raw_text_parts)
        estimated_pages = max(1, (len(combined_raw_text) // 2500) + 1)

        return {
            "page_count": estimated_pages,
            "raw_text": combined_raw_text,
            "is_scanned": False,
            "scanned_pages": [],
            "segments": segments
        }
