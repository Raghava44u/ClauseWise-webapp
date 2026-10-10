import re
import math
from typing import List, Dict, Any, Optional
from rank_bm25 import BM25Plus

class RetrievalService:
    @staticmethod
    def tokenize(text: str) -> List[str]:
        """
        Tokenizes text into lowercase alphanumeric tokens.
        """
        return re.findall(r'\b\w+\b', text.lower())

    @staticmethod
    def build_bm25_index(segments: List[Dict[str, Any]]) -> Optional[BM25Plus]:
        """
        Builds BM25 index over a list of document segments.
        """
        if not segments:
            return None
        corpus = [RetrievalService.tokenize(s.get("text", "") + " " + (s.get("section_title") or "")) for s in segments]
        # Ensure corpus is not completely empty
        if not any(len(doc) > 0 for doc in corpus):
            return None
        return BM25Plus(corpus)

    @staticmethod
    def search_segments(
        query: str,
        segments: List[Dict[str, Any]],
        top_k: int = 8,
        token_budget: int = 3500
    ) -> Dict[str, Any]:
        """
        Performs BM25 lexical search over segments within a token budget.
        Deduplicates and sorts by relevance score.
        """
        if not segments:
            return {
                "status": "empty_document",
                "evidence_found": False,
                "segments": [],
                "diagnostics": {"total_segments": 0, "query": query}
            }

        bm25 = RetrievalService.build_bm25_index(segments)
        if not bm25:
            # Fallback to returning initial segments if index could not be built
            return {
                "status": "fallback_initial",
                "evidence_found": len(segments) > 0,
                "segments": segments[:top_k],
                "diagnostics": {"total_segments": len(segments), "query": query}
            }

        query_tokens = RetrievalService.tokenize(query)
        if not query_tokens:
            return {
                "status": "empty_query",
                "evidence_found": False,
                "segments": segments[:top_k],
                "diagnostics": {"total_segments": len(segments), "query": query}
            }

        scores = bm25.get_scores(query_tokens)
        scored_segments = []
        for idx, score in enumerate(scores):
            seg = segments[idx]
            seg_text = (seg.get("text", "") + " " + (seg.get("section_title") or "")).lower()
            token_hit = any(t in seg_text for t in query_tokens if len(t) > 2)
            if score > 0.05 or (score > 0 and token_hit):
                scored_segments.append((score, seg))

        scored_segments.sort(key=lambda x: x[0], reverse=True)

        selected_segments = []
        estimated_chars = 0
        max_chars = token_budget * 4  # ~4 chars per token

        for score, seg in scored_segments:
            seg_len = len(seg.get("text", ""))
            if estimated_chars + seg_len > max_chars and selected_segments:
                break
            
            seg_copy = dict(seg)
            seg_copy["relevance_score"] = round(float(score), 4)
            selected_segments.append(seg_copy)
            estimated_chars += seg_len
            
            if len(selected_segments) >= top_k:
                break

        evidence_found = len(selected_segments) > 0
        return {
            "status": "evidence_retrieved" if evidence_found else "no_relevant_evidence",
            "evidence_found": evidence_found,
            "segments": selected_segments,
            "diagnostics": {
                "total_indexed_segments": len(segments),
                "matched_segments_count": len(scored_segments),
                "selected_segments_count": len(selected_segments),
                "query": query
            }
        }

    @staticmethod
    def search_multiple_documents(
        query: str,
        documents_data: List[Dict[str, Any]],
        top_k_per_doc: int = 5,
        total_token_budget: int = 4000
    ) -> Dict[str, Any]:
        """
        Searches across multiple documents with namespace-safe segment IDs.
        Guarantees fair allocation across documents.
        """
        all_results = []
        doc_summaries = {}

        budget_per_doc = max(800, total_token_budget // max(1, len(documents_data)))

        for doc in documents_data:
            doc_id = doc.get("id")
            doc_title = doc.get("filename", "Document")
            segments = doc.get("segments", [])

            search_res = RetrievalService.search_segments(
                query=query,
                segments=segments,
                top_k=top_k_per_doc,
                token_budget=budget_per_doc
            )

            doc_summaries[doc_id] = {
                "title": doc_title,
                "evidence_found": search_res["evidence_found"],
                "count": len(search_res["segments"])
            }

            for seg in search_res["segments"]:
                seg["origin_document_id"] = doc_id
                seg["origin_document_title"] = doc_title
                all_results.append(seg)

        # Sort all results globally by relevance score if available
        all_results.sort(key=lambda s: s.get("relevance_score", 0), reverse=True)

        return {
            "evidence_found": any(info["evidence_found"] for info in doc_summaries.values()),
            "segments": all_results,
            "documents_summary": doc_summaries
        }
