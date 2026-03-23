import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings

logger = logging.getLogger(__name__)


def _build_reset_html(reset_url: str, user_name: str) -> str:
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
        <tr>
          <td align="center">
            <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
              <tr>
                <td style="padding:32px 32px 0;">
                  <h2 style="margin:0 0 4px;font-size:20px;color:#0f172a;">PDF Gyan</h2>
                  <p style="margin:0;font-size:13px;color:#94a3b8;">Password Reset</p>
                </td>
              </tr>
              <tr>
                <td style="padding:24px 32px;">
                  <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">
                    Hi {user_name},
                  </p>
                  <p style="margin:0 0 24px;font-size:15px;color:#334155;line-height:1.6;">
                    We received a request to reset your password. Click the button below to set a new one. This link expires in 15 minutes.
                  </p>
                  <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                    <tr>
                      <td style="background:#0d9488;border-radius:8px;">
                        <a href="{reset_url}" style="display:inline-block;padding:12px 32px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">
                          Reset password
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:0 0 8px;font-size:13px;color:#64748b;line-height:1.6;">
                    If you didn't request this, you can safely ignore this email.
                  </p>
                  <p style="margin:0;font-size:12px;color:#94a3b8;word-break:break-all;">
                    {reset_url}
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:20px 32px;border-top:1px solid #f1f5f9;">
                  <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
                    PDF Gyan &mdash; Document intelligence that feels calm and capable.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    """


async def send_reset_email(to_email: str, user_name: str, reset_token: str):
    """Send password reset email via SMTP (Gmail, Resend SMTP, or any provider)."""
    frontend_url = settings.FRONTEND_URL.rstrip("/")
    reset_url = f"{frontend_url}/reset-password?token={reset_token}"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Reset your PDF Gyan password"
    msg["From"] = settings.SMTP_FROM_EMAIL
    msg["To"] = to_email

    # Plain text fallback
    text_content = f"""Hi {user_name},

We received a request to reset your PDF Gyan password.

Reset your password: {reset_url}

This link expires in 15 minutes. If you didn't request this, you can safely ignore this email.
"""
    html_content = _build_reset_html(reset_url, user_name)

    msg.attach(MIMEText(text_content, "plain"))
    msg.attach(MIMEText(html_content, "html"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
        logger.info(f"Reset email sent to {to_email}")
    except Exception as e:
        logger.error(f"Failed to send reset email to {to_email}: {e}")
        raise
