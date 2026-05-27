// Home / Dashboard - "Startseite mit großen Aktionen"

function ArchivLoeschenPanel({ item, onClose, onErledigt }) {
  const [selected, setSelected] = React.useState(() => new Set(item.schueler.map(s => s.id)));
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const alleGewaehlt = selected.size === item.schueler.length;

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const loeschen = async () => {
    if (selected.size === 0) return;
    setLoading(true); setError(null);
    try {
      const res = await window.api.benachrichtigungen.loescheArchiv([...selected]);
      onErledigt(res.geloescht);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal onClose={onClose} width={560}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: '#fef3c7', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="archive" size={17}/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>Archiv-Löschung bestätigen</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Aufbewahrungsfrist von 10 Schuljahren abgelaufen</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}>
          <Icon name="x" size={16}/>
        </button>
      </div>
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#475569', userSelect: 'none' }}>
          <input type="checkbox" checked={alleGewaehlt} onChange={() => setSelected(alleGewaehlt ? new Set() : new Set(item.schueler.map(s => s.id)))} style={{ width: 14, height: 14 }}/>
          Alle auswählen ({item.schueler.length})
        </label>
      </div>
      <div style={{ maxHeight: 320, overflowY: 'auto' }}>
        {item.schueler.map((s, i) => (
          <label key={s.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 20px',
            borderTop: i === 0 ? 'none' : '1px solid #f8fafc',
            cursor: 'pointer', userSelect: 'none',
            background: selected.has(s.id) ? '#fffbeb' : 'transparent',
            transition: 'background .1s',
          }}>
            <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} style={{ width: 14, height: 14, flexShrink: 0 }}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a' }}>{s.name}</div>
              <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 1 }}>Klasse {s.klasse} · archiviert {s.archiviert_schuljahr}</div>
            </div>
          </label>
        ))}
      </div>
      {error && <div style={{ margin: '10px 20px 0', padding: '8px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 12.5, color: '#b91c1c' }}>{error}</div>}
      <div style={{ padding: '14px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Btn kind="ghost" onClick={onClose} disabled={loading}>Abbrechen</Btn>
        <Btn
          kind="primary"
          accent="#b45309"
          icon="trash-2"
          onClick={loeschen}
          disabled={selected.size === 0 || loading}
        >
          {loading ? 'Lösche…' : `${selected.size} ${selected.size === 1 ? 'Schüler' : 'Schüler'} löschen`}
        </Btn>
      </div>
    </Modal>
  );
}

function GlockePanel({ benachrichtigungen, onClose, onRefresh }) {
  const [aktiveItem, setAktiveItem] = React.useState(null);

  if (aktiveItem) {
    return (
      <ArchivLoeschenPanel
        item={aktiveItem}
        onClose={() => setAktiveItem(null)}
        onErledigt={(n) => { setAktiveItem(null); onRefresh(); onClose(); }}
      />
    );
  }

  return (
    <div style={{
      position: 'absolute', top: 48, right: 0,
      width: 360, zIndex: 200,
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: 12,
      boxShadow: '0 8px 24px rgba(15,23,42,0.10)',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '13px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a' }}>Benachrichtigungen</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 2 }}>
          <Icon name="x" size={15}/>
        </button>
      </div>
      {benachrichtigungen.length === 0 ? (
        <div style={{ padding: '28px 20px', textAlign: 'center' }}>
          <div style={{ color: '#cbd5e1', marginBottom: 8 }}><Icon name="check-circle" size={28}/></div>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>Keine Benachrichtigungen.</div>
        </div>
      ) : benachrichtigungen.map((b, i) => (
        <div key={b.typ} style={{ padding: '14px 16px', borderTop: i === 0 ? 'none' : '1px solid #f8fafc' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fef3c7', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
              <Icon name="archive" size={15}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{b.titel}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 3, lineHeight: 1.45 }}>{b.beschreibung}</div>
              <button
                onClick={() => setAktiveItem(b)}
                style={{
                  marginTop: 10, padding: '5px 12px', borderRadius: 6,
                  background: '#fffbeb', border: '1px solid #fde68a',
                  fontSize: 12, fontWeight: 500, color: '#b45309',
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                }}
              >
                <Icon name="trash-2" size={12}/> Auswählen & löschen
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Home({ onNav, onOpenStudent, accent, density }) {
  const [stats, setStats] = React.useState(null);
  const [schuljahresBeginn, setSchuljahresBeginn] = React.useState(null);
  const [unversandt, setUnversandt] = React.useState([]);
  const [activeStat, setActiveStat] = React.useState(null);
  const [benachrichtigungen, setBenachrichtigungen] = React.useState([]);
  const [showGlocke, setShowGlocke] = React.useState(false);
  const glockeRef = React.useRef(null);

  const ladebenachrichtigungen = () => {
    window.api.benachrichtigungen.list().then(res => setBenachrichtigungen(res.items || [])).catch(console.error);
  };

  React.useEffect(() => {
    window.api.dashboard().then(setStats).catch(console.error);
    window.api.einstellungen.get().then(e => {
      if (e.schuljahr_naechster_beginn) setSchuljahresBeginn(e.schuljahr_naechster_beginn);
    }).catch(console.error);
    window.api.buchhaltung.unversandt().then(res => setUnversandt(res.items || [])).catch(console.error);
    ladebenachrichtigungen();
  }, []);

  React.useEffect(() => {
    if (!showGlocke) return;
    const handler = (e) => {
      if (glockeRef.current && !glockeRef.current.contains(e.target)) {
        setShowGlocke(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showGlocke]);

  const gesamtAnzahl = benachrichtigungen.reduce((s, b) => s + (b.anzahl || 0), 0);

  const ActionCard = ({ id, icon, title, subtitle, tone }) => (
    <button onClick={() => onNav(id)} style={{
      flex: 1, minWidth: 0,
      background: '#fff',
      border: '1px solid #e8ecef',
      borderRadius: 12,
      padding: '22px 22px 22px',
      textAlign: 'left',
      cursor: 'pointer',
      display: 'flex', flexDirection: 'column', gap: 12,
      transition: 'all .15s',
      fontFamily: 'inherit',
      position: 'relative',
      overflow: 'hidden',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(15,23,42,0.05)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e8ecef'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 9,
        background: tone.bg, color: tone.fg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={icon} size={19} stroke={1.75}/>
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.015em' }}>{title}</div>
        <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4, lineHeight: 1.4 }}>{subtitle}</div>
      </div>
    </button>
  );

  const Stat = ({ label, value, hint, hintTone, detail }) => (
    <button
      type="button"
      onClick={() => setActiveStat(detail)}
      style={{
        flex: 1,
        padding: '14px 16px',
        background: 'transparent',
        border: 'none',
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'inherit',
        minWidth: 0,
        transition: 'background .12s',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      aria-label={`${label} Details anzeigen`}
      title={`${label} Details anzeigen`}
    >
      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, letterSpacing: '0.02em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: '#0f172a', marginTop: 6, letterSpacing: '-0.02em', fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {hint && <div style={{ fontSize: 11.5, color: hintTone === 'red' ? '#b91c1c' : '#64748b', marginTop: 4 }}>{hint}</div>}
    </button>
  );

  if (!stats) {
    return <div style={{ padding: 40, color: '#64748b' }}>Lade Dashboard...</div>;
  }

  const heute = new Date();
  heute.setHours(0, 0, 0, 0);
  const terminDatum = schuljahresBeginn ? new Date(schuljahresBeginn) : null;
  const tageVerbleibend = terminDatum ? Math.ceil((terminDatum - heute) / 86400000) : null;
  const terminIstHeute = tageVerbleibend === 0;
  const terminAbgelaufen = tageVerbleibend !== null && tageVerbleibend < 0;

  const hour = new Date().getHours();
  let greeting = "Guten Morgen";
  if (hour >= 12 && hour < 18) greeting = "Guten Tag";
  else if (hour >= 18) greeting = "Guten Abend";

  const monatLabel = new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  const statDetails = {
    verkaeufe: {
      title: 'Verkäufe im Monat',
      badge: 'Version 2.0',
      icon: 'cart',
      tone: '#2563eb',
      value: stats.verkaeufe_monat,
      amountLabel: 'Umsatz',
      amount: `${(stats.umsatz_monat_cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €`,
      period: monatLabel,
      description: 'Zählt alle nicht stornierten Rechnungen ab dem ersten Tag des aktuellen Monats.',
      formula: 'Rechnungen mit Status ungleich "storniert" und Datum im aktuellen Monat.',
      actionLabel: 'Zur Buchhaltung',
      action: () => onNav('buchhaltung'),
    },
    rueckgaben: {
      title: 'Rückgaben im Monat',
      badge: 'Version 2.0',
      icon: 'return',
      tone: '#047857',
      value: stats.rueckgaben_monat,
      amountLabel: 'Gutschriften',
      amount: `${(stats.gutschriften_monat_cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €`,
      period: monatLabel,
      description: 'Zählt alle erstellten Gutschriften ab dem ersten Tag des aktuellen Monats.',
      formula: 'Gutschriften mit Datum im aktuellen Monat.',
      actionLabel: 'Rückgabe starten',
      action: () => onNav('rueckgabe'),
    },
    ausleihen: {
      title: 'Offene Ausleihen',
      badge: 'Version 2.0',
      icon: 'book',
      tone: '#7c3aed',
      value: stats.offene_ausleihen,
      amountLabel: 'Bestand',
      amount: 'laufendes Schuljahr',
      period: 'Aktueller Datenstand',
      description: 'Zeigt alle Bücher aus aktiven Rechnungen, die noch nicht als zurückgegeben markiert sind.',
      formula: 'Rechnungsposten ohne Rückgabe, deren Rechnung nicht storniert wurde.',
      actionLabel: 'Schüler suchen',
      action: () => onNav('schueler'),
    },
  };

  const StatDetailDialog = ({ detail, onClose }) => {
    if (!detail) return null;
    return (
      <Modal onClose={onClose} width={520}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 9,
            background: `${detail.tone}14`, color: detail.tone,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon name={detail.icon} size={18}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.015em' }}>{detail.title}</h2>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>{detail.period}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4, display: 'flex' }} aria-label="Schließen">
            <Icon name="x" size={17}/>
          </button>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div style={{ border: '1px solid #e8ecef', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Anzahl</div>
              <div style={{ fontSize: 26, fontWeight: 650, color: '#0f172a', marginTop: 4, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>{detail.value}</div>
            </div>
            <div style={{ border: '1px solid #e8ecef', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{detail.amountLabel}</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: detail.tone, marginTop: 8, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>{detail.amount}</div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, marginBottom: 12 }}>
            {detail.description}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Btn kind="ghost" onClick={onClose}>Schließen</Btn>
            <Btn kind="primary" accent={detail.tone} icon="arrow-right" onClick={() => { onClose(); detail.action(); }}>{detail.actionLabel}</Btn>
          </div>
        </div>
      </Modal>
    );
  };

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11.5, color: '#94a3b8', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {new Date().toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 600, color: '#0f172a', margin: '6px 0 0', letterSpacing: '-0.02em', fontFamily: "'Playfair Display', Georgia, serif" }}>
            {greeting}.
          </h1>
          <div style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>
            Was möchten Sie als Nächstes erledigen?
          </div>
        </div>

        {/* Benachrichtigungs-Glocke */}
        <div ref={glockeRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowGlocke(v => !v)}
            title="Benachrichtigungen"
            style={{
              position: 'relative',
              background: showGlocke ? '#f1f5f9' : '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              width: 40, height: 40,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: gesamtAnzahl > 0 ? '#b45309' : '#64748b',
              transition: 'all .15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
            onMouseLeave={e => e.currentTarget.style.background = showGlocke ? '#f1f5f9' : '#fff'}
          >
            <Icon name="bell" size={18} stroke={1.75}/>
            {gesamtAnzahl > 0 && (
              <span style={{
                position: 'absolute', top: -5, right: -5,
                background: '#b45309', color: '#fff',
                fontSize: 10, fontWeight: 700,
                borderRadius: 999, minWidth: 17, height: 17,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 4px', border: '1.5px solid #fff',
              }}>{gesamtAnzahl}</span>
            )}
          </button>

          {showGlocke && (
            <GlockePanel
              benachrichtigungen={benachrichtigungen}
              onClose={() => setShowGlocke(false)}
              onRefresh={ladebenachrichtigungen}
            />
          )}
        </div>
      </div>

      {/* Big action cards */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 24 }}>
        <ActionCard
          id="kombiniert" icon="refresh-cw"
          title="Ausgabe & Rückgabe"
          subtitle="Rückgabe und Neuausgabe in einem Schritt."
          tone={{ bg: '#fff7ed', fg: '#c2410c' }}
        />
        <ActionCard
          id="verkauf" icon="cart"
          title="Buchausgabe"
          subtitle="Bücher ausgeben und Rechnung erstellen."
          tone={{ bg: '#eff6ff', fg: accent }}
        />
        <ActionCard
          id="rueckgabe" icon="return"
          title="Buchrückgabe"
          subtitle="Bücher zurücknehmen und Gutschrift ausstellen."
          tone={{ bg: '#ecfdf5', fg: '#047857' }}
        />
        <ActionCard
          id="schueler" icon="search"
          title="Schüler suchen"
          subtitle="Stammdaten, Vorgänge und Rechnungen einsehen."
          tone={{ bg: '#f5f3ff', fg: '#6d28d9' }}
        />
      </div>

      {/* Stats strip */}
      <div style={{
        display: 'flex',
        background: '#fff', border: '1px solid #e8ecef', borderRadius: 10,
        marginBottom: 24,
        overflow: 'hidden',
      }}>
        <Stat label="Verkäufe (Monat)" value={stats.verkaeufe_monat} hint={`${(stats.umsatz_monat_cents / 100).toLocaleString('de-DE', {minimumFractionDigits:2})} € Umsatz`} detail={statDetails.verkaeufe}/>
        <div style={{ width: 1, background: '#f1f5f9' }}/>
        <Stat label="Rückgaben (Monat)" value={stats.rueckgaben_monat} hint={`${(stats.gutschriften_monat_cents / 100).toLocaleString('de-DE', {minimumFractionDigits:2})} € Gutschrift`} detail={statDetails.rueckgaben}/>
        <div style={{ width: 1, background: '#f1f5f9' }}/>
        <Stat label="Offene Ausleihen" value={stats.offene_ausleihen} hint="aus laufendem Schuljahr" detail={statDetails.ausleihen}/>
      </div>

      {/* Recent activity & Infos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14 }}>

        <div style={{ background: '#fff', border: '1px solid #e8ecef', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.005em' }}>Letzte Vorgänge</div>
          </div>
          {stats.letzte_vorgaenge.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              Noch keine Vorgänge vorhanden.
            </div>
          ) : stats.letzte_vorgaenge.map((v, i) => {
            const typMeta = {
              rechnung:   { tone: 'blue',   icon: 'invoice',     label: 'Rechnung'    },
              gutschrift: { tone: 'green',  icon: 'return',      label: 'Gutschrift'  },
              zahlung:    { tone: 'slate',  icon: 'check',       label: 'Zahlung'     },
              auszahlung: { tone: 'orange', icon: 'arrow-right', label: 'Auszahlung'  },
            }[v.typ] || { tone: 'slate', icon: 'circle', label: v.typ };

            const betrag = v.betrag_cents / 100;
            const betragFarbe = betrag >= 0 ? '#047857' : '#0f172a';

            const erstellt = new Date(v.erstellt_am.replace(' ', 'T') + 'Z');
            const jetzt = new Date();
            const diffMin = Math.floor((jetzt - erstellt) / 60000);
            let zeitLabel;
            if (diffMin < 1) zeitLabel = 'Gerade eben';
            else if (diffMin < 60) zeitLabel = `Vor ${diffMin} Min.`;
            else if (diffMin < 1440) zeitLabel = `Vor ${Math.floor(diffMin / 60)} Std.`;
            else zeitLabel = erstellt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

            return (
              <div key={v.id + v.typ}
                onClick={() => onOpenStudent && onOpenStudent({ id: v.schueler_id })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 18px',
                  borderTop: i === 0 ? 'none' : '1px solid #f8fafc',
                  cursor: 'pointer',
                  transition: 'background .1s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={(e) => e.currentTarget.style.background = ''}
              >
                <div style={{ flexShrink: 0, width: 80 }}>
                  <Badge tone={typMeta.tone} dot>{typMeta.label}</Badge>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {v.schueler_name}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 1, display: 'flex', gap: 5 }}>
                    {v.typ !== 'zahlung' && v.typ !== 'auszahlung' && (
                      <>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>{v.id}</span>
                        <span>·</span>
                      </>
                    )}
                    <span>{zeitLabel}</span>
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: betragFarbe, fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                  {betrag >= 0 ? '+' : ''}{betrag.toFixed(2).replace('.', ',')} €
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ color: unversandt.length > 0 ? '#b45309' : '#94a3b8' }}>
                <Icon name="mail" size={15}/>
              </span>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.005em' }}>Unversandte Rechnungen</div>
            </div>
            {unversandt.length === 0 ? (
              <div style={{ fontSize: 12.5, color: '#94a3b8', lineHeight: 1.5 }}>Alle Rechnungen wurden bereits versandt.</div>
            ) : (
              <>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#b45309', letterSpacing: '-0.02em', fontFamily: 'JetBrains Mono, monospace', marginBottom: 6 }}>
                  {unversandt.length}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, marginBottom: 10 }}>
                  {unversandt.length === 1 ? 'Rechnung wartet' : 'Rechnungen warten'} auf den Versand per E-Mail.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                  {unversandt.slice(0, 3).map(r => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#475569' }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8', fontSize: 11 }}>{r.id}</span>
                      <span style={{ flex: 1, marginLeft: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.schueler_name}</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', marginLeft: 8, flexShrink: 0 }}>{(r.zu_zahlen_cents / 100).toFixed(2).replace('.', ',')} €</span>
                    </div>
                  ))}
                  {unversandt.length > 3 && (
                    <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>… und {unversandt.length - 3} weitere</div>
                  )}
                </div>
              </>
            )}
            <button onClick={() => onNav('buchhaltung')} style={{
              marginTop: unversandt.length === 0 ? 8 : 0,
              width: '100%', padding: '7px 12px', borderRadius: 7,
              background: unversandt.length > 0 ? '#fffbeb' : '#fff',
              border: unversandt.length > 0 ? '1px solid #fde68a' : '1px solid #e2e8f0',
              fontSize: 12.5, color: unversandt.length > 0 ? '#b45309' : '#0f172a',
              fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <Icon name="mail" size={13}/> Zum Rechnungsversand
            </button>
          </Card>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ color: terminIstHeute ? '#047857' : terminAbgelaufen ? '#b91c1c' : '#b45309' }}>
                <Icon name="calendar" size={15}/>
              </span>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.005em' }}>Schuljahresbeginn</div>
            </div>
            {tageVerbleibend === null ? (
              <div style={{ fontSize: 12.5, color: '#94a3b8', lineHeight: 1.5 }}>
                Kein Termin konfiguriert.{' '}
                <span style={{ color: '#64748b' }}>In den Einstellungen unter „Nächster Schuljahresbeginn" eintragen.</span>
              </div>
            ) : terminIstHeute ? (
              <div style={{ fontSize: 12.5, color: '#047857', fontWeight: 500, lineHeight: 1.5 }}>
                Heute ist der erste Tag des neuen Schuljahres!
                <div style={{ fontSize: 12, color: '#475569', fontWeight: 400, marginTop: 4 }}>
                  Jetzt Klassenversetzung durchführen.
                </div>
              </div>
            ) : terminAbgelaufen ? (
              <div style={{ fontSize: 12.5, color: '#b91c1c', lineHeight: 1.5 }}>
                Schuljahresbeginn war vor{' '}
                <strong>{Math.abs(tageVerbleibend)} {Math.abs(tageVerbleibend) === 1 ? 'Tag' : 'Tagen'}</strong>.
                <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>Versetzung steht noch aus.</div>
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.5 }}>
                Noch{' '}
                <strong style={{
                  color: '#0f172a',
                  fontSize: tageVerbleibend <= 14 ? 16 : 13,
                }}>
                  {tageVerbleibend} {tageVerbleibend === 1 ? 'Tag' : 'Tage'}
                </strong>{' '}
                bis zum{' '}
                <span style={{ color: '#64748b' }}>
                  {terminDatum.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}.
                </span>
              </div>
            )}
            <button onClick={() => onNav('klassenversetzung')} style={{
              marginTop: 12, width: '100%',
              padding: '7px 12px', borderRadius: 7,
              background: '#eff6ff', border: '1px solid #bfdbfe',
              fontSize: 12.5, color: '#1d4ed8',
              fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <Icon name="arrow-right" size={13}/> Zur Klassenversetzung
            </button>
          </Card>
        </div>
      </div>
      <StatDetailDialog detail={activeStat} onClose={() => setActiveStat(null)} />
    </div>
  );
}

window.Home = Home;
