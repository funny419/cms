"""POST /api/media — MIME magic bytes 검증 테스트 (#4)
GET /api/media — admin/editor 조회 정책 테스트 (#9)
"""

import io


def _make_jpeg() -> bytes:
    """최소 유효 JPEG 바이트 생성 (1×1 px)."""
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (1, 1)).save(buf, format="JPEG")
    return buf.getvalue()


def _make_png() -> bytes:
    """최소 유효 PNG 바이트 생성 (1×1 px)."""
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (1, 1)).save(buf, format="PNG")
    return buf.getvalue()


def _upload(client, headers, content: bytes, filename: str) -> object:
    """공통 업로드 헬퍼."""
    return client.post(
        "/api/media",
        data={"file": (io.BytesIO(content), filename)},
        content_type="multipart/form-data",
        headers=headers,
    )


# ─── #4 MIME magic bytes 검증 ─────────────────────────────────────────────────


class TestMimeValidation:
    """magic bytes 검증으로 확장자 위조 파일 차단."""

    def test_valid_jpeg_upload_201(self, client, editor_headers):
        """정상 JPEG 파일 업로드 → 201."""
        res = _upload(client, editor_headers, _make_jpeg(), "photo.jpg")
        assert res.status_code == 201
        assert res.get_json()["success"] is True

    def test_valid_png_upload_201(self, client, editor_headers):
        """정상 PNG 파일 업로드 → 201."""
        res = _upload(client, editor_headers, _make_png(), "image.png")
        assert res.status_code == 201
        assert res.get_json()["success"] is True

    def test_plaintext_disguised_as_jpg_400(self, client, editor_headers):
        """텍스트 내용 + .jpg 확장자 → magic bytes 불일치 → 400."""
        fake_content = b"This is plaintext content disguised as a JPEG file."
        res = _upload(client, editor_headers, fake_content, "evil.jpg")
        assert res.status_code == 400
        assert "허용되지 않는 파일 형식" in res.get_json()["error"]

    def test_disallowed_extension_400(self, client, editor_headers):
        """허용되지 않는 확장자(.txt) → 확장자 검사 단계에서 400."""
        res = _upload(client, editor_headers, b"some content", "script.txt")
        assert res.status_code == 400

    def test_unauthenticated_upload_401(self, client):
        """미인증 업로드 → 401."""
        res = _upload(client, {}, _make_jpeg(), "photo.jpg")
        assert res.status_code == 401


# ─── #9 GET /api/media 조회 권한 분리 ─────────────────────────────────────────


class TestMediaListPolicy:
    """admin=전체 조회, editor=본인 업로드만 조회."""

    def test_editor_sees_only_own_media(self, client, editor_headers, admin_headers):
        """editor 조회 → 본인이 업로드한 파일만 반환."""
        # admin 업로드
        _upload(client, admin_headers, _make_jpeg(), "admin_photo.jpg")
        # editor 업로드
        _upload(client, editor_headers, _make_png(), "editor_photo.png")

        res = client.get("/api/media", headers=editor_headers)
        assert res.status_code == 200
        items = res.get_json()["data"]
        assert len(items) == 1
        assert items[0]["filename"] == "editor_photo.png"

    def test_admin_sees_all_media(self, client, editor_headers, admin_headers):
        """admin 조회 → 모든 업로드 파일 반환."""
        _upload(client, editor_headers, _make_jpeg(), "e_photo.jpg")
        _upload(client, admin_headers, _make_png(), "a_photo.png")

        res = client.get("/api/media", headers=admin_headers)
        assert res.status_code == 200
        assert len(res.get_json()["data"]) == 2
