# Python 3.9 슬림 이미지 사용
FROM python:3.9-slim

# 작업 디렉토리 설정
WORKDIR /app

# 의존성 파일 복사 및 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 소스 코드 복사
COPY . .

# Flask 환경 변수 설정 (docker-compose에서 오버라이드 가능)
ENV FLASK_APP=app.py
ENV FLASK_RUN_HOST=0.0.0.0
ENV FLASK_RUN_PORT=5000

# 포트 노출
EXPOSE 5000

# 실행 명령
CMD ["flask", "run"]