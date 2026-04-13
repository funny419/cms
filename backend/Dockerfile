# Base image for both dev and prod
FROM python:3.11-slim

WORKDIR /app

# Prevent python from writing .pyc files
ENV PYTHONDONTWRITEBYTECODE 1
# Keep python from buffering stdout and stderr
ENV PYTHONUNBUFFERED 1

RUN apt-get update && apt-get install -y libmagic1 curl && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# 비권한 사용자 생성 + /app 소유권 이전 (uploads/ 쓰기 권한 포함)
RUN adduser --disabled-password --gecos '' appuser && \
    chown -R appuser:appuser /app
USER appuser

# CMD는 docker-compose에서 서비스별로 지정 (dev: flask run, prod: gunicorn)