"""
HTTP client wrapper for inter-service communication
Includes retry logic, timeout, and error handling
"""
import requests
import logging
from typing import Optional, Dict, Any
from time import sleep
from .exceptions import ServiceUnavailable

logger = logging.getLogger(__name__)


class ServiceClient:
    """
    HTTP client for inter-service communication with retry logic
    """
    
    def __init__(
        self,
        base_url: str,
        timeout: int = 5,
        max_retries: int = 3,
        retry_delay: float = 1.0,
        headers: Optional[Dict[str, str]] = None
    ):
        """
        Initialize service client
        
        Args:
            base_url: Base URL of the target service
            timeout: Request timeout in seconds
            max_retries: Maximum number of retry attempts
            retry_delay: Delay between retries in seconds
            headers: Default headers to include in all requests
        """
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.headers = headers or {}
        self.session = requests.Session()
        self.session.headers.update(self.headers)
    
    def _make_request(
        self,
        method: str,
        endpoint: str,
        **kwargs
    ) -> requests.Response:
        """
        Make HTTP request with retry logic
        
        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint (without base URL)
            **kwargs: Additional arguments for requests
            
        Returns:
            Response object
            
        Raises:
            ServiceUnavailable: If service is unavailable after retries
        """
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        last_exception = None
        
        for attempt in range(self.max_retries):
            try:
                logger.debug(f"Making {method} request to {url} (attempt {attempt + 1}/{self.max_retries})")
                
                response = self.session.request(
                    method=method,
                    url=url,
                    timeout=self.timeout,
                    **kwargs
                )
                
                # Log response
                logger.debug(
                    f"Response from {url}: {response.status_code} "
                    f"(attempt {attempt + 1}/{self.max_retries})"
                )
                
                # Return response if successful or client error (4xx)
                if response.status_code < 500:
                    return response
                
                # Server error (5xx) - retry
                logger.warning(
                    f"Server error {response.status_code} from {url}, "
                    f"retrying... (attempt {attempt + 1}/{self.max_retries})"
                )
                
            except requests.exceptions.Timeout as e:
                last_exception = e
                logger.warning(
                    f"Timeout connecting to {url}, "
                    f"retrying... (attempt {attempt + 1}/{self.max_retries})"
                )
            except requests.exceptions.ConnectionError as e:
                last_exception = e
                logger.warning(
                    f"Connection error to {url}, "
                    f"retrying... (attempt {attempt + 1}/{self.max_retries})"
                )
            except requests.exceptions.RequestException as e:
                last_exception = e
                logger.error(f"Request error to {url}: {e}", exc_info=True)
                # Don't retry on client errors (4xx)
                if hasattr(e, 'response') and e.response and e.response.status_code < 500:
                    raise
            
            # Wait before retry (exponential backoff)
            if attempt < self.max_retries - 1:
                sleep(self.retry_delay * (2 ** attempt))
        
        # All retries exhausted
        error_msg = f"Service unavailable: {url} (after {self.max_retries} attempts)"
        logger.error(error_msg)
        raise ServiceUnavailable(error_msg)
    
    def get(self, endpoint: str, **kwargs) -> requests.Response:
        """Make GET request"""
        return self._make_request('GET', endpoint, **kwargs)
    
    def post(self, endpoint: str, **kwargs) -> requests.Response:
        """Make POST request"""
        return self._make_request('POST', endpoint, **kwargs)
    
    def put(self, endpoint: str, **kwargs) -> requests.Response:
        """Make PUT request"""
        return self._make_request('PUT', endpoint, **kwargs)
    
    def patch(self, endpoint: str, **kwargs) -> requests.Response:
        """Make PATCH request"""
        return self._make_request('PATCH', endpoint, **kwargs)
    
    def delete(self, endpoint: str, **kwargs) -> requests.Response:
        """Make DELETE request"""
        return self._make_request('DELETE', endpoint, **kwargs)
    
    def set_auth_token(self, token: str):
        """
        Set authorization token for all requests
        
        Args:
            token: JWT token
        """
        self.session.headers.update({'Authorization': f'Bearer {token}'})
    
    def clear_auth_token(self):
        """Remove authorization token"""
        self.session.headers.pop('Authorization', None)
