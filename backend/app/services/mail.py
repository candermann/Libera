"""
Mail service for sending invoices with template-based subject/body.
"""

from __future__ import annotations

import base64
from dataclasses import dataclass
from email.message import EmailMessage
from datetime import date
import html
import json
from pathlib import Path
import re
import smtplib
import ssl
import urllib.error
import urllib.parse
import urllib.request

from jinja2 import BaseLoader, Environment, TemplateError
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.pdf import render_rechnung_pdf

_LOGO_PATH = Path(__file__).parent.parent / "static" / "logo.jpeg"
_LOGO_CID = "school_logo_bibliomat"


@dataclass
class MailConfig:
    host: str
    port: int
    username: str
    password: str
    use_starttls: bool
    use_ssl: bool
    from_email: str
    from_name: str
    reply_to: str
    auth_method: str = "smtp"
    oauth2_tenant_id: str = ""
    oauth2_client_id: str = ""
    oauth2_client_secret: str = ""


class MailTemplateError(ValueError):
    """Raised when a mail template cannot be rendered."""


class MailConfigurationError(ValueError):
    """Raised when SMTP settings are incomplete or invalid."""


class MailDeliveryError(RuntimeError):
    """Raised when SMTP delivery fails."""


_template_env = Environment(
    loader=BaseLoader(),
    autoescape=False,
)

_bold_re = re.compile(r"\*\*(.+?)\*\*")


def _to_bool(raw: str | None, default: bool = False) -> bool:
    if raw is None:
        return default
    return str(raw).strip().lower() in {"1", "true", "yes", "on", "ja"}


def _to_int(raw: str | None, default: int) -> int:
    if raw is None or str(raw).strip() == "":
        return default
    try:
        return int(str(raw).strip())
    except ValueError as exc:
        raise MailConfigurationError("SMTP-Port ist ungueltig.") from exc


def _cents_to_eur(cents: int) -> str:
    eur = cents / 100
    return f"{eur:,.2f} EUR".replace(",", "X").replace(".", ",").replace("X", ".")


def _load_settings(db: Session) -> dict[str, str]:
    rows = db.execute(text("SELECT schluessel, wert FROM einstellungen")).fetchall()
    return {r.schluessel: r.wert for r in rows}


def _build_context(db: Session, rechnung_id: str, settings: dict[str, str]) -> tuple[dict, str]:
    row = db.execute(
        text(
            """
            SELECT
                r.id,
                r.schueler_id,
                r.datum,
                r.schuljahr,
                r.summe_cents,
                r.verrechnet_cents,
                r.status,
                s.vorname,
                s.nachname,
                s.klasse,
                s.email_eltern
            FROM rechnungen r
            JOIN schueler s ON s.id = r.schueler_id
            WHERE r.id = :rid
            """
        ),
        {"rid": rechnung_id},
    ).first()

    if not row:
        raise ValueError("Rechnung nicht gefunden.")

    context = {
        "rechnung": {
            "id": row.id,
            "datum": row.datum,
            "schuljahr": row.schuljahr,
            "status": row.status,
            "summe_cents": row.summe_cents,
            "summe_eur": _cents_to_eur(row.summe_cents),
            "verrechnet_cents": row.verrechnet_cents,
            "verrechnet_eur": _cents_to_eur(row.verrechnet_cents),
            "zu_zahlen_cents": row.summe_cents - row.verrechnet_cents,
            "zu_zahlen_eur": _cents_to_eur(row.summe_cents - row.verrechnet_cents),
        },
        "schueler": {
            "id": row.schueler_id,
            "vorname": row.vorname,
            "nachname": row.nachname,
            "name": f"{row.nachname}, {row.vorname}",
            "klasse": row.klasse,
            "email": row.email_eltern or "",
        },
        "schule": {
            "name": settings.get("schule_name", ""),
            "email": settings.get("schule_email", ""),
            "telefon": settings.get("schule_telefon", ""),
        },
        "system": {
            "heute": date.today().isoformat(),
        },
    }
    return context, (row.email_eltern or "").strip()


def _render_template(template_value: str, context: dict) -> str:
    try:
        tmpl = _template_env.from_string(template_value)
        return tmpl.render(**context).strip()
    except TemplateError as exc:
        raise MailTemplateError(f"Template konnte nicht gerendert werden: {exc}") from exc


def _plain_text_to_html_inner(text_value: str) -> str:
    escaped = html.escape(text_value)
    escaped = _bold_re.sub(r"<strong>\1</strong>", escaped)
    return escaped.replace("\n", "<br>\n")


def _plain_text_to_html(text_value: str) -> str:
    return (
        "<html><body style=\"font-family: Arial, sans-serif; font-size: 14px; "
        "line-height: 1.45; color: #111;\">"
        f"{_plain_text_to_html_inner(text_value)}"
        "</body></html>"
    )


def _try_load_logo() -> bytes | None:
    try:
        if _LOGO_PATH.exists():
            return _LOGO_PATH.read_bytes()
    except OSError:
        pass
    return None


def _build_email_message(
    config: MailConfig,
    to_email: str,
    subject: str,
    body_text: str,
    pdf_bytes: bytes,
    pdf_filename: str,
    signature_text: str = "",
    signature_html: str = "",
) -> EmailMessage:
    logo_data = _try_load_logo()

    full_text = (body_text + "\n\n" + signature_text).rstrip() if signature_text else body_text

    body_html_inner = _plain_text_to_html_inner(body_text)
    sig_html = signature_html
    if sig_html and not logo_data:
        sig_html = re.sub(r'<img[^>]*cid:[^>]*>', '', sig_html)
    full_html = (
        "<html><body style=\"font-family:Arial,sans-serif;font-size:14px;"
        "line-height:1.45;color:#111;\">"
        f"{body_html_inner}"
        f"{sig_html}"
        "</body></html>"
    )

    from_header = f"{config.from_name} <{config.from_email}>" if config.from_name else config.from_email

    root = EmailMessage()
    root["From"] = from_header
    root["To"] = to_email
    root["Subject"] = subject
    if config.reply_to:
        root["Reply-To"] = config.reply_to

    if logo_data and sig_html:
        root.set_content(full_text)
        root.add_alternative(full_html, subtype="html")
        html_part = root.get_payload()[-1]
        html_part.add_related(
            logo_data,
            maintype="image",
            subtype="jpeg",
            cid=f"<{_LOGO_CID}>",
            disposition="inline",
        )
    else:
        root.set_content(full_text)
        root.add_alternative(full_html, subtype="html")

    root.add_attachment(
        pdf_bytes,
        maintype="application",
        subtype="pdf",
        filename=pdf_filename,
    )

    return root


def _get_oauth2_token(tenant_id: str, client_id: str, client_secret: str) -> str:
    url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
    data = urllib.parse.urlencode({
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
        "scope": "https://outlook.office365.com/.default",
    }).encode()
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        try:
            body = json.loads(exc.read())
            error = body.get("error_description") or body.get("error") or str(exc)
        except Exception:
            error = str(exc)
        raise MailConfigurationError(f"OAuth2-Token konnte nicht abgerufen werden: {error}") from exc
    except (OSError, TimeoutError) as exc:
        raise MailDeliveryError(f"Verbindung zu Microsoft-Login-Server fehlgeschlagen: {exc}") from exc

    if "access_token" not in result:
        error = result.get("error_description") or result.get("error") or "Unbekannter Fehler"
        raise MailConfigurationError(f"OAuth2-Token fehlt in Antwort: {error}")

    return result["access_token"]


def _build_mail_config(settings: dict[str, str]) -> MailConfig:
    auth_method = (settings.get("mail_auth_method") or "smtp").strip().lower()
    use_ssl = _to_bool(settings.get("mail_smtp_use_ssl"), default=False)
    default_port = 465 if use_ssl else 587

    cfg = MailConfig(
        host=(settings.get("mail_smtp_host") or "").strip(),
        port=_to_int(settings.get("mail_smtp_port"), default=default_port),
        username=(settings.get("mail_smtp_username") or "").strip(),
        password=settings.get("mail_smtp_password") or "",
        use_starttls=_to_bool(settings.get("mail_smtp_use_starttls"), default=not use_ssl),
        use_ssl=use_ssl,
        from_email=(settings.get("mail_from_email") or "").strip(),
        from_name=(settings.get("mail_from_name") or "").strip(),
        reply_to=(settings.get("mail_reply_to") or "").strip(),
        auth_method=auth_method,
        oauth2_tenant_id=(settings.get("mail_oauth2_tenant_id") or "").strip(),
        oauth2_client_id=(settings.get("mail_oauth2_client_id") or "").strip(),
        oauth2_client_secret=settings.get("mail_oauth2_client_secret") or "",
    )

    if not cfg.host:
        raise MailConfigurationError("SMTP-Host fehlt. Bitte im Profil hinterlegen.")
    if not cfg.from_email:
        raise MailConfigurationError("Absender-E-Mail fehlt. Bitte im Profil hinterlegen.")

    if auth_method == "oauth2":
        if not cfg.oauth2_tenant_id:
            raise MailConfigurationError("OAuth2 Tenant-ID fehlt. Bitte im Profil hinterlegen.")
        if not cfg.oauth2_client_id:
            raise MailConfigurationError("OAuth2 Client-ID fehlt. Bitte im Profil hinterlegen.")
        if not cfg.oauth2_client_secret:
            raise MailConfigurationError("OAuth2 Client-Secret fehlt. Bitte im Profil hinterlegen.")
        if not cfg.username:
            raise MailConfigurationError("Absender-Benutzername (E-Mail-Adresse) fehlt. Bitte im Profil hinterlegen.")
    else:
        if cfg.use_ssl and cfg.use_starttls:
            raise MailConfigurationError("SMTP SSL und STARTTLS koennen nicht gleichzeitig aktiv sein.")

    return cfg


def _deliver_via_smtp(config: MailConfig, message: EmailMessage) -> None:
    if config.auth_method == "oauth2":
        _deliver_via_smtp_oauth2(config, message)
        return

    try:
        if config.use_ssl:
            with smtplib.SMTP_SSL(
                host=config.host,
                port=config.port,
                context=ssl.create_default_context(),
                timeout=20,
            ) as server:
                if config.username:
                    server.login(config.username, config.password)
                server.send_message(message)
            return

        with smtplib.SMTP(host=config.host, port=config.port, timeout=20) as server:
            server.ehlo()
            if config.use_starttls:
                server.starttls(context=ssl.create_default_context())
                server.ehlo()
            if config.username:
                server.login(config.username, config.password)
            server.send_message(message)
    except (smtplib.SMTPException, OSError, TimeoutError) as exc:
        raise MailDeliveryError(f"Mailversand fehlgeschlagen: {exc}") from exc


def _deliver_via_smtp_oauth2(config: MailConfig, message: EmailMessage) -> None:
    token = _get_oauth2_token(
        config.oauth2_tenant_id,
        config.oauth2_client_id,
        config.oauth2_client_secret,
    )
    xoauth2 = base64.b64encode(
        f"user={config.username}\x01auth=Bearer {token}\x01\x01".encode()
    ).decode()
    try:
        with smtplib.SMTP(host=config.host, port=config.port, timeout=20) as server:
            server.ehlo()
            server.starttls(context=ssl.create_default_context())
            server.ehlo()
            code, _ = server.docmd("AUTH", f"XOAUTH2 {xoauth2}")
            if code != 235:
                raise MailDeliveryError(
                    f"OAuth2-SMTP-Authentifizierung fehlgeschlagen (Code {code})."
                )
            server.send_message(message)
    except MailDeliveryError:
        raise
    except (smtplib.SMTPException, OSError, TimeoutError) as exc:
        raise MailDeliveryError(f"Mailversand fehlgeschlagen: {exc}") from exc


def get_invoice_mail_preview(
    db: Session,
    rechnung_id: str,
    *,
    to_email: str | None = None,
    subject_template: str | None = None,
    body_template: str | None = None,
) -> dict:
    settings = _load_settings(db)
    context, default_to = _build_context(db, rechnung_id, settings)

    subject_tpl = (
        subject_template
        if subject_template is not None
        else settings.get("mail_subject_template", "")
    )
    body_tpl = (
        body_template
        if body_template is not None
        else settings.get("mail_body_template", "")
    )
    target_email = (to_email if to_email is not None else default_to).strip()

    rendered_subject = _render_template(subject_tpl, context)
    rendered_body = _render_template(body_tpl, context)

    signature_text = settings.get("mail_signature_text") or ""
    preview_body = (rendered_body + "\n\n" + signature_text).rstrip() if signature_text else rendered_body

    return {
        "rechnung_id": rechnung_id,
        "to_email": target_email,
        "subject_template": subject_tpl,
        "body_template": body_tpl,
        "rendered_subject": rendered_subject,
        "rendered_body": preview_body,
        "context_meta": {
            "schueler_name": context["schueler"]["name"],
            "schueler_klasse": context["schueler"]["klasse"],
            "summe_eur": context["rechnung"]["summe_eur"],
        },
    }


def send_invoice_mail(
    db: Session,
    rechnung_id: str,
    *,
    to_email: str | None = None,
    subject_template: str | None = None,
    body_template: str | None = None,
) -> dict:
    settings = _load_settings(db)
    config = _build_mail_config(settings)
    preview = get_invoice_mail_preview(
        db,
        rechnung_id,
        to_email=to_email,
        subject_template=subject_template,
        body_template=body_template,
    )

    if not preview["to_email"]:
        raise ValueError("Keine Empfaenger-E-Mail vorhanden.")
    if not preview["rendered_subject"]:
        raise MailTemplateError("Der gerenderte Betreff ist leer.")
    if not preview["rendered_body"]:
        raise MailTemplateError("Der gerenderte Nachrichtentext ist leer.")

    pdf_bytes = render_rechnung_pdf(db, rechnung_id)
    if not pdf_bytes:
        raise RuntimeError("PDF fuer die Rechnung konnte nicht erzeugt werden.")

    msg = _build_email_message(
        config=config,
        to_email=preview["to_email"],
        subject=preview["rendered_subject"],
        body_text=preview["rendered_body"],
        pdf_bytes=pdf_bytes,
        pdf_filename=f"{rechnung_id}.pdf",
        signature_text=settings.get("mail_signature_text") or "",
        signature_html=settings.get("mail_signature_html") or "",
    )

    _deliver_via_smtp(config, msg)

    return {
        "status": "sent",
        "rechnung_id": rechnung_id,
        "to_email": preview["to_email"],
        "subject": preview["rendered_subject"],
    }
