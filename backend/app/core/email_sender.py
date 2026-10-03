"""
app/core/email_sender.py
========================
Email sender interface with:
  - DevEmailSender: logs the link in development mode only (never in production).
  - SmtpEmailSender: sends real emails via SMTP (production).

Rule: No secrets (passwords, tokens) must appear in log messages in production.
      If SMTP is missing in production, fail loudly.
"""

import logging
import smtplib
import ssl
from abc import ABC, abstractmethod
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.core.config import settings

logger = logging.getLogger("vivora.email")


class EmailSender(ABC):
    @abstractmethod
    def send_parent_consent_email(
        self,
        parent_email: str,
        child_name: str,
        confirm_url: str,
    ) -> None:
        """Send the parental consent confirmation email."""


class DevEmailSender(EmailSender):
    """
    Development email sender — logs the consent link to stdout/log instead of
    sending a real email. Safe to use in local development/test only.
    """

    def send_parent_consent_email(
        self,
        parent_email: str,
        child_name: str,
        confirm_url: str,
    ) -> None:
        if settings.ENV == "production":
            raise RuntimeError(
                "Cannot use DevEmailSender in production. SMTP must be configured with SMTP_HOST, SMTP_USER, and SMTP_PASSWORD."
            )
        logger.info(
            f"[DEV EMAIL] Parental consent link for '{child_name}' → {parent_email}:\n"
            f"  {confirm_url}\n"
            "(This is logged in development mode because SMTP is not configured.)"
        )


class SmtpEmailSender(EmailSender):
    """Sends real emails via SMTP (TLS on port 587)."""

    def __init__(self) -> None:
        if not (settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD):
            raise RuntimeError("SMTP configuration missing: SMTP_HOST, SMTP_USER, and SMTP_PASSWORD are required.")
        self.host = settings.SMTP_HOST
        self.port = settings.SMTP_PORT
        self.user = settings.SMTP_USER
        self._password = settings.SMTP_PASSWORD
        self.from_addr = settings.EMAIL_FROM

    def send_parent_consent_email(
        self,
        parent_email: str,
        child_name: str,
        confirm_url: str,
    ) -> None:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"VIVORA: Please confirm consent for {child_name}"
        msg["From"] = self.from_addr
        msg["To"] = parent_email

        body_text = (
            f"Hello,\n\n"
            f"Your child or ward '{child_name}' has signed up for VIVORA, "
            f"an AI-powered viva and interview practice platform.\n\n"
            f"To allow them to use the platform, please click the link below "
            f"(valid for 48 hours):\n\n"
            f"{confirm_url}\n\n"
            f"If you did not expect this email or do not consent, please ignore it. "
            f"The account will remain inactive.\n\n"
            f"— VIVORA Team"
        )
        msg.attach(MIMEText(body_text, "plain"))

        context = ssl.create_default_context()
        try:
            with smtplib.SMTP(self.host, self.port, timeout=15) as smtp:
                smtp.ehlo()
                smtp.starttls(context=context)
                smtp.login(self.user, self._password)
                smtp.sendmail(self.from_addr, parent_email, msg.as_string())
        except Exception as e:
            logger.error(f"Failed to deliver SMTP consent email to {parent_email}: {e}")
            raise RuntimeError(f"Email delivery failed: {e}")


def get_email_sender() -> EmailSender:
    """Return the appropriate email sender based on config."""
    if settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD:
        return SmtpEmailSender()
    if settings.ENV == "production":
        raise RuntimeError(
            "SMTP configuration (SMTP_HOST, SMTP_USER, SMTP_PASSWORD) is required in production environment."
        )
    return DevEmailSender()
