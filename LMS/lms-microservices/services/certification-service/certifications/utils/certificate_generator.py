"""
Certificate PDF generation using ReportLab
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import inch, mm
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from io import BytesIO
import logging
from datetime import datetime
import os

logger = logging.getLogger(__name__)


class CertificateGenerator:
    """Generate PDF certificates using ReportLab"""
    
    PAGE_SIZE = A4
    MARGIN = 0.6 * inch
    
    def generate(
        self,
        student_name: str,
        student_id: str,
        student_email: str,
        student_cnic: str,
        father_name: str,
        batch: str,
        specialization: str,
        course_title: str,
        course_code: str,
        grade: float,
        institution_name: str,
        certificate_number: str,
        verification_code: str,
        issued_date: datetime,
        qr_code_path: str = None,
        percentile: int = None
    ) -> BytesIO:
        """Generate PDF certificate with proper layout"""
        buffer = BytesIO()
        width, height = self.PAGE_SIZE
        
        c = canvas.Canvas(buffer, pagesize=self.PAGE_SIZE)
        
        # === BACKGROUND ===
        c.setFillColor(colors.HexColor('#ffffff'))
        c.rect(0, 0, width, height, fill=1, stroke=0)
        
        # === OUTER BORDER ===
        border_margin = 0.35 * inch
        c.setStrokeColor(colors.HexColor('#1e3a5f'))
        c.setLineWidth(4)
        c.rect(
            border_margin, border_margin,
            width - 2 * border_margin, height - 2 * border_margin,
            fill=0, stroke=1
        )
        
        # === INNER BORDER ===
        inner_margin = 0.45 * inch
        c.setStrokeColor(colors.HexColor('#c9a227'))
        c.setLineWidth(1.5)
        c.rect(
            inner_margin, inner_margin,
            width - 2 * inner_margin, height - 2 * inner_margin,
            fill=0, stroke=1
        )
        
        center_x = width / 2
        y = height - 0.8 * inch
        
        # === INSTITUTION NAME (Top Center) ===
        c.setFillColor(colors.HexColor('#1e3a5f'))
        c.setFont('Helvetica-Bold', 22)
        c.drawCentredString(center_x, y, institution_name.upper())
        y -= 0.35 * inch
        
        # === DECORATIVE LINE ===
        c.setStrokeColor(colors.HexColor('#c9a227'))
        c.setLineWidth(2)
        c.line(center_x - 2.5 * inch, y, center_x + 2.5 * inch, y)
        y -= 0.45 * inch
        
        # === CERTIFICATE TITLE ===
        c.setFillColor(colors.HexColor('#1e3a5f'))
        c.setFont('Helvetica-Bold', 30)
        c.drawCentredString(center_x, y, "CERTIFICATE")
        y -= 0.35 * inch
        
        c.setFont('Helvetica', 18)
        c.setFillColor(colors.HexColor('#4a5568'))
        c.drawCentredString(center_x, y, "of Completion")
        y -= 0.5 * inch
        
        # === DECORATIVE LINE ===
        c.setStrokeColor(colors.HexColor('#c9a227'))
        c.setLineWidth(1)
        c.line(center_x - 1.5 * inch, y, center_x + 1.5 * inch, y)
        y -= 0.4 * inch
        
        # === "This is to certify that" ===
        c.setFillColor(colors.HexColor('#718096'))
        c.setFont('Helvetica-Oblique', 13)
        c.drawCentredString(center_x, y, "This is to certify that")
        y -= 0.4 * inch
        
        # === STUDENT NAME (Large, Prominent) ===
        c.setFillColor(colors.HexColor('#1e3a5f'))
        c.setFont('Helvetica-Bold', 26)
        c.drawCentredString(center_x, y, student_name.upper())
        y -= 0.3 * inch
        
        # === UNDERLINE FOR NAME ===
        name_width = c.stringWidth(student_name.upper(), 'Helvetica-Bold', 26)
        c.setStrokeColor(colors.HexColor('#c9a227'))
        c.setLineWidth(1.5)
        c.line(center_x - name_width / 2 - 0.2 * inch, y, center_x + name_width / 2 + 0.2 * inch, y)
        y -= 0.35 * inch
        
        # === STUDENT DETAILS ROW ===
        c.setFont('Helvetica', 10)
        c.setFillColor(colors.HexColor('#4a5568'))
        details = []
        if student_id:
            details.append(f"Student ID: {student_id}")
        if father_name:
            details.append(f"S/O: {father_name}")
        if student_cnic:
            details.append(f"CNIC: {student_cnic}")
        
        if details:
            detail_text = "   |   ".join(details)
            c.drawCentredString(center_x, y, detail_text)
            y -= 0.25 * inch
        
        if batch or specialization:
            extra = []
            if batch:
                extra.append(f"Batch: {batch}")
            if specialization:
                extra.append(f"Specialization: {specialization}")
            c.drawCentredString(center_x, y, "   |   ".join(extra))
            y -= 0.4 * inch
        
        # === "has successfully completed" ===
        c.setFillColor(colors.HexColor('#718096'))
        c.setFont('Helvetica-Oblique', 13)
        c.drawCentredString(center_x, y, "has successfully completed the requirements for")
        y -= 0.4 * inch
        
        # === COURSE TITLE ===
        c.setFillColor(colors.HexColor('#1e3a5f'))
        c.setFont('Helvetica-Bold', 20)
        c.drawCentredString(center_x, y, course_title)
        y -= 0.3 * inch
        
        # === COURSE CODE ===
        c.setFillColor(colors.HexColor('#4a5568'))
        c.setFont('Helvetica', 14)
        c.drawCentredString(center_x, y, f"Course Code: {course_code}")
        y -= 0.5 * inch
        
        # === GRADE / PERCENTILE ===
        if grade and grade > 0:
            grade_text = f"Grade: {grade:.1f}%"
            if percentile is not None:
                grade_text += f"   |   Percentile: {percentile}"
            c.setFillColor(colors.HexColor('#2d6a4f'))
            c.setFont('Helvetica-Bold', 14)
            c.drawCentredString(center_x, y, grade_text)
            y -= 0.4 * inch
        
        # === ISSUE DATE ===
        date_str = issued_date.strftime("%B %d, %Y")
        c.setFillColor(colors.HexColor('#718096'))
        c.setFont('Helvetica', 11)
        c.drawCentredString(center_x, y, f"Issued on: {date_str}")
        y -= 0.55 * inch
        
        # === BOTTOM SECTION: Signature (Left) + QR (Right) ===
        # Signature line (left)
        sig_x = 1.8 * inch
        sig_y = 1.3 * inch
        c.setStrokeColor(colors.HexColor('#a0aec0'))
        c.setLineWidth(1)
        c.line(sig_x - 1 * inch, sig_y, sig_x + 1 * inch, sig_y)
        c.setFillColor(colors.HexColor('#718096'))
        c.setFont('Helvetica', 9)
        c.drawCentredString(sig_x, sig_y - 0.2 * inch, "Authorized Signature")
        
        # Date line (center)
        date_x = center_x
        c.line(date_x - 0.8 * inch, sig_y, date_x + 0.8 * inch, sig_y)
        c.drawCentredString(date_x, sig_y - 0.2 * inch, "Date")
        
        # QR Code (right)
        if qr_code_path and os.path.exists(qr_code_path):
            try:
                qr_size = 1.0 * inch
                qr_x = width - 1.8 * inch - qr_size
                qr_y = 1.0 * inch
                c.drawImage(qr_code_path, qr_x, qr_y, width=qr_size, height=qr_size)
                c.setFillColor(colors.HexColor('#718096'))
                c.setFont('Helvetica', 7)
                c.drawCentredString(qr_x + qr_size / 2, qr_y - 0.15 * inch, "Scan to Verify")
            except Exception as e:
                logger.warning(f"Could not add QR code: {e}")
        
        # === FOOTER: Certificate Number & Verification Code ===
        footer_y = 0.55 * inch
        c.setFillColor(colors.HexColor('#a0aec0'))
        c.setFont('Helvetica', 8)
        c.drawCentredString(center_x, footer_y, f"Certificate No: {certificate_number}")
        footer_y -= 0.15 * inch
        c.drawCentredString(center_x, footer_y, f"Verification Code: {verification_code}")
        
        # Save
        c.save()
        buffer.seek(0)
        
        logger.info(f"Generated certificate PDF for {student_name} - {course_code}")
        return buffer
