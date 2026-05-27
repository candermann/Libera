"""
Mail service for sending invoices with template-based subject/body.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from email.message import EmailMessage
import html
import re
import smtplib
import ssl

from jinja2 import BaseLoader, Environment, TemplateError
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.pdf import render_rechnung_pdf


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
            "name": f"{row.vorname} {row.nachname}",
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


def _plain_text_to_html(text_value: str) -> str:
    escaped = html.escape(text_value)
    escaped = _bold_re.sub(r"<strong>\1</strong>", escaped)
    html_lines = escaped.replace("\n", "<br>\n")
    return (
        "<html><body style=\"font-family: Arial, sans-serif; font-size: 14px; "
        "line-height: 1.45; color: #111;\">"
        f"{html_lines}"
        "</body></html>"
    )


def _build_mail_config(settings: dict[str, str]) -> MailConfig:
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
    )

    if not cfg.host:
        raise MailConfigurationError("SMTP-Host fehlt. Bitte im Profil hinterlegen.")
    if not cfg.from_email:
        raise MailConfigurationError("Absender-E-Mail fehlt. Bitte im Profil hinterlegen.")
    if cfg.use_ssl and cfg.use_starttls:
        raise MailConfigurationError("SMTP SSL und STARTTLS koennen nicht gleichzeitig aktiv sein.")

    return cfg


def _deliver_via_smtp(config: MailConfig, message: EmailMessage) -> None:
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

    return {
        "rechnung_id": rechnung_id,
        "to_email": target_email,
        "subject_template": subject_tpl,
        "body_template": body_tpl,
        "rendered_subject": rendered_subject,
        "rendered_body": rendered_body,
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

    msg = EmailMessage()
    if config.from_name:
        msg["From"] = f"{config.from_name} <{config.from_email}>"
    else:
        msg["From"] = config.from_email
    msg["To"] = preview["to_email"]
    msg["Subject"] = preview["rendered_subject"]
    if config.reply_to:
        msg["Reply-To"] = config.reply_to

    msg.set_content(preview["rendered_body"])
    msg.add_alternative(_plain_text_to_html(preview["rendered_body"]), subtype="html")
    msg.add_attachment(
        pdf_bytes,
        maintype="application",
        subtype="pdf",
        filename=f"{rechnung_id}.pdf",
    )

    _deliver_via_smtp(config, msg)

    return {
        "status": "sent",
        "rechnung_id": rechnung_id,
        "to_email": preview["to_email"],
        "subject": preview["rendered_subject"],
    }
