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


def _build_signup_otp_html(user_name: str, otp: str) -> str:
    safe_user_name = escape(user_name.strip()) if user_name and user_name.strip() else "there"
    safe_otp = escape(otp)

    return f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background:#f6f4ed;font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
        Your PDF Gyan verification code is {safe_otp}.
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
                          Email verification
                        </span>
                        <h1 style="margin:18px 0 0;font-size:34px;line-height:1.12;font-weight:800;letter-spacing:-0.04em;color:#0f172a;">
                          Confirm your email
                        </h1>
                        <p style="margin:18px 0 0;font-size:16px;line-height:1.8;color:#526077;">
                          Hi {safe_user_name},
                        </p>
                        <p style="margin:12px 0 0;font-size:16px;line-height:1.8;color:#526077;">
                          Use the one-time code below to verify your email and finish creating your PDF Gyan workspace.
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:0 32px;">
                        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-radius:26px;border:1px solid rgba(15,118,110,0.12);background:linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,253,250,0.92));">
                          <tr>
                            <td align="center" style="padding:22px 20px;">
                              <p style="margin:0;font-size:12px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#738196;">
                                Verification code
                              </p>
                              <p style="margin:14px 0 0;font-size:34px;font-weight:800;letter-spacing:0.32em;color:#0f766e;">
                                {safe_otp}
                              </p>
                              <p style="margin:14px 0 0;font-size:13px;line-height:1.7;color:#526077;">
                                This code expires in {settings.SIGNUP_OTP_EXPIRE_MINUTES} minutes.
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:20px 32px 0;">
                        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-radius:20px;background:#f8fafc;border:1px solid rgba(15,23,42,0.08);">
                          <tr>
                            <td style="padding:16px 18px;">
                              <p style="margin:0;font-size:12px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#738196;">
                                Security note
                              </p>
                              <p style="margin:8px 0 0;font-size:14px;line-height:1.7;color:#526077;">
                                Only enter this code inside the PDF Gyan signup screen. If you did not request it, you can safely ignore this email.
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:24px 32px 30px;">
                        <p style="margin:0;font-size:12px;line-height:1.7;color:#94a3b8;text-align:center;">
                          PDF Gyan · Verify securely and get to your documents faster.
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


async def send_signup_otp_email(to_email: str, user_name: str, otp: str):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Your PDF Gyan verification code: {otp}"
    msg["From"] = settings.SMTP_FROM_EMAIL
    msg["To"] = to_email

    text_content = f"""Hi {user_name},

Use this verification code to confirm your email for PDF Gyan:

{otp}

This code expires in {settings.SIGNUP_OTP_EXPIRE_MINUTES} minutes. If you did not request it, you can safely ignore this email.
"""
    html_content = _build_signup_otp_html(user_name, otp)

    msg.attach(MIMEText(text_content, "plain"))
    msg.attach(MIMEText(html_content, "html"))

    def _send():
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)

    try:
        await asyncio.get_event_loop().run_in_executor(None, _send)
        logger.info(f"Signup OTP email sent to {to_email}")
    except Exception as e:
        logger.error(f"Failed to send signup OTP email to {to_email}: {e}")
        raise


async def send_share_otp_email(to_email: str, otp: str, filename: str):
    """Send OTP for share access verification with branded template."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"You've been shared a document — {filename}"
    msg["From"] = settings.SMTP_FROM_EMAIL
    msg["To"] = to_email

    app_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
    portal_url = f"{app_url}/shared-files"

    text_content = f"""Someone shared "{filename}" with you on PDF Gyan.

Your verification code: {otp}

This code expires in 10 minutes.

View all your shared documents: {portal_url}

— PDF Gyan · Document intelligence that feels calm and capable"""

    html_content = f"""<!DOCTYPE html>
<html><body style="margin:0;padding:0;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:linear-gradient(135deg,#f0fdf4 0%,#fefce8 50%,#f5f5f4 100%);">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:40px auto;">
  <tr><td style="padding:24px 28px 16px;text-align:left;">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="width:36px;height:36px;background:linear-gradient(135deg,#0f766e,#0d9488);border-radius:12px;text-align:center;vertical-align:middle;">
        <span style="color:#fff;font-size:16px;font-weight:800;">G</span>
      </td>
      <td style="padding-left:10px;">
        <p style="margin:0;font-size:16px;font-weight:800;color:#0f172a;">PDF Gyan</p>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:0 16px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.06);">
      <tr><td style="padding:32px 28px;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#0f766e;">Shared with you</p>
        <h1 style="margin:0 0 6px;font-size:22px;font-weight:800;color:#0f172a;">A document is waiting</h1>
        <p style="margin:0 0 20px;font-size:14px;color:#64748b;line-height:1.6;">
          Someone shared <strong style="color:#0f172a;">{filename}</strong> with you. Enter the code below to access it.
        </p>
        <div style="background:linear-gradient(135deg,#f0fdfa,#f0fdf4);border:2px solid #ccfbf1;border-radius:16px;padding:20px;text-align:center;margin-bottom:20px;">
          <p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#0f766e;">Verification Code</p>
          <p style="margin:0;font-size:36px;font-weight:800;letter-spacing:0.35em;color:#0f172a;font-family:'Courier New',monospace;">{otp}</p>
        </div>
        <p style="margin:0 0 24px;font-size:12px;color:#94a3b8;text-align:center;">Code expires in 10 minutes</p>
        <div style="height:1px;background:#e2e8f0;margin:0 0 20px;"></div>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="text-align:center;">
            <a href="{portal_url}" style="display:inline-block;background:linear-gradient(135deg,#0f766e,#0d9488);color:#ffffff;padding:12px 28px;border-radius:14px;font-size:13px;font-weight:700;text-decoration:none;">
              View all shared documents
            </a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:0 28px 32px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#94a3b8;">PDF Gyan — Document intelligence that feels calm and capable</p>
  </td></tr>
</table>
</body></html>"""

    msg.attach(MIMEText(text_content, "plain"))
    msg.attach(MIMEText(html_content, "html"))

    def _send():
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)

    try:
        await asyncio.get_event_loop().run_in_executor(None, _send)
        logger.info(f"Share OTP email sent to {to_email}")
    except Exception as e:
        logger.error(f"Failed to send share OTP to {to_email}: {e}")
        raise


async def send_share_notification_email(to_email: str, filename: str, share_token: str, sender_name: str = "Someone"):
    """Send email notification when a file is shared externally."""
    frontend_url = settings.FRONTEND_URL.rstrip("/")
    share_url = f"{frontend_url}/shared-file/{share_token}"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"{sender_name} shared a document with you — PDF Gyan"
    msg["From"] = settings.SMTP_FROM_EMAIL
    msg["To"] = to_email

    text_content = f"""Hi,

{sender_name} has shared a document with you on PDF Gyan.

Document: {filename}
View it here: {share_url}

This link will expire in 30 days.

— PDF Gyan"""

    html_content = f"""<!DOCTYPE html>
    <html><body style="margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif;background:#f6f4ed;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:40px auto;background:#fff;border-radius:20px;border:1px solid #e2e8f0;overflow:hidden;">
      <tr><td style="padding:32px 28px;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#94a3b8;">Document shared with you</p>
        <h1 style="margin:0 0 16px;font-size:22px;color:#0f172a;">{sender_name} shared a file</h1>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:16px;margin-bottom:20px;">
          <p style="margin:0;font-size:15px;font-weight:600;color:#0f172a;">{filename}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#64748b;">Click below to view this document</p>
        </div>
        <a href="{share_url}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#0f766e,#0f5d75);color:#fff;text-decoration:none;border-radius:12px;font-size:14px;font-weight:600;">View Document</a>
        <p style="margin:20px 0 0;font-size:11px;color:#94a3b8;">This link expires in 30 days. If you weren't expecting this, you can ignore this email.</p>
      </td></tr>
    </table>
    </body></html>"""

    msg.attach(MIMEText(text_content, "plain"))
    msg.attach(MIMEText(html_content, "html"))

    def _send():
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)

    try:
        await asyncio.get_event_loop().run_in_executor(None, _send)
        logger.info(f"Share notification email sent to {to_email}")
    except Exception as e:
        logger.error(f"Failed to send share notification to {to_email}: {e}")
