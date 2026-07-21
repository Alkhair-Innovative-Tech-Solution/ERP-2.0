"""
Structured logging configuration for course-service
"""
import logging
import sys
from pathlib import Path
from logging.handlers import RotatingFileHandler

# Create logs directory if it doesn't exist
LOG_DIR = Path(__file__).resolve().parent.parent.parent / 'logs'
LOG_DIR.mkdir(exist_ok=True)

# Log file paths
COURSE_LOG_FILE = LOG_DIR / 'course-service.log'
ERROR_LOG_FILE = LOG_DIR / 'course-service-errors.log'


def get_logger(name: str) -> logging.Logger:
    """
    Get a configured logger instance
    
    Args:
        name: Logger name (usually __name__)
        
    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)
    
    # Avoid adding handlers multiple times
    if logger.handlers:
        return logger
    
    logger.setLevel(logging.DEBUG)
    
    # Create formatters
    detailed_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    simple_formatter = logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Console handler (INFO and above)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(simple_formatter)
    logger.addHandler(console_handler)
    
    # File handler for all logs (DEBUG and above, rotating)
    file_handler = RotatingFileHandler(
        COURSE_LOG_FILE,
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(detailed_formatter)
    logger.addHandler(file_handler)
    
    # Error file handler (ERROR and above)
    error_handler = RotatingFileHandler(
        ERROR_LOG_FILE,
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(detailed_formatter)
    logger.addHandler(error_handler)
    
    return logger


def get_correlation_id(request) -> str:
    """
    Extract correlation ID from request headers or generate new one
    
    Args:
        request: Django request object
        
    Returns:
        Correlation ID string
    """
    correlation_id = request.META.get('HTTP_X_CORRELATION_ID')
    if not correlation_id:
        import uuid
        correlation_id = str(uuid.uuid4())
    return correlation_id


