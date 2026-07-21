# Stage 1: Build
FROM python:3.12-slim AS builder

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Stage 2: Production
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONPATH="/shared:/shared/apps"

RUN apt-get update && apt-get install -y \
    libpq5 \
    postgresql-client \
    curl \
    clamav \
    clamav-daemon \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local
COPY src/ .

# Create media directory and set permissions
RUN mkdir -p /app/media/uploads /app/media/temp

# Create a non-root user
RUN adduser --system --group django
RUN chown -R django:django /app
USER django

EXPOSE 8005

# Use Gunicorn for production
CMD ["sh", "-c", "python manage.py migrate && gunicorn --bind 0.0.0.0:8005 --workers 3 core.wsgi:application"]


