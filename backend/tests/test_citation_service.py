import pytest
from backend.app.services.citation_service import CitationService

SAMPLE_CONTRACT_TEXT = (
    "ARTICLE 8. LIMITATION OF LIABILITY\n\n"
    "8.1 In no event shall either party's aggregate liability arising out of or related to this "
    "Agreement exceed the amount of AED 100,000 paid by Customer hereunder.\n\n"
    "8.2 Neither party shall be liable for any indirect, incidental, special, or consequential damages, "
    "including lost profits, even if advised of the possibility thereof.\n\n"
    "ARTICLE 9. TERMINATION\n\n"
    "9.1 Either party may terminate this Agreement upon thirty (30) days prior written notice."
)

SAMPLE_SEGMENTS = [
    {
        "page_number": 1,
        "section_title": "ARTICLE 8. LIMITATION OF LIABILITY",
        "text": "8.1 In no event shall either party's aggregate liability arising out of or related to this Agreement exceed the amount of AED 100,000 paid by Customer hereunder.",
        "start_offset": 36,
        "end_offset": 194
    },
    {
        "page_number": 1,
        "section_title": "ARTICLE 8. LIMITATION OF LIABILITY",
        "text": "8.2 Neither party shall be liable for any indirect, incidental, special, or consequential damages, including lost profits, even if advised of the possibility thereof.",
        "start_offset": 196,
        "end_offset": 360
    },
    {
        "page_number": 2,
        "section_title": "ARTICLE 9. TERMINATION",
        "text": "9.1 Either party may terminate this Agreement upon thirty (30) days prior written notice.",
        "start_offset": 385,
        "end_offset": 473
    }
]

def test_normalize_text_collapses_whitespace():
    raw = "Liability\n\nshall   not\texceed\xa0AED 100,000."
    norm, mapping = CitationService.normalize_text_with_mapping(raw)
    assert norm == 'Liability shall not exceed AED 100,000.'
    assert len(norm) == len(mapping)

def test_normalize_typographic_quotes_and_dashes():
    raw = '“Agreement”—neither party’s fault.'
    norm, mapping = CitationService.normalize_text_with_mapping(raw)
    assert norm == '"Agreement"-neither party\'s fault.'

def test_exact_quote_verification_success():
    candidate = "exceed the amount of AED 100,000 paid by Customer hereunder."
    res = CitationService.verify_quotation(candidate, SAMPLE_CONTRACT_TEXT, SAMPLE_SEGMENTS)
    
    assert res["verified"] is True
    assert res["confidence"] == 1.0
    assert res["page_number"] == 1
    assert res["start_offset"] is not None
    assert res["end_offset"] is not None
    # Verify verbatim slice from document matches
    matched_slice = SAMPLE_CONTRACT_TEXT[res["start_offset"]:res["end_offset"]]
    assert "AED 100,000" in matched_slice

def test_quote_with_newlines_and_spaces_verification():
    # Candidate with different line breaks and spacing than document
    candidate = "In  no event   shall either party's aggregate liability\narising out of or related to this Agreement"
    res = CitationService.verify_quotation(candidate, SAMPLE_CONTRACT_TEXT, SAMPLE_SEGMENTS)
    
    assert res["verified"] is True
    assert res["page_number"] == 1
    assert "In no event shall either party's aggregate liability" in res["quote"]

def test_fabricated_quote_rejection():
    # Paraphrased or completely hallucinated quote
    candidate = "The total liability shall be strictly capped at 50,000 USD under all circumstances."
    res = CitationService.verify_quotation(candidate, SAMPLE_CONTRACT_TEXT, SAMPLE_SEGMENTS)
    
    assert res["verified"] is False
    assert res["confidence"] == 0.0
    assert "not found verbatim" in res["reason"]

def test_repeated_quote_disambiguation():
    doc_with_repeats = (
        "Section 1. Notice.\nAny notice shall be in writing.\n\n"
        "Section 2. Miscellaneous.\nAny notice shall be in writing."
    )
    segments = [
        {"page_number": 1, "text": "Any notice shall be in writing.", "start_offset": 19, "end_offset": 50},
        {"page_number": 5, "text": "Any notice shall be in writing.", "start_offset": 78, "end_offset": 109}
    ]
    
    # Target occurrence on page 5 with page_hint
    res = CitationService.verify_quotation("Any notice shall be in writing.", doc_with_repeats, segments, page_hint=5)
    assert res["verified"] is True
    assert res["page_number"] == 5

def test_short_empty_quote_rejection():
    res_empty = CitationService.verify_quotation("   ", SAMPLE_CONTRACT_TEXT)
    assert res_empty["verified"] is False
    
    res_short = CitationService.verify_quotation("the", SAMPLE_CONTRACT_TEXT)
    assert res_short["verified"] is False
