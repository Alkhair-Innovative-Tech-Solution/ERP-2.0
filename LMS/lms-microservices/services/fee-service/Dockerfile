FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY services/fee-service/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY services/fee-service/ /app/
COPY shared/ /app/shared/

EXPOSE 8008

CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py runserver 0.0.0.0:8008"]
