import re
import unicodedata
from typing import List, Dict, Any, Optional, Tuple

class CitationService:
    @staticmethod
    def normalize_text_with_mapping(raw_text: str) -> Tuple[str, List[int]]:
        """
        Normalizes text while maintaining a direct character index mapping back to raw_text.
        - Collapses sequences of whitespace (\n, \r, \t, spaces, \xa0) into a single space.
        - Normalizes smart quotes and dashes.
        - Strips soft hyphens and zero-width spaces.
        Returns:
            (normalized_string, list_of_original_indices)
            where normalized_string[i] originated from raw_text[list_of_original_indices[i]]
        """
        norm_chars = []
        orig_indices = []
        
        # Replacement dictionary for unicode typographic variants (including Arabic quotes, tatweel, and marks)
        char_replacements = {
            '\u2018': "'", '\u2019': "'", '\u201a': "'", '\u201b': "'",
            '\u201c': '"', '\u201d': '"', '\u201e': '"', '\u201f': '"',
            '\u00ab': '"', '\u00bb': '"',  # Arabic / French quotes « »
            '\u2013': '-', '\u2014': '-', '\u2212': '-',
            '\u00a0': ' ', '\u200b': '', '\u00ad': '',  # non-breaking space, zero-width space, soft-hyphen
            '\u200e': '', '\u200f': '', '\u061c': '',  # LRM, RLM, ALM bidi marks
            '\u0640': '',  # Arabic tatweel / kashida elongation dash
            # Arabic tashkeel (diacritics: fatha, damma, kasra, shadda, sukun, tanween, dagger alif)
            '\u064b': '', '\u064c': '', '\u064d': '', '\u064e': '', '\u064f': '',
            '\u0650': '', '\u0651': '', '\u0652': '', '\u0670': '',
        }

        prev_is_space = True  # start true to strip leading whitespace
        raw_len = len(raw_text)
        
        for idx in range(raw_len):
            ch = raw_text[idx]
            
            # Map typographic characters
            if ch in char_replacements:
                ch = char_replacements[ch]
                
            if not ch:  # was stripped (e.g. soft hyphen)
                continue
                
            if ch.isspace():
                if not prev_is_space:
                    norm_chars.append(' ')
                    orig_indices.append(idx)
                    prev_is_space = True
            else:
                norm_chars.append(ch)
                orig_indices.append(idx)
                prev_is_space = False

        # Strip trailing space if any
        if norm_chars and norm_chars[-1] == ' ':
            norm_chars.pop()
            orig_indices.pop()

        return "".join(norm_chars), orig_indices

    @staticmethod
    def normalize_query_quote(quote: str) -> str:
        """
        Applies the exact same character transformations to a candidate quote string.
        """
        norm_str, _ = CitationService.normalize_text_with_mapping(quote)
        return norm_str

    @staticmethod
    def verify_quotation(
        candidate_quote: str,
        document_text: str,
        segments: Optional[List[Dict[str, Any]]] = None,
        page_hint: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Deterministically verifies if candidate_quote exists in document_text.
        Never trusts AI's self-reported page or offset.
        Finds exact or whitespace-normalized matches, handles repeated occurrences,
        maps to original document offsets and segments.
        """
        cleaned_quote = candidate_quote.strip().strip('"\'“”')
        # Reject empty quotes, single short words (e.g. 'the', 'and', 'for'), and strings under 5 characters
        if not cleaned_quote or len(cleaned_quote) < 5 or (len(cleaned_quote.split()) == 1 and len(cleaned_quote) < 7):
            return {
                "verified": False,
                "quote": candidate_quote,
                "reason": "Quotation is empty, too short, or too ambiguous to reliably verify",
                "confidence": 0.0,
                "start_offset": None,
                "end_offset": None,
                "page_number": None,
                "bbox": None
            }

        norm_doc, orig_indices = CitationService.normalize_text_with_mapping(document_text)
        norm_quote = CitationService.normalize_query_quote(cleaned_quote)

        if not norm_quote:
            return {
                "verified": False,
                "quote": candidate_quote,
                "reason": "Normalized quote is empty",
                "confidence": 0.0,
                "start_offset": None,
                "end_offset": None,
                "page_number": None,
                "bbox": None
            }

        # Find all occurrences of norm_quote in norm_doc (case-sensitive first, then case-insensitive)
        matches = []
        start_pos = 0
        while True:
            idx = norm_doc.find(norm_quote, start_pos)
            if idx == -1:
                break
            matches.append(idx)
            start_pos = idx + 1

        is_case_insensitive = False
        if not matches:
            # Fallback: case-insensitive exact substring search
            norm_doc_lower = norm_doc.lower()
            norm_quote_lower = norm_quote.lower()
            start_pos = 0
            while True:
                idx = norm_doc_lower.find(norm_quote_lower, start_pos)
                if idx == -1:
                    break
                matches.append(idx)
                start_pos = idx + 1
            if matches:
                is_case_insensitive = True

        if not matches:
            # Substring was not found in stored text -> hallucinated or paraphrased
            return {
                "verified": False,
                "quote": candidate_quote,
                "reason": "Quotation not found verbatim in document source text (hallucinated or modified)",
                "confidence": 0.0,
                "start_offset": None,
                "end_offset": None,
                "page_number": None,
                "bbox": None
            }

        # If multiple matches (repeated quote), pick the occurrence best matching page_hint or segment
        best_match_idx = matches[0]
        if len(matches) > 1 and page_hint and segments:
            min_dist = float("inf")
            for m_idx in matches:
                raw_start = orig_indices[m_idx]
                for seg in segments:
                    if seg.get("start_offset", 0) <= raw_start <= seg.get("end_offset", 0):
                        if seg.get("page_number") == page_hint:
                            best_match_idx = m_idx
                            min_dist = 0
                            break
                if min_dist == 0:
                    break

        # Map normalized bounds back to original document text indices
        norm_start = best_match_idx
        norm_end = best_match_idx + len(norm_quote) - 1

        orig_start = orig_indices[norm_start]
        orig_end = orig_indices[norm_end] + 1
        verbatim_text = document_text[orig_start:orig_end]

        # Determine page number and segment from segments list
        matched_page = None
        matched_bbox = None
        if segments:
            overlapping_pages = set()
            for seg in segments:
                s_start = seg.get("start_offset", 0)
                s_end = seg.get("end_offset", 0)
                # Check overlap
                if max(s_start, orig_start) < min(s_end, orig_end) or (s_start <= orig_start <= s_end):
                    p_num = seg.get("page_number")
                    if p_num:
                        overlapping_pages.add(p_num)
                    if not matched_bbox and seg.get("bbox"):
                        matched_bbox = seg.get("bbox")

            if overlapping_pages:
                sorted_pages = sorted(list(overlapping_pages))
                matched_page = sorted_pages[0] if len(sorted_pages) == 1 else f"{sorted_pages[0]}-{sorted_pages[-1]}"

        confidence = 0.95 if is_case_insensitive else 1.0

        return {
            "verified": True,
            "quote": verbatim_text,  # Return the true verbatim document text
            "start_offset": orig_start,
            "end_offset": orig_end,
            "page_number": matched_page or page_hint or 1,
            "bbox": matched_bbox,
            "confidence": confidence,
            "reason": "Exact match found in document text"
        }

    @staticmethod
    def extract_and_verify_citations(
        text_with_citations: str,
        document_text: str,
        document_id: str,
        document_title: str,
        segments: Optional[List[Dict[str, Any]]] = None
    ) -> List[Dict[str, Any]]:
        """
        Parses quotations from AI output (e.g., text enclosed in quotes or markdown blockquotes)
        and verifies each one against document text.
        """
        # Patterns to find candidate quotes: "...", “...”, or > ...
        patterns = [
            r'["“]([^"”]{10,500})["”]',
            r'>\s*([^\n]{10,500})'
        ]

        found_quotes = set()
        for pat in patterns:
            for match in re.finditer(pat, text_with_citations):
                q = match.group(1).strip()
                if len(q) >= 6:  # meaningful quote length
                    found_quotes.add(q)

        results = []
        for q in found_quotes:
            res = CitationService.verify_quotation(q, document_text, segments)
            res["document_id"] = document_id
            res["document_title"] = document_title
            results.append(res)

        return results
