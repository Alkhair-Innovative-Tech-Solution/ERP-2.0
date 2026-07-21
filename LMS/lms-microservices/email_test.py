import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def test_email():
    # Aap ki di hui settings
    smtp_server = "smtp.gmail.com" # Gmail usually use hota hai in credentials ke sath
    smtp_port = 587
    sender_email = "no-reply.ait@iak.ngo"
    password = "nulvsonqpdrghhuw"
    receiver_email = "faizansaeedali@gmail.com" # Change if needed

    message = MIMEMultipart()
    message["From"] = sender_email
    message["To"] = receiver_email
    message["Subject"] = "AIT LMS Email Test"

    body = "Bhai, ye AIT LMS email system ka test hai. Agar ye email mil gayi hai to system OK hai!"
    message.attach(MIMEText(body, "plain"))

    try:
        print(f"Connecting to {smtp_server}...")
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls() # EMAIL_USE_TLS=True
        print("Logging in...")
        server.login(sender_email, password)
        print("Sending email...")
        server.sendmail(sender_email, receiver_email, message.as_string())
        server.quit()
        print("✅ Success! Email sent successfully.")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_email()
