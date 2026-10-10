import io
import pytest
import fitz
from backend.app.services.pdf_service import PDFService
from backend.app.services.document_service import DocumentService

def test_sanitize_filename():
    assert DocumentService.sanitize_filename("contract (v2) final!.pdf") == "contract__v2__final_.pdf"
    assert DocumentService.sanitize_filename("../../../etc/passwd") == ".._.._.._etc_passwd"

def test_pdf_service_extracts_digital_text(tmp_path):
    # Create synthetic digital PDF
    pdf_path = tmp_path / "digital_contract.pdf"
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), "ARTICLE 1. CONFIDENTIALITY\nBoth parties agree to protect proprietary materials.")
    doc.save(str(pdf_path))
    doc.close()

    data = PDFService.extract_pdf_data(str(pdf_path))
    assert data["page_count"] == 1
    assert data["is_scanned"] is False
    assert len(data["scanned_pages"]) == 0
    assert "ARTICLE 1. CONFIDENTIALITY" in data["raw_text"]
    assert len(data["pages"][0]["segments"]) > 0

def test_pdf_service_detects_scanned_page(tmp_path):
    # Create synthetic scanned PDF (empty page or page with only an image)
    pdf_path = tmp_path / "scanned_contract.pdf"
    doc = fitz.open()
    page = doc.new_page()
    # No text inserted
    doc.save(str(pdf_path))
    doc.close()

    data = PDFService.extract_pdf_data(str(pdf_path))
    assert data["page_count"] == 1
    assert data["is_scanned"] is True
    assert 1 in data["scanned_pages"]
