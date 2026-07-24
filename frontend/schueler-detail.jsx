// Schüler-Detailseite mit Kontoauszug

function ZahlungDialog({ schueler, accent, onClose, onSaved, initialData }) {
  const today = new Date().toISOString().slice(0, 10);
  const isEdit = !!initialData;
  const [betrag, setBetrag] = React.useState(
    initialData ? (initialData.betrag_cents / 100).toFixed(2).replace('.', ',') : ''
  );
  const [datum, setDatum] = React.useState(initialData?.datum || today);
  const [rechnungId, setRechnungId] = React.useState(initialData?.rechnung_id || '');
  const [notizen, setNotizen] = React.useState(initialData?.notizen || '');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleSave = async () => {
    const betragCents = Math.round(parseFloat(betrag.replace(',', '.')) * 100);
    if (!betrag || isNaN(betragCents) || betragCents <= 0) {
      setError('Bitte einen gültigen Betrag eingeben.');
      return;
    }
    if (!datum) {
      setError('Bitte ein Datum angeben.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        await window.api.zahlungen.update(initialData.id, {
          rechnung_id: rechnungId.trim() || null,
          datum,
          betrag_cents: betragCents,
          notizen: notizen.trim() || null,
        });
        window.showToast('success', 'Zahlung aktualisiert.');
      } else {
        await window.api.zahlungen.create({
          schueler_id: schueler.id,
          rechnung_id: rechnungId.trim() || null,
          datum,
          betrag_cents: betragCents,
          notizen: notizen.trim() || null,
        });
        window.showToast('success', 'Zahlung verbucht.');
      }
      onSaved();
    } catch (err) {
      setError(err.message || 'Fehler beim Speichern.');
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '8px 10px', fontSize: 13,
    border: '1px solid #e2e8f0', borderRadius: 7,
    fontFamily: 'inherit', color: '#0f172a', background: '#fff',
    boxSizing: 'border-box',
  };
  const labelStyle = { fontSize: 11.5, color: '#64748b', fontWeight: 500, marginBottom: 4, display: 'block' };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 400, boxShadow: '0 20px 60px rgba(15,23,42,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.01em' }}>{isEdit ? 'Zahlung bearbeiten' : 'Zahlung verbuchen'}</div>
            <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>{schueler.nachname}, {schueler.vorname}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div>
            <label style={labelStyle}>Betrag (€) *</label>
            <input
              autoFocus
              type="text"
              inputMode="decimal"
              placeholder="z.B. 24,90"
              value={betrag}
              onChange={(e) => setBetrag(e.target.value)}
              style={inputStyle}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>
          <div>
            <label style={labelStyle}>Datum *</label>
            <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Rechnung-Nr. (optional)</label>
            <input
              type="text"
              placeholder="z.B. R-2025-0042"
              value={rechnungId}
              onChange={(e) => setRechnungId(e.target.value)}
              style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}
            />
          </div>
          <div>
            <label style={labelStyle}>Notiz (optional)</label>
            <input type="text" placeholder="z.B. Überweisung, Barzahlung …" value={notizen} onChange={(e) => setNotizen(e.target.value)} style={inputStyle} />
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 12, padding: '8px 10px', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 7, fontSize: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <Btn kind="secondary" full onClick={onClose}>Abbrechen</Btn>
          <Btn kind="primary" full accent={accent} onClick={handleSave} disabled={saving}>
            {saving ? 'Wird gespeichert…' : 'Zahlung speichern'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

function AuszahlungDialog({ schueler, saldoCents, accent, onClose, onSaved }) {
  const today = new Date().toISOString().slice(0, 10);
  const [betrag, setBetrag] = React.useState((saldoCents / 100).toFixed(2).replace('.', ','));
  const [datum, setDatum] = React.useState(today);
  const [notizen, setNotizen] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleSave = async () => {
    const betragCents = Math.round(parseFloat(betrag.replace(',', '.')) * 100);
    if (!betrag || isNaN(betragCents) || betragCents <= 0) {
      setError('Bitte einen gültigen Betrag eingeben.');
      return;
    }
    if (betragCents > saldoCents) {
      setError(`Betrag übersteigt das verfügbare Guthaben (${(saldoCents / 100).toFixed(2).replace('.', ',')} €).`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await window.api.auszahlungen.create({
        schueler_id: schueler.id,
        betrag_cents: betragCents,
        datum,
        notizen: notizen.trim() || null,
      });
      window.showToast('success', 'Auszahlung verbucht.');
      onSaved();
    } catch (err) {
      setError(err.message || 'Fehler beim Speichern.');
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '8px 10px', fontSize: 13,
    border: '1px solid #e2e8f0', borderRadius: 7,
    fontFamily: 'inherit', color: '#0f172a', background: '#fff',
    boxSizing: 'border-box',
  };
  const labelStyle = { fontSize: 11.5, color: '#64748b', fontWeight: 500, marginBottom: 4, display: 'block' };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 400, boxShadow: '0 20px 60px rgba(15,23,42,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.01em' }}>Schulguthaben auszahlen</div>
            <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>{schueler.nachname}, {schueler.vorname} · Verfügbar: <span style={{ color: '#047857', fontFamily: 'JetBrains Mono, monospace' }}>{(saldoCents / 100).toFixed(2).replace('.', ',')} €</span></div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div>
            <label style={labelStyle}>Betrag (€) *</label>
            <input
              autoFocus
              type="text"
              inputMode="decimal"
              placeholder="z.B. 24,90"
              value={betrag}
              onChange={(e) => setBetrag(e.target.value)}
              style={inputStyle}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>
          <div>
            <label style={labelStyle}>Datum *</label>
            <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Notiz (optional)</label>
            <input type="text" placeholder="z.B. Barauszahlung, Überweisung …" value={notizen} onChange={(e) => setNotizen(e.target.value)} style={inputStyle} />
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 12, padding: '8px 10px', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 7, fontSize: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <Btn kind="secondary" full onClick={onClose}>Abbrechen</Btn>
          <Btn kind="primary" full accent={accent} onClick={handleSave} disabled={saving}>
            {saving ? 'Wird gespeichert…' : 'Auszahlung verbuchen'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

function SchuelerDetail({ schueler, accent, onBack, onNav }) {
  const isArchived = !!schueler.archiviert_am;
  const [detail, setDetail] = React.useState(null);
  const [aktiveBuecher, setAktiveBuecher] = React.useState([]);
  const [vorgaenge, setVorgaenge] = React.useState([]);
  const [zahlungen, setZahlungen] = React.useState([]);
  const [showZahlungDialog, setShowZahlungDialog] = React.useState(false);
  const [editZahlung, setEditZahlung] = React.useState(null);
  const [showAuszahlungDialog, setShowAuszahlungDialog] = React.useState(false);
  const [mailRechnung, setMailRechnung] = React.useState(null);
  const [stornoRechnung, setStornoRechnung] = React.useState(null);
  const [stornoWorking, setStornoWorking] = React.useState(false);
  const [archivWorking, setArchivWorking] = React.useState(false);

  const handleArchivieren = async () => {
    const aktiveOffeneBuecher = aktiveBuecher.filter(b => !b.zurueckgegeben);
    const hatAktiveBuecher = aktiveOffeneBuecher.length > 0;
    window.showConfirm({
      message: `${detail.nachname}, ${detail.vorname} archivieren?`,
      detail: hatAktiveBuecher
        ? `Schüler hat ${aktiveOffeneBuecher.length} nicht zurückgegebene${aktiveOffeneBuecher.length === 1 ? 's Buch' : ' Bücher'} — ${aktiveOffeneBuecher.length === 1 ? 'dieses wird' : 'diese werden'} als „behalten" markiert und aus dem aktiven Bestand entfernt.`
        : 'Der Schüler wird aus der aktiven Liste entfernt und kann jederzeit reaktiviert werden.',
      confirmLabel: 'Archivieren',
      danger: true,
      onConfirm: async () => {
        setArchivWorking(true);
        try {
          await window.api.schueler.archivieren([detail.id], hatAktiveBuecher);
          window.showToast('success', `${detail.nachname}, ${detail.vorname} wurde archiviert.`);
          onBack();
        } catch (err) {
          window.showToast('error', err.message || 'Fehler beim Archivieren.');
          setArchivWorking(false);
        }
      },
    });
  };

  const reload = () => {
    window.api.schueler.get(schueler.id).then(setDetail).catch(console.error);
    window.api.schueler.aktiveBuecher(schueler.id, { include_beschaedigte_rueckgaben: true }).then(res => setAktiveBuecher(res.items || [])).catch(console.error);
    window.api.schueler.vorgaenge(schueler.id).then(res => setVorgaenge(res.items || [])).catch(console.error);
    window.api.zahlungen.list(schueler.id).then(res => setZahlungen(res.items || [])).catch(console.error);
  };

  React.useEffect(() => {
    reload();
  }, [schueler.id]);

  React.useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') reload(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  if (!detail) {
    return <div style={{ padding: 40, color: '#64748b' }}>Lade Schülerdetails...</div>;
  }

  const saldo = detail.konto.saldo_cents / 100;
  const sichtbareVorgaenge = vorgaenge.filter(v => v.typ !== 'verrechnung');
  const offeneBuecher = aktiveBuecher.filter(b => !b.zurueckgegeben);
  const beschaedigteBuecher = aktiveBuecher.filter(b => b.beschaedigt);

  const saldoFarbe = saldo > 0.005 ? '#047857' : (saldo < -0.005 ? '#b91c1c' : '#64748b');
  const saldoLabel = saldo > 0.005 ? 'Guthaben' : (saldo < -0.005 ? 'Offen' : 'Ausgeglichen');
  const saldoBg    = saldo > 0.005 ? '#ecfdf5' : (saldo < -0.005 ? '#fef2f2' : '#f8fafc');
  const saldoBorder= saldo > 0.005 ? '#a7f3d0' : (saldo < -0.005 ? '#fecaca' : '#e8ecef');

  return (
    <div style={{ padding: '20px 40px 40px', maxWidth: 1180, margin: '0 auto' }}>
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'transparent', border: 'none',
        color: '#64748b', fontSize: 12.5, cursor: 'pointer',
        fontFamily: 'inherit', padding: '4px 0', marginBottom: 12,
      }}>
        <Icon name="chevron-right" size={14} style={{ transform: 'rotate(180deg)' }}/>
        <span>{isArchived ? 'Zurück zum Archiv' : 'Zurück zur Schülerliste'}</span>
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 22 }}>
        <Avatar name={detail.vorname + " " + detail.nachname} size={56}/>
        <div style={{ flex: 1, paddingTop: 4, minWidth: 0 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>{detail.nachname}, {detail.vorname}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, fontSize: 12.5, color: '#64748b', flexWrap: 'nowrap', overflow: 'hidden' }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap' }}>{detail.id}</span>
            <span style={{ color: '#cbd5e1', flexShrink: 0 }}>·</span>
            <Badge tone="slate" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>Klasse {detail.klasse}</Badge>
            {isArchived && <><span style={{ color: '#cbd5e1', flexShrink: 0 }}>·</span><Badge tone="slate" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>Archiviert</Badge></>}
            <span style={{ color: '#cbd5e1', flexShrink: 0 }}>·</span>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{detail.strasse || ''}{detail.plz ? `, ${detail.plz}` : ''} {detail.ort || ''}</span>
            {detail.email_eltern && (
              <>
                <span style={{ color: '#cbd5e1' }}>·</span>
                <a
                  href={`mailto:${detail.email_eltern}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    color: '#475569',
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                  title="E-Mail an Eltern senden"
                >
                  <Icon name="mail" size={13}/>
                  <span>{detail.email_eltern}</span>
                </a>
              </>
            )}
          </div>
        </div>
        {!isArchived && (
          <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
            <Btn kind="secondary" icon="cart" onClick={() => onNav('buchausgabe', detail)}>Buchausgabe</Btn>
            <Btn kind="secondary" icon="return" onClick={() => onNav('buchruckgabe', detail)}>Buchrückgabe</Btn>
            <Btn kind="secondary" icon="check" onClick={() => setShowZahlungDialog(true)}>Zahlung verbuchen</Btn>
            {detail.konto.saldo_cents > 0 && (
              <Btn kind="secondary" icon="arrow-right" accent={accent} onClick={() => setShowAuszahlungDialog(true)}>Guthaben auszahlen</Btn>
            )}
            <Btn kind="danger" icon="archive" onClick={handleArchivieren} disabled={archivWorking}>Archivieren</Btn>
          </div>
        )}
      </div>

      {/* Kontostand-Karte */}
      <div style={{
        background: saldoBg, border: `1px solid ${saldoBorder}`, borderRadius: 12,
        padding: '18px 22px', marginBottom: 22,
        display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 28, alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
            Schulguthaben · Kontostand
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 6 }}>
            <div style={{ fontSize: 32, fontWeight: 600, color: saldoFarbe, letterSpacing: '-0.02em', fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums' }}>
              {saldo > 0 ? '+' : ''}{saldo.toFixed(2).replace('.',',')} €
            </div>
            <Badge tone={saldo > 0.005 ? 'green' : (saldo < -0.005 ? 'red' : 'slate')} dot>{saldoLabel}</Badge>
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 6, lineHeight: 1.5, maxWidth: 540 }}>
            {saldo > 0.005
              ? 'Schulguthaben kann mit der nächsten Rechnung verrechnet oder am Schuljahresende ausgezahlt werden.'
              : saldo < -0.005
                ? 'Es bestehen offene Posten. Eine Mahnung oder Erinnerung an die Eltern empfehlenswert.'
                : 'Alle Vorgänge sind ausgeglichen. Keine offenen Forderungen oder Guthaben.'}
          </div>
        </div>
        <div style={{ borderLeft: '1px solid rgba(15,23,42,0.08)', paddingLeft: 24, paddingRight: 8 }}>
          <div style={{ fontSize: 10.5, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
            Gekaufte Bücher
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, color: '#0f172a', marginTop: 4, fontFamily: 'JetBrains Mono, monospace' }}>
            {offeneBuecher.length}
          </div>
          {detail.konto.anzahl_behalten_buecher > 0 ? (
            <div style={{ fontSize: 11, color: '#b45309', marginTop: 1, fontWeight: 500 }}>
              {detail.konto.anzahl_behalten_buecher} behalten
            </div>
          ) : beschaedigteBuecher.length > 0 ? (
            <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 1, fontWeight: 500 }}>
              {beschaedigteBuecher.length} nicht zurückgenommen
            </div>
          ) : (
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>im Schuljahr 2025/26</div>
          )}
        </div>
        <div style={{ borderLeft: '1px solid rgba(15,23,42,0.08)', paddingLeft: 24 }}>
          <div style={{ fontSize: 10.5, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
            Vorgänge
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, color: '#0f172a', marginTop: 4, fontFamily: 'JetBrains Mono, monospace' }}>
            {sichtbareVorgaenge.length}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>seit Schuljahresbeginn</div>
        </div>
      </div>

      {(showZahlungDialog || editZahlung) && (
        <ZahlungDialog
          schueler={detail}
          accent={accent}
          initialData={editZahlung}
          onClose={() => { setShowZahlungDialog(false); setEditZahlung(null); }}
          onSaved={() => { setShowZahlungDialog(false); setEditZahlung(null); reload(); }}
        />
      )}
      {showAuszahlungDialog && (
        <AuszahlungDialog
          schueler={detail}
          saldoCents={detail.konto.saldo_cents}
          accent={accent}
          onClose={() => setShowAuszahlungDialog(false)}
          onSaved={() => { setShowAuszahlungDialog(false); reload(); }}
        />
      )}
      {mailRechnung && window.RechnungMailDialog && (
        <window.RechnungMailDialog
          rechnung={mailRechnung}
          accent={accent}
          onClose={() => setMailRechnung(null)}
          onSent={() => { setMailRechnung(null); reload(); }}
        />
      )}
      {stornoRechnung && window.StornoDialog && (
        <window.StornoDialog
          rechnung={stornoRechnung}
          accent={accent}
          working={stornoWorking}
          onClose={() => setStornoRechnung(null)}
          onConfirm={async (payload) => {
            setStornoWorking(true);
            try {
              const result = await window.api.rechnung.storno(stornoRechnung.id, payload);
              const credit = result?.gutschrift_id ? ` Guthaben ${result.gutschrift_id} wurde angelegt.` : '';
              window.showToast('success', `Storno für ${stornoRechnung.anzeige_nr || stornoRechnung.id} gebucht.${credit}`);
              setStornoRechnung(null);
              reload();
            } catch (err) {
              window.showToast('error', err.message || 'Rechnung konnte nicht storniert werden.');
            } finally {
              setStornoWorking(false);
            }
          }}
        />
      )}

      {/* Zwei-Spalten: Vorgangs-Historie + gekaufte Bücher */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>

        {/* Vorgangs-Historie */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', margin: 0, letterSpacing: '-0.005em' }}>Vorgangs-Historie</h2>
            <span style={{ fontSize: 11.5, color: '#94a3b8' }}>{sichtbareVorgaenge.length} Einträge · chronologisch</span>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e8ecef', borderRadius: 10, overflow: 'hidden' }}>
            {sichtbareVorgaenge.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                Noch keine Vorgänge erfasst.
              </div>
            ) : (
              <KontoauszugTabelle
                vorgaenge={sichtbareVorgaenge}
                accent={accent}
                onSendRechnungMail={(v) => setMailRechnung({
                  id: v.id,
                  schueler_name: `${detail.nachname}, ${detail.vorname}`,
                  status: 'offen',
                })}
                onStornoRechnung={(v) => setStornoRechnung({
                  id: v.id,
                  anzeige_nr: v.id,
                  schueler_name: `${detail.nachname}, ${detail.vorname}`,
                })}
                onEditZahlung={isArchived ? null : (v) => {
                  const z = zahlungen.find(z => String(z.id) === String(v.id));
                  if (z) setEditZahlung(z);
                }}
                onDeleteZahlung={isArchived ? null : async (v) => {
                  try {
                    await window.api.zahlungen.remove(v.id);
                    window.showToast('success', 'Zahlung gelöscht.');
                    reload();
                  } catch (err) {
                    window.showToast('error', err.message || 'Fehler beim Löschen.');
                  }
                }}
                onDeleteAuszahlung={isArchived ? null : async (v) => {
                  try {
                    await window.api.auszahlungen.remove(v.id);
                    window.showToast('success', 'Auszahlung gelöscht.');
                    reload();
                  } catch (err) {
                    window.showToast('error', err.message || 'Fehler beim Löschen.');
                  }
                }}
              />
            )}
          </div>
        </div>

        {/* Gekaufte Bücher Sidebar */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', margin: 0, letterSpacing: '-0.005em' }}>Gekaufte Bücher</h2>
            <span style={{ fontSize: 11.5, color: '#94a3b8' }}>
              {offeneBuecher.length} offen{beschaedigteBuecher.length > 0 ? ` · ${beschaedigteBuecher.length} nicht zurückgenommen` : ''}
            </span>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e8ecef', borderRadius: 10, overflow: 'hidden' }}>
            {aktiveBuecher.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 12.5 }}>
                Keine offenen Ausleihen.
              </div>
            ) : aktiveBuecher.map((b, i) => {
              const fachText = (b.fach || 'Fach').toString();
              const hue = (fachText.charCodeAt(0) * 7) % 360;
              const isBeschaedigt = !!b.beschaedigt;
              return (
                <div key={b.rechnungs_posten_id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px',
                  borderTop: i === 0 ? 'none' : '1px solid #f8fafc',
                  background: isBeschaedigt ? '#fff7f7' : 'transparent',
                }}>
                  <div style={{
                    width: 28, height: 36, borderRadius: 3,
                    background: `oklch(0.94 0.04 ${hue})`,
                    color: `oklch(0.40 0.10 ${hue})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, fontWeight: 600, flexShrink: 0,
                    border: '1px solid rgba(0,0,0,.06)',
                  }}>{fachText.slice(0, 3).toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.titel}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10.5, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>{(b.preis_cents / 100).toFixed(2).replace('.',',')} €</span>
                      {isBeschaedigt && (
                        <span style={{
                          fontSize: 10,
                          color: '#b91c1c',
                          background: '#fee2e2',
                          border: '1px solid #fecaca',
                          borderRadius: 999,
                          padding: '1px 6px',
                          fontWeight: 600,
                        }}>
                          Nicht zurückgenommen
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function KontoauszugTabelle({ vorgaenge, accent, onEditZahlung, onDeleteZahlung, onDeleteAuszahlung, onSendRechnungMail, onStornoRechnung }) {
  const [confirmDeleteId, setConfirmDeleteId] = React.useState(null);
  const formatDateSafe = (value) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value || '—');
    return d.toLocaleDateString('de-DE');
  };
  const typLabel = {
    rechnung:   { label: 'Rechnung',   tone: 'blue',  icon: 'invoice' },
    gutschrift: { label: 'Gutschrift', tone: 'green', icon: 'return' },
    zahlung:    { label: 'Zahlung',    tone: 'slate', icon: 'check' },
    auszahlung: { label: 'Auszahlung', tone: 'orange', icon: 'arrow-right' },
  };

  return (
    <div>
      <div style={{
        display: 'grid', gridTemplateColumns: '90px 130px 1fr 110px 90px 78px',
        gap: 12, padding: '10px 16px',
        borderBottom: '1px solid #f1f5f9',
        background: '#fbfcfd',
        fontSize: 10.5, color: '#94a3b8', fontWeight: 600,
        letterSpacing: '0.05em', textTransform: 'uppercase',
      }}>
        <div>Datum</div>
        <div>Typ</div>
        <div>Bezeichnung</div>
        <div style={{ textAlign: 'right' }}>Betrag</div>
        <div>Status</div>
        <div />
      </div>
      {vorgaenge.map((v, i) => {
        const meta = typLabel[v.typ] || typLabel.rechnung;
        const betrag = v.betrag_cents / 100;
        const ist = betrag >= 0 ? '#047857' : '#0f172a';
        const pdfUrl = v.typ === 'rechnung'
          ? window.api.rechnung.pdf(v.id)
          : v.typ === 'gutschrift'
            ? window.api.gutschriften.pdf(v.id)
            : v.typ === 'auszahlung' && typeof window.api?.auszahlungen?.pdf === 'function'
              ? window.api.auszahlungen.pdf(v.id)
              : null;
        return (
          <div key={`${v.typ}-${v.id}-${v.datum}-${i}`} style={{
            display: 'grid', gridTemplateColumns: '90px 130px 1fr 110px 90px 78px',
            gap: 12, padding: '12px 16px',
            alignItems: 'center',
            borderTop: i === 0 ? 'none' : '1px solid #f8fafc',
          }}>
            <div style={{ fontSize: 11.5, color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>{formatDateSafe(v.datum)}</div>
            <div><Badge tone={meta.tone} dot>{meta.label}</Badge></div>
            <div>
              <div style={{ fontSize: 12.5, color: '#0f172a', letterSpacing: '-0.005em' }}>{v.bezeichnung}</div>
              {v.typ !== 'zahlung' && v.typ !== 'auszahlung' && <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace', marginTop: 1 }}>{v.id}</div>}
            </div>
            <div style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 500, color: ist, fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums' }}>
              {betrag >= 0 ? '+' : ''}{betrag.toFixed(2).replace('.',',')} €
            </div>
            <div>
              {v.typ === 'rechnung' && (
                v.mail_versandt_am
                  ? <Badge tone="green">Versandt</Badge>
                  : <Badge tone="yellow">Erstellt</Badge>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
              {(v.typ === 'zahlung' || v.typ === 'auszahlung') ? (
                confirmDeleteId === v.id ? (
                  <>
                    <button
                      onClick={() => {
                        if (v.typ === 'auszahlung') onDeleteAuszahlung?.(v);
                        else onDeleteZahlung?.(v);
                        setConfirmDeleteId(null);
                      }}
                      style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: '#b91c1c', fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit' }}
                    >Ja</button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: '#475569', fontSize: 11.5, fontFamily: 'inherit' }}
                    >Nein</button>
                  </>
                ) : (
                  <>
                    {v.typ === 'zahlung' && (
                      <button
                        title="Bearbeiten"
                        onClick={() => onEditZahlung?.(v)}
                        style={{ background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.color = '#0f172a'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
                      >
                        <Icon name="edit" size={13} />
                      </button>
                    )}
                    {v.typ === 'auszahlung' && pdfUrl && (
                      <button
                        title="Beleg öffnen"
                        onClick={async () => {
                          try {
                            await window.openProtectedDocument(pdfUrl, false);
                          } catch (err) {
                            window.showToast('error', err.message || 'Beleg konnte nicht geöffnet werden.');
                          }
                        }}
                        style={{ background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.color = '#0f172a'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
                      >
                        <Icon name="download" size={13} />
                      </button>
                    )}
                    <button
                      title="Löschen"
                      onClick={() => setConfirmDeleteId(v.id)}
                      style={{ background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#fca5a5'; e.currentTarget.style.color = '#b91c1c'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </>
                )
              ) : pdfUrl ? (
                <button
                  data-tooltip="PDF öffnen"
                  onClick={async () => {
                    try {
                      await window.openProtectedDocument(pdfUrl, false);
                    } catch (err) {
                      window.showToast('error', err.message || 'Dokument konnte nicht geöffnet werden.');
                    }
                  }}
                  style={{ background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.color = '#0f172a'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
                >
                  <Icon name="download" size={13} />
                </button>
              ) : null}
              {v.typ === 'rechnung' && onSendRechnungMail && (
                <button
                  data-tooltip="Per E-Mail senden"
                  onClick={() => onSendRechnungMail(v)}
                  style={{ background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.color = '#0f172a'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
                >
                  <Icon name="mail" size={13} />
                </button>
              )}
              {v.typ === 'rechnung' && onStornoRechnung && (
                <button
                  data-tooltip="Stornieren"
                  onClick={() => onStornoRechnung(v)}
                  style={{ background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#fca5a5'; e.currentTarget.style.color = '#b91c1c'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
                >
                  <Icon name="undo" size={13} />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

window.SchuelerDetail = SchuelerDetail;
