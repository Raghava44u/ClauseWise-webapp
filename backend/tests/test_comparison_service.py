import pytest
from backend.app.services.comparison_service import ComparisonService

def test_extract_numbers_and_currencies():
    text = "The liability is AED 100,000 for year 1, capped at 15% or $50,000 with 30 days notice."
    nums = ComparisonService.extract_numbers_and_currencies(text)
    assert any("AED 100,000" in n for n in nums)
    assert any("15%" in n for n in nums)
    assert any("$50,000" in n for n in nums)
    assert any("30 days" in n for n in nums)

def test_evaluate_significance_liability_numeric():
    sig = ComparisonService.evaluate_significance(
        clause_name="Limitation of Liability",
        orig_text="Liability is capped at AED 100,000.",
        rev_text="Liability is capped at AED 1,000,000.",
        has_numeric_diff=True
    )
    assert sig == "critical"

def test_evaluate_significance_non_critical():
    sig = ComparisonService.evaluate_significance(
        clause_name="Notices",
        orig_text="Notices shall be sent by email.",
        rev_text="Notices shall be sent by registered post.",
        has_numeric_diff=False
    )
    assert sig == "medium"

@pytest.mark.asyncio
async def test_compare_documents_detects_numeric_change():
    base_doc = {
        "id": "doc-1",
        "filename": "Agreement_v1.pdf",
        "raw_text": "Section 5. Limitation of Liability\nLiability is capped at AED 100,000.",
        "segments": [
            {
                "page_number": 1,
                "section_title": "Section 5. Limitation of Liability",
                "text": "Liability is capped at AED 100,000.",
                "start_offset": 35,
                "end_offset": 70
            }
        ]
    }
    target_doc = {
        "id": "doc-2",
        "filename": "Agreement_v2.pdf",
        "raw_text": "Section 5. Limitation of Liability\nLiability is capped at AED 1,000,000.",
        "segments": [
            {
                "page_number": 1,
                "section_title": "Section 5. Limitation of Liability",
                "text": "Liability is capped at AED 1,000,000.",
                "start_offset": 35,
                "end_offset": 72
            }
        ]
    }

    diff_res = await ComparisonService.compare_documents(base_doc, target_doc)
    assert diff_res["status"] == "ready"
    items = diff_res["items"]
    assert len(items) == 1
    item = items[0]
    assert item["change_type"] == "modified"
    assert item["is_numeric_change"] is True
    assert item["significance"] == "critical"
    assert "AED 100,000" in item["explanation"]
    assert "AED 1,000,000" in item["explanation"]
