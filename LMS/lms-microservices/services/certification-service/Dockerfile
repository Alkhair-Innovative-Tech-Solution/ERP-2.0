FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy shared common utilities
COPY shared /app/shared

# Copy requirements
COPY services/certification-service/requirements.txt .

# Install Python dependencies
RUN pip install --upgrade pip --default-timeout=1000 --retries 10 && \
    pip install --no-cache-dir --default-timeout=1000 --retries 10 -r requirements.txt

# Copy application code
COPY services/certification-service .

# Expose port
EXPOSE 8004

# Run migrations and start server using Python startup script
CMD ["python", "start.py"]

