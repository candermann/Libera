// Druck-/PDF-Helfer: erzeugt eine eigenständige HTML-Seite mit der Rechnung/Gutschrift
// und öffnet sie als neues Fenster zum Drucken oder als PDF speichern.
function buildDocumentHTML({ titel, rechnungsNr, datum, student, posten, total, typ }) {
    const isCredit = typ === 'gutschrift';
    const farbe = isCredit ? '#047857' : '#2563eb';
    const titleLabel = isCredit ? 'GUTSCHRIFT' : 'RECHNUNG';
    const totalSign = isCredit ? '−' : '';
    const fusszeile = isCredit
        ? 'Der Gutschriftbetrag wird auf das hinterlegte Konto überwiesen oder mit künftigen Rechnungen verrechnet.'
        : 'Zahlbar innerhalb von 14 Tagen ohne Abzug. Bitte geben Sie bei Überweisung die Rechnungsnummer an.';
    const rows = posten.map((p, i) => `
    <tr>
      <td class="num">${String(i + 1).padStart(2, '0')}</td>
      <td>
        <div class="b">${escapeHtml(p.titel)}</div>
        <div class="muted small">${escapeHtml(p.verlag || '')}</div>
      </td>
      <td class="mono small muted">${escapeHtml((p.isbn || '').slice(-13))}</td>
      <td class="right mono">${(p.betrag).toFixed(2).replace('.', ',')} €</td>
    </tr>
  `).join('');
    return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(titel)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, system-ui, 'Segoe UI', Inter, sans-serif; color: #1e293b; margin: 0; font-size: 11pt; line-height: 1.4; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { max-width: 174mm; margin: 0 auto; padding: 4mm 0; min-height: 250mm; display: flex; flex-direction: column; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 2px solid ${farbe}; margin-bottom: 22px; }
  .school { font-size: 14pt; font-weight: 700; color: #0f172a; letter-spacing: -0.01em; }
  .school-sub { font-size: 9pt; color: #64748b; margin-top: 3px; }
  .doc-title { font-size: 14pt; font-weight: 700; color: ${farbe}; letter-spacing: -0.01em; }
  .doc-nr { font-size: 9.5pt; color: #64748b; font-family: ui-monospace, 'JetBrains Mono', monospace; margin-top: 3px; }
  .right { text-align: right; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 22px; }
  .meta-label { font-size: 8pt; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 5px; font-weight: 600; }
  .b { font-weight: 600; }
  .mono { font-family: ui-monospace, 'JetBrains Mono', monospace; }
  .small { font-size: 9pt; }
  .muted { color: #64748b; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
  thead th { text-align: left; padding: 8px 0; font-size: 8pt; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; border-bottom: 1px solid #cbd5e1; }
  thead th.right { text-align: right; }
  tbody td { padding: 9px 0; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  tbody td.num { color: #94a3b8; font-family: ui-monospace, monospace; width: 30px; }
  tbody td.right { text-align: right; font-family: ui-monospace, monospace; }
  .totals { margin-left: auto; width: 70mm; }
  .totals .row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 10pt; color: #475569; }
  .totals .row.sep { border-bottom: 1px solid #cbd5e1; }
  .totals .row.total { font-size: 12pt; font-weight: 700; color: #0f172a; border-top: 2px solid #0f172a; padding-top: 9px; margin-top: 4px; }
  .footer { margin-top: auto; padding-top: 22px; border-top: 1px solid #e2e8f0; font-size: 8.5pt; color: #94a3b8; line-height: 1.6; }
  .toolbar { position: fixed; top: 12px; right: 12px; display: flex; gap: 8px; z-index: 100; }
  .toolbar button { font: inherit; font-size: 12px; padding: 8px 14px; border-radius: 7px; border: 1px solid #e2e8f0; background: #fff; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  .toolbar button.primary { background: ${farbe}; color: #fff; border-color: ${farbe}; }
  @media print { .toolbar { display: none; } body { background: #fff; } }
</style>
</head>
<body>
<div class="toolbar">
  <button class="primary" onclick="window.print()">Drucken / als PDF speichern</button>
  <button onclick="window.close()">Schließen</button>
</div>
<div class="page">
  <div class="head">
    <div>
      <div class="school">Städtisches Gymnasium</div>
      <div class="school-sub">Schulstraße 12 · 52538 Gangelt · Tel. 02454 / 12345</div>
    </div>
    <div class="right">
      <div class="doc-title">${titleLabel}</div>
      <div class="doc-nr">Nr. ${escapeHtml(rechnungsNr)}</div>
    </div>
  </div>

  <div class="meta">
    <div>
      <div class="meta-label">Empfänger</div>
      <div class="b">${escapeHtml(student.name)}</div>
      <div class="small muted">Klasse ${escapeHtml(student.klasse)}</div>
      <div class="small">${escapeHtml(student.strasse || '—')}</div>
      <div class="small">${escapeHtml((student.plz || '') + ' ' + (student.ort || ''))}</div>
    </div>
    <div class="right">
      <div class="meta-label">Datum</div>
      <div class="mono small">${escapeHtml(datum)}</div>
      <div class="meta-label" style="margin-top:10px">Schüler-ID</div>
      <div class="mono small">${escapeHtml(student.id)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Pos</th>
        <th>Bezeichnung</th>
        <th>ISBN</th>
        <th class="right">${isCredit ? 'Gutschrift' : 'Preis'}</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div class="row">
      <span>Zwischensumme</span>
      <span class="mono">${totalSign}${total.toFixed(2).replace('.', ',')} €</span>
    </div>
    <div class="row sep">
      <span>USt. (befreit § 4 Nr. 21 UStG)</span><span>—</span>
    </div>
    <div class="row total">
      <span>${isCredit ? 'Gutschriftbetrag' : 'Gesamt'}</span>
      <span class="mono">${totalSign}${total.toFixed(2).replace('.', ',')} €</span>
    </div>
  </div>

  <div class="footer">
    ${fusszeile}<br/>
    Sparkasse Heinsberg · IBAN DE12 3704 0044 0532 0130 00 · BIC COBADEFFXXX
  </div>
</div>
</body>
</html>`;
}
function escapeHtml(str) {
    const replacements = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    };
    return String(str ?? '').replace(/[&<>"']/g, (c) => replacements[c]);
}
function addProtectedPreviewChrome(w) {
    const d = w.document;
    if (!d || !d.body || !d.head)
        return;
    const style = d.createElement('style');
    style.textContent = `
    .codex-print-toolbar {
      position: fixed;
      top: 12px;
      right: 12px;
      z-index: 9999;
      display: flex;
      gap: 8px;
    }
    .codex-print-toolbar button {
      font: inherit;
      font-size: 12px;
      padding: 8px 14px;
      border-radius: 7px;
      border: 1px solid #d1d5db;
      background: #fff;
      color: #0f172a;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.15);
    }
    .codex-print-toolbar button.primary {
      background: #1d4ed8;
      border-color: #1d4ed8;
      color: #fff;
    }
    @media screen {
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #e5e7eb !important;
      }
      body {
        padding: 16px !important;
      }
      .codex-print-page {
        max-width: 210mm;
        min-height: 297mm;
        margin: 44px auto 20px;
        background: #fff;
        box-shadow: 0 10px 28px rgba(15, 23, 42, 0.18);
        padding: 18mm;
        overflow: hidden;
      }
      .footer {
        position: static !important;
        left: auto !important;
        right: auto !important;
        bottom: auto !important;
        margin-top: 16mm !important;
      }
    }
    @media print {
      .codex-print-toolbar { display: none !important; }
      html, body {
        background: #fff !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .codex-print-page {
        max-width: none !important;
        min-height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        overflow: visible !important;
      }
    }
  `;
    d.head.appendChild(style);
    const toolbar = d.createElement('div');
    toolbar.className = 'codex-print-toolbar';
    toolbar.innerHTML = `
    <button class="primary" type="button" data-action="print">Drucken/Speichern</button>
    <button type="button" data-action="close">Schließen</button>
  `;
    const page = d.createElement('div');
    page.className = 'codex-print-page';
    while (d.body.firstChild) {
        page.appendChild(d.body.firstChild);
    }
    d.body.appendChild(toolbar);
    d.body.appendChild(page);
    const printBtn = toolbar.querySelector('[data-action="print"]');
    const closeBtn = toolbar.querySelector('[data-action="close"]');
    if (printBtn)
        printBtn.addEventListener('click', () => w.print());
    if (closeBtn)
        closeBtn.addEventListener('click', () => w.close());
}
function writeToPrintWindow(w, html, autoPrint = false, options = {}) {
    const { addPreviewChrome = false } = options;
    w.document.open();
    w.document.write(html);
    w.document.close();
    if (addPreviewChrome) {
        addProtectedPreviewChrome(w);
    }
    if (autoPrint) {
        setTimeout(() => { try {
            w.focus();
            w.print();
        }
        catch (_error) { } }, 300);
    }
}
function openPrintWindow(html, autoPrint = false) {
    const w = window.open('', '_blank');
    if (!w) {
        window.showToast('error', 'Bitte Pop-ups für diese Seite erlauben, um die Rechnung anzuzeigen.');
        return;
    }
    writeToPrintWindow(w, html, autoPrint);
}
async function openProtectedDocument(path, autoPrint = false, options = {}) {
    const { addPreviewChrome = true } = options;
    const w = window.open('', '_blank');
    if (!w) {
        window.showToast('error', 'Bitte Pop-ups für diese Seite erlauben, um das Dokument anzuzeigen.');
        return;
    }
    w.document.write('<!doctype html><html><body style="font-family:system-ui;padding:16px;color:#334155">Dokument wird geladen...</body></html>');
    const token = localStorage.getItem('token');
    const headers = {};
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    try {
        let res = await fetch(path, { headers });
        if (!res.ok && res.status === 501 && path.includes('/pdf')) {
            const htmlPath = path.replace(/\/pdf(\?|$)/, '/html$1');
            res = await fetch(htmlPath, { headers });
        }
        if (!res.ok) {
            throw new Error(`Dokument konnte nicht geladen werden (HTTP ${res.status})`);
        }
        const contentType = (res.headers.get('content-type') || '').toLowerCase();
        if (contentType.includes('application/pdf')) {
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            w.location.replace(blobUrl);
            window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
            return;
        }
        const html = await res.text();
        writeToPrintWindow(w, html, autoPrint, { addPreviewChrome });
    }
    catch (error) {
        try {
            w.document.open();
            const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
            w.document.write(`<!doctype html><html><body style="font-family:system-ui;padding:16px;color:#991b1b;background:#fef2f2"><h3 style="margin:0 0 8px 0;font-size:16px">Dokument konnte nicht geöffnet werden</h3><p style="margin:0;font-size:14px">${escapeHtml(message)}</p></body></html>`);
            w.document.close();
        }
        catch (_error) { }
        throw error;
    }
}
function downloadAsHTMLFile(html, filename) {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}
window.buildDocumentHTML = buildDocumentHTML;
window.openPrintWindow = openPrintWindow;
window.openProtectedDocument = openProtectedDocument;
window.downloadAsHTMLFile = downloadAsHTMLFile;
