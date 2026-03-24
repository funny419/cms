# Base image for both dev and prod
FROM python:3.11-slim

WORKDIR /app

# Prevent python from writing .pyc files
ENV PYTHONDONTWRITEBYTECODE 1
# Keep python from buffering stdout and stderr
ENV PYTHONUNBUFFERED 1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# CMD는 docker-compose에서 서비스별로 지정 (dev: flask run, prod: gunicorn)