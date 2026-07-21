FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY services/org-service/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY services/org-service/ /app/
COPY shared/ /app/shared/

RUN chmod +x /app/start.sh 2>/dev/null || true

EXPOSE 8007

CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py runserver 0.0.0.0:8007"]
