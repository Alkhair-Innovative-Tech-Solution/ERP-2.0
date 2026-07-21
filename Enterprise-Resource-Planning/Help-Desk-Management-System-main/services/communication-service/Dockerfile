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
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local
COPY src/ .

# Create a non-root user
RUN adduser --system --group django
RUN chown -R django:django /app
USER django

EXPOSE 8003

# Run migrations and start ASGI server
CMD ["sh", "-c", "python manage.py collectstatic --noinput && python manage.py migrate && daphne -b 0.0.0.0 -p 8003 core.asgi:application"]
