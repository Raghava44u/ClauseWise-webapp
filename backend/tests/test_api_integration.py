import pytest
from httpx import AsyncClient, ASGITransport
import fitz
from backend.app.main import app
from backend.app.core.database import init_db

@pytest.mark.asyncio
async def test_health_endpoint():
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "healthy"
        assert "ClauseWise" in data["service"]
        assert "ocr" in data
        assert "ai" in data

@pytest.mark.asyncio
async def test_upload_and_process_pdf_document():
    await init_db()
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), "ARTICLE 12. GOVERNING LAW\nThis Agreement is governed by the laws of DIFC.")
    pdf_bytes = doc.tobytes()
    doc.close()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        files = {"file": ("test_contract.pdf", pdf_bytes, "application/pdf")}
        res = await client.post("/api/v1/documents", files=files)
        assert res.status_code == 200
        doc_data = res.json()
        assert doc_data["status"] == "ready"
        assert doc_data["filename"] == "test_contract.pdf"
        doc_id = doc_data["id"]

        # Fetch detail
        detail_res = await client.get(f"/api/v1/documents/{doc_id}")
        assert detail_res.status_code == 200
        assert "GOVERNING LAW" in detail_res.json()["raw_text"]

        # Fetch clauses
        clauses_res = await client.get(f"/api/v1/documents/{doc_id}/clauses")
        assert clauses_res.status_code == 200
        assert len(clauses_res.json()) > 0

        # Create conversation
        conv_res = await client.post("/api/v1/conversations", json={
            "title": "Test Chat",
            "document_id": doc_id
        })
        assert conv_res.status_code == 200
        conv_id = conv_res.json()["id"]

        # Cleanup: delete doc
        del_res = await client.delete(f"/api/v1/documents/{doc_id}")
        assert del_res.status_code == 200

@pytest.mark.asyncio
async def test_reject_unsupported_file_extension():
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        files = {"file": ("malicious.exe", b"binary content", "application/octet-stream")}
        res = await client.post("/api/v1/documents", files=files)
        assert res.status_code == 400
        assert "Unsupported file format" in res.json()["detail"]
