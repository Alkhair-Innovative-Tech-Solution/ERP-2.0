"""
Structured logging configuration for certification service
"""
import logging
import os
from logging.handlers import RotatingFileHandler
from pathlib import Path

# Create logs directory if it doesn't exist
LOG_DIR = Path(__file__).resolve().parent.parent.parent / 'logs'
LOG_DIR.mkdir(exist_ok=True)

# Configure root logger
logger = logging.getLogger('certifications')
logger.setLevel(logging.DEBUG if os.getenv('DEBUG', 'False').lower() == 'true' else logging.INFO)

# Prevent duplicate handlers
if not logger.handlers:
    # File handler (rotating)
    file_handler = RotatingFileHandler(
        LOG_DIR / 'certification-service.log',
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5
    )
    file_handler.setLevel(logging.DEBUG)
    file_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    file_handler.setFormatter(file_formatter)
    logger.addHandler(file_handler)
    
    # Error file handler
    error_handler = RotatingFileHandler(
        LOG_DIR / 'certification-service-errors.log',
        maxBytes=10 * 1024 * 1024,
        backupCount=5
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(file_formatter)
    logger.addHandler(error_handler)
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_formatter = logging.Formatter(
        '%(levelname)s - %(message)s'
    )
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)

