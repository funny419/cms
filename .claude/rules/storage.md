## 파일 스토리지 시스템

> **설치형 CMS 방침:** 스토리지 백엔드는 `STORAGE_BACKEND` 환경변수로 선택. 기본값 `local`.

### 현재 구현: Local (A방식)

- **파일 저장:** `/app/uploads/` (개발: `./backend/uploads/` 호스트 마운트, 프로덕션: `uploads_data` named volume)
- **URL 형식:** `/uploads/{uuid}_{filename}` (공개 URL로 DB `media.filepath`에 저장)
- **개발 환경:** `nginx-files` 컨테이너(nginx:alpine)가 `./backend/uploads/`를 읽기 전용 마운트 → `/uploads/` 서빙. Vite가 `/uploads/` 요청을 `nginx-files`로 프록시.
- **프로덕션:** Nginx가 `uploads_data` 볼륨을 `/uploads/` 경로로 직접 서빙 (Flask 불필요)
- **썸네일:** `/uploads/thumb_{uuid}_{filename}` (Pillow, 300×300). `Media.to_dict()`의 `thumbnail_url` 필드로 반환.
- **추상화 파일:** `backend/storage.py` — `StorageBackend` 추상 클래스, `LocalStorage`, `get_storage()` 팩토리

```
개발 파일 서빙 흐름:
  브라우저 → Vite(5173) → /uploads/* → nginx-files(내부80) → ./backend/uploads/

프로덕션 파일 서빙 흐름:
  브라우저 → Nginx(80) → /uploads/* → uploads_data 볼륨 직접 서빙
```

### 추후 구현 예정: Cloudflare R2 (B방식)

설치형 CMS에서 서버와 무관한 CDN 서빙이 필요한 경우 R2로 전환.

**구현 방법:**

1. `backend/storage.py`에 `R2Storage(StorageBackend)` 클래스 추가:
   ```python
   import boto3
   class R2Storage(StorageBackend):
       def __init__(self):
           self.client = boto3.client('s3',
               endpoint_url=f'https://{os.environ["R2_ACCOUNT_ID"]}.r2.cloudflarestorage.com',
               aws_access_key_id=os.environ["R2_ACCESS_KEY"],
               aws_secret_access_key=os.environ["R2_SECRET_KEY"],
           )
           self.bucket = os.environ["R2_BUCKET_NAME"]
           self.public_url = os.environ["R2_PUBLIC_URL"]  # e.g. https://cdn.example.com

       def save(self, file_obj, unique_filename: str) -> str:
           self.client.upload_fileobj(file_obj, self.bucket, unique_filename,
               ExtraArgs={"ContentType": file_obj.mimetype})
           return f"{self.public_url}/{unique_filename}"

       def delete(self, url: str) -> None:
           filename = url.split("/")[-1]
           self.client.delete_object(Bucket=self.bucket, Key=filename)
   ```

2. `get_storage()`에 분기 추가:
   ```python
   elif backend == "r2":
       return R2Storage()
   ```

3. 환경변수 추가 (`.env` / GitHub Secrets):
   ```
   STORAGE_BACKEND=r2
   R2_ACCOUNT_ID=...
   R2_ACCESS_KEY=...
   R2_SECRET_KEY=...
   R2_BUCKET_NAME=...
   R2_PUBLIC_URL=https://cdn.example.com
   ```

4. 썸네일: R2에서는 PIL이 로컬 파일을 직접 읽을 수 없으므로 `BytesIO` 방식 필요:
   ```python
   from io import BytesIO
   buf = BytesIO()
   img.thumbnail((300, 300))
   img.save(buf, format=img.format or 'JPEG')
   buf.seek(0)
   thumb_url = storage.save(buf, f"thumb_{unique_filename}")
   ```

**A↔B 전환 시 기존 데이터 마이그레이션 필요** — DB의 `media.filepath`에 저장된 URL이 다르므로 마이그레이션 스크립트 작성할 것.
