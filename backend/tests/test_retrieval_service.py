import pytest
from backend.app.services.retrieval_service import RetrievalService

SAMPLE_SEGMENTS = [
    {
        "id": "seg-1",
        "page_number": 1,
        "section_title": "Definitions",
        "text": "'Confidential Information' means any proprietary data disclosed by either party.",
        "start_offset": 0,
        "end_offset": 80
    },
    {
        "id": "seg-2",
        "page_number": 2,
        "section_title": "Indemnification",
        "text": "Provider shall defend and indemnify Customer against any third-party intellectual property claims.",
        "start_offset": 82,
        "end_offset": 180
    },
    {
        "id": "seg-3",
        "page_number": 3,
        "section_title": "Limitation of Liability",
        "text": "The aggregate liability under this agreement shall never exceed AED 500,000.",
        "start_offset": 182,
        "end_offset": 258
    }
]

def test_tokenize():
    tokens = RetrievalService.tokenize("Indemnification & IP claims in Clause 4!")
    assert "indemnification" in tokens
    assert "ip" in tokens
    assert "claims" in tokens
    assert "clause" in tokens
    assert "4" in tokens

def test_search_segments_finds_relevant_clause():
    res = RetrievalService.search_segments(
        query="what is the liability cap limit?",
        segments=SAMPLE_SEGMENTS,
        top_k=2
    )
    assert res["evidence_found"] is True
    assert res["status"] == "evidence_retrieved"
    top_seg = res["segments"][0]
    assert "Limitation of Liability" in top_seg["section_title"]
    assert "AED 500,000" in top_seg["text"]

def test_search_segments_unmatched_query():
    res = RetrievalService.search_segments(
        query="nuclear submarine maritime jurisdiction clause",
        segments=SAMPLE_SEGMENTS,
        top_k=2
    )
    # Correctly distinguishes absence of matches without crashing
    assert res["evidence_found"] is False
    assert res["status"] == "no_relevant_evidence"

def test_search_multiple_documents():
    docs_data = [
        {"id": "doc-a", "filename": "Contract A.pdf", "segments": [SAMPLE_SEGMENTS[0]]},
        {"id": "doc-b", "filename": "Contract B.pdf", "segments": [SAMPLE_SEGMENTS[2]]}
    ]
    res = RetrievalService.search_multiple_documents(
        query="liability limit",
        documents_data=docs_data
    )
    assert res["evidence_found"] is True
    top_result = res["segments"][0]
    assert top_result["origin_document_id"] == "doc-b"
    assert top_result["origin_document_title"] == "Contract B.pdf"
