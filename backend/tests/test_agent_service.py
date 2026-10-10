import pytest
from backend.app.services.agent_service import AgentService

SAMPLE_DOCS = [
    {
        "id": "doc-test-1",
        "filename": "Service_Agreement.pdf",
        "page_count": 5,
        "file_type": "pdf",
        "is_scanned": False,
        "ocr_applied": False,
        "raw_text": "Clause 1. Term and Termination\nThis Agreement shall continue for 12 months.",
        "segments": [
            {
                "page_number": 1,
                "section_title": "Clause 1. Term and Termination",
                "text": "This Agreement shall continue for 12 months.",
                "start_offset": 31,
                "end_offset": 75
            }
        ]
    }
]

def test_execute_get_document_overview():
    res = AgentService.execute_tool("get_document_overview", {}, SAMPLE_DOCS)
    assert "Retrieved overview for 1 document" in res["summary"]
    data = res["data"][0]
    assert data["document_id"] == "doc-test-1"
    assert data["page_count"] == 5

def test_execute_list_clauses():
    res = AgentService.execute_tool("list_clauses", {}, SAMPLE_DOCS)
    assert res["data"] is not None
    clauses = res["data"][0]["clauses"]
    assert len(clauses) == 1
    assert clauses[0]["title"] == "Clause 1. Term and Termination"
    assert clauses[0]["page"] == 1

def test_execute_search_document():
    res = AgentService.execute_tool("search_document", {"query": "termination"}, SAMPLE_DOCS)
    assert len(res["data"]) > 0
    assert "This Agreement shall continue for 12 months." in res["data"][0]["excerpt"]

def test_execute_unknown_tool():
    res = AgentService.execute_tool("malformed_fake_tool", {}, SAMPLE_DOCS)
    assert "Unknown tool name" in res["summary"]
    assert res["data"] is None
