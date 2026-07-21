"""
Shared logging configuration for all Django services.

Provides standardized logging setup with structured text format
for consistent log output across all microservices.
"""


def get_logging_config():
    """
    Get standardized logging configuration dictionary.
    
    Returns:
        Dictionary compatible with Django's LOGGING setting
        
    Example:
        LOGGING = get_logging_config()
    """
    return {
        'version': 1,
        'disable_existing_loggers': False,
        'formatters': {
            'verbose': {
                'format': '{levelname} {asctime} {module} {message}',
                'style': '{',
            },
        },
        'handlers': {
            'console': {
                'class': 'logging.StreamHandler',
                'formatter': 'verbose',
            },
        },
        'root': {
            'handlers': ['console'],
            'level': 'INFO',
        },
        'loggers': {
            'django': {
                'handlers': ['console'],
                'level': 'INFO',
                'propagate': False,
            },
            'apps': {
                'handlers': ['console'],
                'level': 'DEBUG',  # Override in dev.py (DEBUG) or prod.py (INFO)
                'propagate': False,
            },
        },
    }

