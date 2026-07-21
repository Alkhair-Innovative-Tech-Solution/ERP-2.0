"""
QR code generation for certificate verification
"""
import qrcode
from qrcode.image.pil import PilImage
from io import BytesIO
import logging
import os
from django.conf import settings

logger = logging.getLogger(__name__)


class QRCodeGenerator:
    """Generate QR codes for certificate verification"""
    
    def __init__(self, box_size=10, border=4):
        """
        Initialize QR code generator
        
        Args:
            box_size: Size of each box in the QR code
            border: Border thickness
        """
        self.box_size = box_size
        self.border = border
    
    def generate(
        self,
        verification_code: str,
        base_url: str = None
    ) -> BytesIO:
        """
        Generate QR code image
        
        Args:
            verification_code: Verification code for the certificate
            base_url: Base URL for verification (e.g., https://lms.example.com)
            
        Returns:
            BytesIO buffer containing PNG image
        """
        # Construct verification URL
        if base_url is None:
            # Try to get from settings or environment
            base_url = getattr(settings, 'FRONTEND_URL', 'https://lms.iak.ngo')
        
        verification_url = f"{base_url.rstrip('/')}/verify/{verification_code}"
        
        # Create QR code
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=self.box_size,
            border=self.border,
        )
        
        qr.add_data(verification_url)
        qr.make(fit=True)
        
        # Create image
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to BytesIO
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        
        logger.debug(f"Generated QR code for verification code: {verification_code}")
        return buffer
    
    def save_to_file(
        self,
        verification_code: str,
        file_path: str,
        base_url: str = None
    ) -> str:
        """
        Generate and save QR code to file
        
        Args:
            verification_code: Verification code
            file_path: Path to save the image
            base_url: Base URL for verification
            
        Returns:
            Path to saved file
        """
        buffer = self.generate(verification_code, base_url)
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        # Save to file
        with open(file_path, 'wb') as f:
            f.write(buffer.read())
        
        logger.info(f"Saved QR code to {file_path}")
        return file_path

