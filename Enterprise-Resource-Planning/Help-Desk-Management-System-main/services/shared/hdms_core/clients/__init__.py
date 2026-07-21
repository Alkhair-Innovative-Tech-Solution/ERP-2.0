"""
Shared HTTP client utilities for inter-service communication.

Provides a generic HTTP client with authentication, timeout, retry logic,
and error handling for consistent inter-service communication.
"""
import json
from typing import Optional, Dict, Any, Union
from urllib3.util.retry import Retry
from requests.adapters import HTTPAdapter
import requests


class HTTPClient:
    """
    Generic HTTP client for inter-service communication.
    
    Features:
    - Default timeout: 5 seconds
    - Default retry attempts: 3 with exponential backoff
    - Automatic token retrieval from settings
    - Consistent error handling
    """
    
    default_timeout = 5
    default_retry_attempts = 3
    default_backoff_factor = 0.5
    
    def __init__(self):
        """Initialize HTTP client with retry adapter."""
        self.session = requests.Session()
        # Configure retry strategy
        retry_strategy = Retry(
            total=self.default_retry_attempts,
            backoff_factor=self.default_backoff_factor,
            status_forcelist=[500, 502, 503, 504],  # Retry on server errors
            allowed_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
    
    def _get_token(self, token: Optional[str] = None) -> Optional[str]:
        """
        Get authentication token from parameter or settings.
        
        Args:
            token: Optional token parameter
            
        Returns:
            Token string or None
        """
        if token:
            return token
        
        # Try to get token from Django settings (lazy import to avoid circular dependencies)
        try:
            from django.conf import settings
            return getattr(settings, 'SERVICE_AUTH_TOKEN', None) or getattr(settings, 'AUTH_TOKEN', None)
        except Exception:
            # Django not configured yet
            return None
    
    def _get_headers(self, token: Optional[str] = None, **kwargs) -> Dict[str, str]:
        """
        Build request headers with authentication.
        
        Args:
            token: Optional authentication token
            **kwargs: Additional headers from kwargs
            
        Returns:
            Dictionary of headers
        """
        headers = kwargs.get('headers', {}).copy()
        
        # Add authentication token if available
        auth_token = self._get_token(token)
        if auth_token:
            headers['Authorization'] = f'Bearer {auth_token}'
        
        return headers
    
    def _make_request(
        self,
        method: str,
        url: str,
        token: Optional[str] = None,
        timeout: Optional[Union[int, float]] = None,
        retry_attempts: Optional[int] = None,
        **kwargs
    ) -> requests.Response:
        """
        Make HTTP request with retry logic and error handling.
        
        Args:
            method: HTTP method (get, post, put, delete, patch)
            url: Target URL
            token: Optional authentication token
            timeout: Request timeout in seconds
            retry_attempts: Number of retry attempts (overrides default)
            **kwargs: Additional arguments for requests library
            
        Returns:
            requests.Response object
            
        Raises:
            requests.RequestException: On request failure after retries
        """
        # Use provided timeout or default
        request_timeout = timeout if timeout is not None else self.default_timeout
        
        # Override retry attempts if provided
        if retry_attempts is not None:
            retry_strategy = Retry(
                total=retry_attempts,
                backoff_factor=self.default_backoff_factor,
                status_forcelist=[500, 502, 503, 504],
                allowed_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
            )
            adapter = HTTPAdapter(max_retries=retry_strategy)
            temp_session = requests.Session()
            temp_session.mount("http://", adapter)
            temp_session.mount("https://", adapter)
            session = temp_session
        else:
            session = self.session
        
        # Build headers with authentication
        headers = self._get_headers(token, **kwargs)
        kwargs['headers'] = headers
        
        # Make request
        response = session.request(
            method=method.upper(),
            url=url,
            timeout=request_timeout,
            **kwargs
        )
        
        # Raise exception for HTTP errors
        response.raise_for_status()
        
        return response
    
    def get(
        self,
        url: str,
        token: Optional[str] = None,
        timeout: Optional[Union[int, float]] = None,
        retry_attempts: Optional[int] = None,
        **kwargs
    ) -> requests.Response:
        """
        Perform GET request.
        
        Args:
            url: Target URL
            token: Optional authentication token
            timeout: Request timeout in seconds
            retry_attempts: Number of retry attempts
            **kwargs: Additional arguments for requests.get()
            
        Returns:
            requests.Response object
        """
        return self._make_request('GET', url, token=token, timeout=timeout, retry_attempts=retry_attempts, **kwargs)
    
    def post(
        self,
        url: str,
        data: Optional[Any] = None,
        json: Optional[Dict[str, Any]] = None,
        token: Optional[str] = None,
        timeout: Optional[Union[int, float]] = None,
        retry_attempts: Optional[int] = None,
        **kwargs
    ) -> requests.Response:
        """
        Perform POST request.
        
        Args:
            url: Target URL
            data: Form data or raw data
            json: JSON data (automatically serialized)
            token: Optional authentication token
            timeout: Request timeout in seconds
            retry_attempts: Number of retry attempts
            **kwargs: Additional arguments for requests.post()
            
        Returns:
            requests.Response object
        """
        if json is not None:
            kwargs['json'] = json
        if data is not None:
            kwargs['data'] = data
        return self._make_request('POST', url, token=token, timeout=timeout, retry_attempts=retry_attempts, **kwargs)
    
    def put(
        self,
        url: str,
        data: Optional[Any] = None,
        json: Optional[Dict[str, Any]] = None,
        token: Optional[str] = None,
        timeout: Optional[Union[int, float]] = None,
        retry_attempts: Optional[int] = None,
        **kwargs
    ) -> requests.Response:
        """
        Perform PUT request.
        
        Args:
            url: Target URL
            data: Form data or raw data
            json: JSON data (automatically serialized)
            token: Optional authentication token
            timeout: Request timeout in seconds
            retry_attempts: Number of retry attempts
            **kwargs: Additional arguments for requests.put()
            
        Returns:
            requests.Response object
        """
        if json is not None:
            kwargs['json'] = json
        if data is not None:
            kwargs['data'] = data
        return self._make_request('PUT', url, token=token, timeout=timeout, retry_attempts=retry_attempts, **kwargs)
    
    def delete(
        self,
        url: str,
        token: Optional[str] = None,
        timeout: Optional[Union[int, float]] = None,
        retry_attempts: Optional[int] = None,
        **kwargs
    ) -> requests.Response:
        """
        Perform DELETE request.
        
        Args:
            url: Target URL
            token: Optional authentication token
            timeout: Request timeout in seconds
            retry_attempts: Number of retry attempts
            **kwargs: Additional arguments for requests.delete()
            
        Returns:
            requests.Response object
        """
        return self._make_request('DELETE', url, token=token, timeout=timeout, retry_attempts=retry_attempts, **kwargs)
    
    def patch(
        self,
        url: str,
        data: Optional[Any] = None,
        json: Optional[Dict[str, Any]] = None,
        token: Optional[str] = None,
        timeout: Optional[Union[int, float]] = None,
        retry_attempts: Optional[int] = None,
        **kwargs
    ) -> requests.Response:
        """
        Perform PATCH request.
        
        Args:
            url: Target URL
            data: Form data or raw data
            json: JSON data (automatically serialized)
            token: Optional authentication token
            timeout: Request timeout in seconds
            retry_attempts: Number of retry attempts
            **kwargs: Additional arguments for requests.patch()
            
        Returns:
            requests.Response object
        """
        if json is not None:
            kwargs['json'] = json
        if data is not None:
            kwargs['data'] = data
        return self._make_request('PATCH', url, token=token, timeout=timeout, retry_attempts=retry_attempts, **kwargs)
    
    def get_json(
        self,
        url: str,
        token: Optional[str] = None,
        timeout: Optional[Union[int, float]] = None,
        retry_attempts: Optional[int] = None,
        **kwargs
    ) -> Union[Dict[str, Any], list]:
        """
        Perform GET request and return parsed JSON response.
        
        Args:
            url: Target URL
            token: Optional authentication token
            timeout: Request timeout in seconds
            retry_attempts: Number of retry attempts
            **kwargs: Additional arguments for requests.get()
            
        Returns:
            Parsed JSON (dict or list)
            
        Raises:
            ValueError: If response is not valid JSON
            requests.RequestException: On HTTP failure after retries
        """
        response = self.get(url, token=token, timeout=timeout, retry_attempts=retry_attempts, **kwargs)
        return response.json()
    
    def post_json(
        self,
        url: str,
        data: Optional[Dict[str, Any]] = None,
        json: Optional[Dict[str, Any]] = None,
        token: Optional[str] = None,
        timeout: Optional[Union[int, float]] = None,
        retry_attempts: Optional[int] = None,
        **kwargs
    ) -> Union[Dict[str, Any], list]:
        """
        Perform POST request with JSON data and return parsed JSON response.
        
        Args:
            url: Target URL
            data: Optional data dict (will be converted to JSON)
            json: Optional JSON data (preferred)
            token: Optional authentication token
            timeout: Request timeout in seconds
            retry_attempts: Number of retry attempts
            **kwargs: Additional arguments for requests.post()
            
        Returns:
            Parsed JSON (dict or list)
            
        Raises:
            ValueError: If response is not valid JSON
            requests.RequestException: On HTTP failure after retries
        """
        # Use json parameter if provided, otherwise use data
        json_data = json if json is not None else data
        response = self.post(url, json=json_data, token=token, timeout=timeout, retry_attempts=retry_attempts, **kwargs)
        return response.json()

