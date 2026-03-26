"""
스토리지 백엔드 추상화

STORAGE_BACKEND 환경변수로 선택:
  local (기본값) — Docker 볼륨 + Nginx 직접 서빙
  r2             — Cloudflare R2 (추후 구현)

추가 백엔드 구현 시 StorageBackend를 상속하고
get_storage() 팩토리에 분기를 추가한다.
"""
import abc
import os

# 업로드 폴더 경로 (컨테이너 내부 절대경로)
UPLOAD_FOLDER: str = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")


class StorageBackend(abc.ABC):
    """파일 저장 백엔드 인터페이스."""

    @abc.abstractmethod
    def save(self, file_obj, unique_filename: str) -> str:
        """파일을 저장하고 공개 URL을 반환한다."""

    @abc.abstractmethod
    def delete(self, url: str) -> None:
        """URL에 해당하는 파일을 삭제한다."""

    def get_local_path(self, unique_filename: str) -> str | None:
        """로컬 파일 경로를 반환한다. 로컬 저장소가 아니면 None."""
        return None


class LocalStorage(StorageBackend):
    """Docker 볼륨에 저장, Nginx가 /uploads/ 경로로 서빙."""

    def __init__(self, upload_folder: str = UPLOAD_FOLDER) -> None:
        self.upload_folder = upload_folder

    def save(self, file_obj, unique_filename: str) -> str:
        os.makedirs(self.upload_folder, exist_ok=True)
        filepath = os.path.join(self.upload_folder, unique_filename)
        file_obj.save(filepath)
        return f"/uploads/{unique_filename}"

    def delete(self, url: str) -> None:
        if "/uploads/" in url:
            filename = url.split("/uploads/", 1)[-1]
            filepath = os.path.join(self.upload_folder, filename)
            if os.path.exists(filepath):
                os.remove(filepath)

    def get_local_path(self, unique_filename: str) -> str | None:
        return os.path.join(self.upload_folder, unique_filename)


def get_storage() -> StorageBackend:
    """STORAGE_BACKEND 환경변수에 따라 백엔드 인스턴스를 반환한다."""
    backend = os.environ.get("STORAGE_BACKEND", "local")
    if backend == "local":
        return LocalStorage()
    raise ValueError(
        f"지원하지 않는 STORAGE_BACKEND: '{backend}'. "
        "지원 값: local"
    )
