import asyncio
import logging
import smtplib
from html import escape
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings

logger = logging.getLogger(__name__)


def _build_reset_html(reset_url: str, user_name: str) -> str:
    safe_reset_url = escape(reset_url, quote=True)
    safe_user_name = escape(user_name.strip()) if user_name and user_name.strip() else "there"

    return f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background:#f6f4ed;font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
        Reset your PDF Gyan password and get back into your workspace.
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f6f4ed;padding:32px 16px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;">
              <tr>
                <td style="padding:0 0 18px;">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-radius:30px;background:linear-gradient(135deg,#0f766e 0%,#0f5d75 62%,#d97706 100%);">
                    <tr>
                      <td style="padding:18px 22px;">
                        <table cellpadding="0" cellspacing="0" role="presentation">
                          <tr>
                            <td>
                              <table width="52" height="52" cellpadding="0" cellspacing="0" role="presentation" style="border-radius:18px;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.24);">
                                <tr>
                                  <td align="center" valign="middle" style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.04em;">
                                    PG
                                  </td>
                                </tr>
                              </table>
                            </td>
                            <td style="padding-left:14px;">
                              <p style="margin:0;font-size:22px;font-weight:800;line-height:1.1;color:#ffffff;">PDF Gyan</p>
                              <p style="margin:4px 0 0;font-size:13px;line-height:1.5;color:rgba(255,255,255,0.82);">
                                Document intelligence that feels calm and capable
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td>
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:rgba(255,255,255,0.94);border:1px solid rgba(15,23,42,0.08);border-radius:30px;overflow:hidden;box-shadow:0 28px 70px rgba(15,23,42,0.08);">
                    <tr>
                      <td style="padding:34px 32px 12px;">
                        <span style="display:inline-block;border-radius:999px;border:1px solid rgba(15,23,42,0.08);background:#ffffff;padding:9px 14px;font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:#738196;">
                          Password reset
                        </span>
                        <h1 style="margin:18px 0 0;font-size:34px;line-height:1.12;font-weight:800;letter-spacing:-0.04em;color:#0f172a;">
                          Reset your password
                        </h1>
                        <p style="margin:18px 0 0;font-size:16px;line-height:1.8;color:#526077;">
                          Hi {safe_user_name},
                        </p>
                        <p style="margin:12px 0 0;font-size:16px;line-height:1.8;color:#526077;">
                          We received a request to update your password. Use the secure button below to choose a new one and get back into your workspace.
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:0 32px 0;">
                        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-radius:24px;border:1px solid rgba(15,118,110,0.12);background:linear-gradient(180deg,rgba(255,255,255,0.96),rgba(240,253,250,0.9));">
                          <tr>
                            <td style="padding:18px 20px;">
                              <p style="margin:0;font-size:12px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#738196;">
                                Security note
                              </p>
                              <p style="margin:10px 0 0;font-size:14px;line-height:1.8;color:#0f766e;font-weight:700;">
                                This secure reset link expires in 15 minutes.
                              </p>
                              <p style="margin:6px 0 0;font-size:14px;line-height:1.7;color:#526077;">
                                If you did not request this change, you can safely ignore this email and keep your current password.
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:24px 32px 0;">
                        <table cellpadding="0" cellspacing="0" role="presentation">
                          <tr>
                            <td style="border-radius:18px;background:linear-gradient(135deg,#0f766e 0%,#0f5d75 78%);box-shadow:0 18px 34px rgba(15,118,110,0.22);">
                              <a href="{safe_reset_url}" style="display:inline-block;padding:15px 26px;font-size:15px;font-weight:700;line-height:1;color:#ffffff;text-decoration:none;">
                                Reset password
                              </a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:20px 32px 0;">
                        <p style="margin:0;font-size:13px;line-height:1.7;color:#738196;">
                          If the button does not open, copy and paste this link into your browser:
                        </p>
                        <p style="margin:12px 0 0;padding:14px 16px;border-radius:18px;background:#f8fafc;border:1px solid rgba(15,23,42,0.08);font-size:12px;line-height:1.7;color:#526077;word-break:break-all;">
                          {safe_reset_url}
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:24px 32px 30px;">
                        <p style="margin:0;font-size:12px;line-height:1.7;color:#94a3b8;text-align:center;">
                          PDF Gyan · Reset access securely and get back to your documents faster.
                        </p>
                      </td>
                    </tr>
                  </table>
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

    def _send():
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)

    try:
        await asyncio.get_event_loop().run_in_executor(None, _send)
        logger.info(f"Reset email sent to {to_email}")
    except Exception as e:
        logger.error(f"Failed to send reset email to {to_email}: {e}")
        raise
