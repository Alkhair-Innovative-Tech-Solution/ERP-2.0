FROM python:3.11-slim

WORKDIR /app

# Copy shared common utilities
COPY shared /app/shared

# Copy requirements
COPY api-gateway/requirements.txt .

# Install dependencies
RUN pip install --upgrade pip --default-timeout=1000 --retries 10 && \
    pip install --no-cache-dir --default-timeout=1000 --retries 10 -r requirements.txt

# Copy API Gateway code
COPY api-gateway .

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

