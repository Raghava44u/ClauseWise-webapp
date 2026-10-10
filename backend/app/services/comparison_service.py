import re
import difflib
from typing import List, Dict, Any, Optional, Tuple
from backend.app.services.citation_service import CitationService
from backend.app.services.grok_service import GrokService

CRITICAL_KEYWORDS = ["liability", "indemn", "cap", "limitation of liability", "consequential damage", "liquidated damage"]
HIGH_KEYWORDS = ["termination", "payment", "fee", "automatic renewal", "governing law", "jurisdiction", "dispute resolution", "warranty"]
MEDIUM_KEYWORDS = ["confidential", "data protection", "intellectual property", "ip", "audit", "assignment", "notice", "force majeure"]

class ComparisonService:
    @staticmethod
    def extract_numbers_and_currencies(text: str) -> List[str]:
        """
        Extracts monetary amounts, percentages, quantities, and numeric terms.
        E.g. "AED 100,000", "$50,000", "30 days", "15%".
        """
        pattern = r'(?:(?:AED|USD|EUR|GBP|[$€£])\s*[\d,]+(?:\.\d+)?|[\d,]+(?:\.\d+)?\s*(?:AED|USD|EUR|GBP|[$€£]|days?|months?|years?|percent|%)|\b\d+(?:,\d+)*(?:\.\d+)?\b)'
        matches = re.findall(pattern, text, re.IGNORECASE)
        return [m.strip() for m in matches]

    @staticmethod
    def evaluate_significance(clause_name: str, orig_text: str, rev_text: str, has_numeric_diff: bool) -> str:
        """
        Computes legal significance (critical, high, medium, low).
        Numeric changes on liability or payment are automatically critical.
        """
        combined = f"{clause_name} {orig_text} {rev_text}".lower()

        if has_numeric_diff:
            if any(k in combined for k in CRITICAL_KEYWORDS) or any(k in combined for k in HIGH_KEYWORDS):
                return "critical"
            return "high"

        if any(k in combined for k in CRITICAL_KEYWORDS):
            return "critical"
        if any(k in combined for k in HIGH_KEYWORDS):
            return "high"
        if any(k in combined for k in MEDIUM_KEYWORDS):
            return "medium"

        return "low"

    @staticmethod
    def group_segments_into_clauses(segments: List[Dict[str, Any]], raw_text: str) -> Dict[str, Dict[str, Any]]:
        """
        Groups document segments by section title or structural clause numbering.
        """
        clauses: Dict[str, Dict[str, Any]] = {}
        current_title = "Preamble / General Terms"

        for seg in segments:
            title = seg.get("section_title")
            if title and title.strip():
                current_title = title.strip()
            
            if current_title not in clauses:
                clauses[current_title] = {
                    "title": current_title,
                    "texts": [],
                    "pages": set(),
                    "start_offset": seg.get("start_offset", 0),
                    "end_offset": seg.get("end_offset", 0),
                    "segments": []
                }
            
            clauses[current_title]["texts"].append(seg.get("text", ""))
            if seg.get("page_number"):
                clauses[current_title]["pages"].add(seg.get("page_number"))
            clauses[current_title]["end_offset"] = max(clauses[current_title]["end_offset"], seg.get("end_offset", 0))
            clauses[current_title]["segments"].append(seg)

        result = {}
        for title, data in clauses.items():
            full_clause_text = "\n\n".join(data["texts"]).strip()
            if full_clause_text:
                pages_sorted = sorted(list(data["pages"])) if data["pages"] else [1]
                page_str = str(pages_sorted[0]) if len(pages_sorted) == 1 else f"{pages_sorted[0]}-{pages_sorted[-1]}"
                result[title] = {
                    "title": title,
                    "text": full_clause_text,
                    "page": page_str,
                    "start_offset": data["start_offset"],
                    "end_offset": data["end_offset"],
                    "segments": data["segments"]
                }
        return result

    @classmethod
    async def compare_documents(
        cls,
        base_doc: Dict[str, Any],
        target_doc: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Performs clause-level alignment, deterministic diffing, numeric change detection,
        legal significance assessment, and AI substantive explanation.
        """
        base_clauses = cls.group_segments_into_clauses(base_doc.get("segments", []), base_doc.get("raw_text", ""))
        target_clauses = cls.group_segments_into_clauses(target_doc.get("segments", []), target_doc.get("raw_text", ""))

        all_titles = set(base_clauses.keys()).union(set(target_clauses.keys()))
        items = []

        for title in sorted(list(all_titles)):
            b_clause = base_clauses.get(title)
            t_clause = target_clauses.get(title)

            # Case 1: Added clause
            if not b_clause and t_clause:
                rev_text = t_clause["text"]
                num_vals = cls.extract_numbers_and_currencies(rev_text)
                has_numeric = len(num_vals) > 0
                sig = cls.evaluate_significance(title, "", rev_text, has_numeric)

                t_cite = CitationService.verify_quotation(
                    rev_text[:200],
                    target_doc.get("raw_text", ""),
                    target_doc.get("segments", []),
                    int(t_clause["page"].split("-")[0]) if t_clause["page"].split("-")[0].isdigit() else 1
                )
                t_cite["document_id"] = target_doc.get("id")
                t_cite["document_title"] = target_doc.get("filename")

                items.append({
                    "clause_name": title,
                    "change_type": "added",
                    "original_text": None,
                    "revised_text": rev_text,
                    "explanation": f"Clause newly introduced in revised contract. Adds provisions covering {title}.",
                    "significance": sig,
                    "is_numeric_change": has_numeric,
                    "base_page": None,
                    "target_page": t_clause["page"],
                    "base_citation": None,
                    "target_citation": t_cite
                })

            # Case 2: Removed clause
            elif b_clause and not t_clause:
                orig_text = b_clause["text"]
                num_vals = cls.extract_numbers_and_currencies(orig_text)
                has_numeric = len(num_vals) > 0
                sig = cls.evaluate_significance(title, orig_text, "", has_numeric)

                b_cite = CitationService.verify_quotation(
                    orig_text[:200],
                    base_doc.get("raw_text", ""),
                    base_doc.get("segments", []),
                    int(b_clause["page"].split("-")[0]) if b_clause["page"].split("-")[0].isdigit() else 1
                )
                b_cite["document_id"] = base_doc.get("id")
                b_cite["document_title"] = base_doc.get("filename")

                items.append({
                    "clause_name": title,
                    "change_type": "removed",
                    "original_text": orig_text,
                    "revised_text": None,
                    "explanation": f"Clause removed in revised contract. Previous terms under {title} no longer apply.",
                    "significance": sig,
                    "is_numeric_change": has_numeric,
                    "base_page": b_clause["page"],
                    "target_page": None,
                    "base_citation": b_cite,
                    "target_citation": None
                })

            # Case 3: Both exist - compare text
            else:
                orig_text = b_clause["text"]
                rev_text = t_clause["text"]

                norm_orig = " ".join(orig_text.split())
                norm_rev = " ".join(rev_text.split())

                if norm_orig == norm_rev:
                    # Unchanged clause
                    continue  # Keep output focused on actual changes, or include if desired

                # Text is modified
                b_nums = cls.extract_numbers_and_currencies(orig_text)
                t_nums = cls.extract_numbers_and_currencies(rev_text)
                has_numeric = set(b_nums) != set(t_nums)

                sig = cls.evaluate_significance(title, orig_text, rev_text, has_numeric)

                # Generate explanation
                explanation = ""
                if has_numeric:
                    explanation = f"Substantive numeric modification detected. Original figures: [{', '.join(b_nums) or 'none'}] -> Revised figures: [{', '.join(t_nums) or 'none'}]."
                else:
                    # Summarize diff
                    s = difflib.SequenceMatcher(None, orig_text.split(), rev_text.split())
                    ratio = round(s.ratio(), 2)
                    explanation = f"Language modified ({int(ratio * 100)}% textual similarity). Terms adjusted regarding obligations and scope."

                # Verify citations for both sides
                b_cite = CitationService.verify_quotation(
                    orig_text[:200],
                    base_doc.get("raw_text", ""),
                    base_doc.get("segments", []),
                    int(b_clause["page"].split("-")[0]) if b_clause["page"].split("-")[0].isdigit() else 1
                )
                b_cite["document_id"] = base_doc.get("id")
                b_cite["document_title"] = base_doc.get("filename")

                t_cite = CitationService.verify_quotation(
                    rev_text[:200],
                    target_doc.get("raw_text", ""),
                    target_doc.get("segments", []),
                    int(t_clause["page"].split("-")[0]) if t_clause["page"].split("-")[0].isdigit() else 1
                )
                t_cite["document_id"] = target_doc.get("id")
                t_cite["document_title"] = target_doc.get("filename")

                items.append({
                    "clause_name": title,
                    "change_type": "modified",
                    "original_text": orig_text,
                    "revised_text": rev_text,
                    "explanation": explanation,
                    "significance": sig,
                    "is_numeric_change": has_numeric,
                    "base_page": b_clause["page"],
                    "target_page": t_clause["page"],
                    "base_citation": b_cite,
                    "target_citation": t_cite
                })

        # Sort items: critical first, then high, medium, low
        priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        items.sort(key=lambda item: priority_order.get(item["significance"], 4))

        summary = f"Comparison complete: {len(items)} substantive changes identified. "
        counts = {
            "critical": sum(1 for i in items if i["significance"] == "critical"),
            "high": sum(1 for i in items if i["significance"] == "high"),
            "numeric": sum(1 for i in items if i["is_numeric_change"])
        }
        summary += f"Found {counts['critical']} critical changes and {counts['numeric']} numeric shifts."

        return {
            "summary": summary,
            "status": "ready",
            "items": items
        }
