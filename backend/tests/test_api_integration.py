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

@pytest.mark.asyncio
async def test_create_amendment_demo_and_compare():
    await init_db()
    # 1. Create a base document
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), "ARTICLE 1. PAYMENT TERMS\nPayment is due in 30 days.\nARTICLE 2. LIABILITY\nLiability is capped at AED 500,000.")
    pdf_bytes = doc.tobytes()
    doc.close()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        files = {"file": ("baseline_agreement.pdf", pdf_bytes, "application/pdf")}
        res = await client.post("/api/v1/documents", files=files)
        assert res.status_code == 200
        base_id = res.json()["id"]

        # 2. Trigger create-amendment-demo
        demo_res = await client.post(f"/api/v1/documents/{base_id}/create-amendment-demo")
        assert demo_res.status_code == 200
        amended_doc = demo_res.json()
        assert amended_doc["status"] == "ready"
        assert "Amended" in amended_doc["filename"]
        target_id = amended_doc["id"]

        # 3. Compare baseline vs amended
        comp_res = await client.post("/api/v1/documents/compare", json={
            "base_document_id": base_id,
            "target_document_id": target_id
        })
        assert comp_res.status_code == 200
        comp_data = comp_res.json()
        assert comp_data["status"] == "ready"
        assert len(comp_data["items"]) > 0

        # 4. Test dynamic suggested questions
        q_res = await client.get(f"/api/v1/documents/{base_id}/suggested-questions")
        assert q_res.status_code == 200
        q_data = q_res.json()
        assert "questions" in q_data
        assert len(q_data["questions"]) >= 3

        # Cleanup
        await client.delete(f"/api/v1/documents/{base_id}")
        await client.delete(f"/api/v1/documents/{target_id}")


