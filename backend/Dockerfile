# Base image for both dev and prod
FROM python:3.11-slim

WORKDIR /app

# Prevent python from writing .pyc files
ENV PYTHONDONTWRITEBYTECODE 1
# Keep python from buffering stdout and stderr
ENV PYTHONUNBUFFERED 1

COPY requirements.txt .
# Add gunicorn for production
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir gunicorn

COPY . .

# The command (flask run vs gunicorn) will be specified in docker-compose