
function invFormatEur(cents) {
  return (Number(cents || 0) / 100).toFixed(2).replace('.', ',') + ' EUR';
}

function invGetAbschlaege(settings) {
  settings = settings || {};
  return {
    1: Number(settings.nutzungsjahr_abschlag_1_prozent != null ? settings.nutzungsjahr_abschlag_1_prozent : 0),
    2: Number(settings.nutzungsjahr_abschlag_2_prozent != null ? settings.nutzungsjahr_abschlag_2_prozent : 10),
    3: Number(settings.nutzungsjahr_abschlag_3_prozent != null ? settings.nutzungsjahr_abschlag_3_prozent : 20),
    4: Number(settings.nutzungsjahr_abschlag_4_prozent != null ? settings.nutzungsjahr_abschlag_4_prozent : 30),
    5: Number(settings.nutzungsjahr_abschlag_5_prozent != null ? settings.nutzungsjahr_abschlag_5_prozent : 40),
  };
}

function invSchuljahrStart(d) {
  return d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
}

function invCalcNutzungsjahr(kaufdatum) {
  if (!kaufdatum) return 1;
  var kauf = new Date(kaufdatum.slice(0, 10));
  if (isNaN(kauf.getTime())) return 1;
  var diff = invSchuljahrStart(new Date()) - invSchuljahrStart(kauf);
  return Math.min(6, Math.max(1, diff + 1));
}

function invCalcReturnPrice(preisCents, kaufdatum, abschlaege, schutzgebuehrCents) {
  var nutzungsjahr = invCalcNutzungsjahr(kaufdatum);
  if (nutzungsjahr >= 6) return Math.max(0, Number(schutzgebuehrCents || 0));
  var prozent = Number((abschlaege || {})[nutzungsjahr] || 0);
  return Math.max(0, Math.round(Number(preisCents || 0) * (100 - prozent) / 100));
}


function FachCreateDialog(props) {
  var accent = props.accent;
  var faecher = props.faecher;
  var onClose = props.onClose;
  var onSave = props.onSave;
  var _React$useState = React.useState(''), name = _React$useState[0], setName = _React$useState[1];
  var trimmed = name.trim();
  var isDuplicate = faecher.some(function (f) { return f.toLowerCase() === trimmed.toLowerCase(); });
  var valid = trimmed.length > 0 && !isDuplicate;

  var fieldStyle = { width: '100%', padding: '8px 11px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13.5, fontFamily: 'inherit', color: '#0f172a', background: '#fff', outline: 'none' };
  var labelStyle = { fontSize: 11.5, color: '#475569', fontWeight: 500, marginBottom: 5, display: 'block' };

  return (
    <Modal onClose={onClose} width={400}>
      <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.01em' }}>Fach anlegen</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Neues Fach zur Auswahlliste hinzufügen.</div>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', padding: 4 }}>
          <Icon name="x" size={18} />
        </button>
      </div>
      <div style={{ padding: '18px 22px' }}>
        <label style={labelStyle}>Fachname</label>
        <input
          autoFocus
          value={name}
          onChange={function (e) { setName(e.target.value); }}
          onKeyDown={function (e) { if (e.key === 'Enter' && valid) onSave(trimmed); }}
          placeholder="z.B. Astronomie"
          style={fieldStyle}
        />
        {isDuplicate && <div style={{ fontSize: 11.5, color: '#ef4444', marginTop: 6 }}>Dieses Fach existiert bereits.</div>}
      </div>
      <div style={{ padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#fbfcfd', borderRadius: '0 0 12px 12px' }}>
        <Btn kind="ghost" onClick={onClose}>Abbrechen</Btn>
        <Btn kind="primary" accent={accent} icon="check" disabled={!valid} onClick={function () { onSave(trimmed); }}>Fach anlegen</Btn>
      </div>
    </Modal>
  );
}

function FachEditDialog(props) {
  var accent = props.accent;
  var fach = props.fach;
  var faecher = props.faecher;
  var onClose = props.onClose;
  var onSave = props.onSave;
  var _React$useState = React.useState(fach), name = _React$useState[0], setName = _React$useState[1];
  var trimmed = name.trim();
  var isDuplicate = trimmed !== fach && faecher.some(function (f) { return f.toLowerCase() === trimmed.toLowerCase(); });
  var valid = trimmed.length > 0 && !isDuplicate && trimmed !== fach;

  var fieldStyle = { width: '100%', padding: '8px 11px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13.5, fontFamily: 'inherit', color: '#0f172a', background: '#fff', outline: 'none' };
  var labelStyle = { fontSize: 11.5, color: '#475569', fontWeight: 500, marginBottom: 5, display: 'block' };

  return (
    <Modal onClose={onClose} width={400}>
      <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.01em' }}>Fach umbenennen</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Alle Bücher in „{fach}" werden aktualisiert.</div>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', padding: 4 }}>
          <Icon name="x" size={18} />
        </button>
      </div>
      <div style={{ padding: '18px 22px' }}>
        <label style={labelStyle}>Neuer Name</label>
        <input
          autoFocus
          value={name}
          onChange={function (e) { setName(e.target.value); }}
          onKeyDown={function (e) { if (e.key === 'Enter' && valid) onSave(trimmed); }}
          placeholder={fach}
          style={fieldStyle}
        />
        {isDuplicate && <div style={{ fontSize: 11.5, color: '#ef4444', marginTop: 6 }}>Dieses Fach existiert bereits.</div>}
      </div>
      <div style={{ padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#fbfcfd', borderRadius: '0 0 12px 12px' }}>
        <Btn kind="ghost" onClick={onClose}>Abbrechen</Btn>
        <Btn kind="primary" accent={accent} icon="check" disabled={!valid} onClick={function () { onSave(trimmed); }}>Umbenennen</Btn>
      </div>
    </Modal>
  );
}

function InventoryCreateBookDialog(props) {
  var accent = props.accent;
  var faecher = props.faecher;
  var onClose = props.onClose;
  var onSave = props.onSave;
  var _React$useState = React.useState(''), titel = _React$useState[0], setTitel = _React$useState[1];
  var _React$useState2 = React.useState(props.initialFach || faecher[0]), fach = _React$useState2[0], setFach = _React$useState2[1];
  var _React$useState3 = React.useState(5), stufe = _React$useState3[0], setStufe = _React$useState3[1];
  var _React$useState4 = React.useState(''), verlag = _React$useState4[0], setVerlag = _React$useState4[1];
  var _React$useState5 = React.useState(''), isbn = _React$useState5[0], setIsbn = _React$useState5[1];
  var _React$useState6 = React.useState(''), preis = _React$useState6[0], setPreis = _React$useState6[1];
  var _React$useState7 = React.useState(''), bestand = _React$useState7[0], setBestand = _React$useState7[1];
  var _React$useState8c = React.useState(''), schutzgebuehr = _React$useState8c[0], setSchutzgebuehr = _React$useState8c[1];
  var valid = titel.trim() && fach && preis;

  var fieldStyle = {
    width: '100%', padding: '8px 11px',
    border: '1px solid #e2e8f0', borderRadius: 7,
    fontSize: 13.5, fontFamily: 'inherit', color: '#0f172a',
    background: '#fff', outline: 'none',
  };
  var labelStyle = { fontSize: 11.5, color: '#475569', fontWeight: 500, marginBottom: 5, display: 'block' };

  return (
    <Modal onClose={onClose} width={520}>
      <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.01em' }}>Buch anlegen</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Neuen Buchbestand anlegen.</div>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', padding: 4 }}>
          <Icon name="x" size={18} />
        </button>
      </div>
      <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto' }}>
        <div>
          <label style={labelStyle}>Titel</label>
          <input autoFocus value={titel} onChange={function (event) { setTitel(event.target.value); }} placeholder="z.B. Mathematik 7" style={fieldStyle} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: 10 }}>
          <div>
            <label style={labelStyle}>Fach</label>
            <select value={fach} onChange={function (event) { setFach(event.target.value); }} style={fieldStyle}>
              {faecher.map(function (fachName) { return <option key={fachName} value={fachName}>{fachName}</option>; })}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Klassenstufe</label>
            <select value={stufe} onChange={function (event) { setStufe(parseInt(event.target.value, 10)); }} style={fieldStyle}>
              {[5, 6, 7, 8, 9, 10, 11, 12, 13].map(function (level) { return <option key={level} value={level}>Klasse {level}</option>; })}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>Verlag</label>
            <input value={verlag} onChange={function (event) { setVerlag(event.target.value); }} placeholder="z.B. Cornelsen" style={fieldStyle} />
          </div>
          <div>
            <label style={labelStyle}>ISBN</label>
            <input value={isbn} onChange={function (event) { setIsbn(event.target.value); }} placeholder="978-3-..." style={{ ...fieldStyle, fontFamily: 'JetBrains Mono, monospace' }} />
          </div>
        </div>
        <div style={{ paddingTop: 6, borderTop: '1px solid #f1f5f9', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>Basispreis (EUR)</label>
            <input type="number" step="0.01" value={preis} onChange={function (event) { setPreis(event.target.value); }} placeholder="29.90" style={{ ...fieldStyle, fontFamily: 'JetBrains Mono, monospace' }} />
          </div>
          <div>
            <label style={labelStyle}>Gebühr Jahr 6+ (EUR)</label>
            <input type="number" step="0.01" min="0" value={schutzgebuehr} onChange={function (event) { setSchutzgebuehr(event.target.value); }} placeholder="5.00" style={{ ...fieldStyle, fontFamily: 'JetBrains Mono, monospace' }} />
          </div>
          <div>
            <label style={labelStyle}>Anfangsbestand</label>
            <input type="number" value={bestand} onChange={function (event) { setBestand(event.target.value); }} placeholder="50" style={{ ...fieldStyle, fontFamily: 'JetBrains Mono, monospace' }} />
          </div>
        </div>
      </div>
      <div style={{ padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#fbfcfd', borderRadius: '0 0 12px 12px' }}>
        <Btn kind="ghost" onClick={onClose}>Abbrechen</Btn>
        <Btn kind="primary" accent={accent} icon="check" disabled={!valid} onClick={function () { onSave({ titel: titel, fach: fach, stufe: stufe, verlag: verlag, isbn: isbn, preis: preis, bestand: bestand, schutzgebuehr: schutzgebuehr }); }}>
          Buch anlegen
        </Btn>
      </div>
    </Modal>
  );
}

function InventoryEditBookDialog(props) {
  var accent = props.accent;
  var faecher = props.faecher;
  var book = props.book;
  var onClose = props.onClose;
  var onSave = props.onSave;
  var _React$useState8 = React.useState(book.titel || ''), titel = _React$useState8[0], setTitel = _React$useState8[1];
  var _React$useState9 = React.useState(book.fach || faecher[0]), fach = _React$useState9[0], setFach = _React$useState9[1];
  var _React$useState10 = React.useState(book.stufe || 5), stufe = _React$useState10[0], setStufe = _React$useState10[1];
  var _React$useState11 = React.useState(book.verlag || ''), verlag = _React$useState11[0], setVerlag = _React$useState11[1];
  var _React$useState12 = React.useState(book.isbn || ''), isbn = _React$useState12[0], setIsbn = _React$useState12[1];
  var _React$useState13 = React.useState(book.preis_cents ? (book.preis_cents / 100).toFixed(2) : ''), preis = _React$useState13[0], setPreis = _React$useState13[1];
  var _React$useState14 = React.useState(book.bestand_gesamt || ''), bestand = _React$useState14[0], setBestand = _React$useState14[1];
  var _React$useState15 = React.useState(book.schutzgebuehr_cents ? (Number(book.schutzgebuehr_cents) / 100).toFixed(2) : ''), schutzgebuehr = _React$useState15[0], setSchutzgebuehr = _React$useState15[1];
  var usageYears = [0, 1, 2, 3, 4, 5, 6];
  var _React$useStateUsage = React.useState(function () {
    var counts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    (book.zustaende || []).forEach(function (bucket) {
      if (bucket.zustand && bucket.zustand !== 'sehr_gut') return;
      var nj = Math.max(0, Math.min(6, parseInt(bucket.nutzungsjahr, 10) || 0));
      counts[nj] += parseInt(bucket.bestand_verfuegbar, 10) || 0;
    });
    if (!(book.zustaende || []).length) counts[0] = parseInt(book.bestand_frei, 10) || 0;
    return counts;
  }), usageCounts = _React$useStateUsage[0], setUsageCounts = _React$useStateUsage[1];
  var issuedCount = Math.max(0, parseInt(book.bestand_ausgegeben, 10) || 0);
  var totalCount = parseInt(bestand, 10) || 0;
  var expectedFreeCount = Math.max(0, totalCount - issuedCount);
  var assignedFreeCount = usageYears.reduce(function (sum, jahr) {
    return sum + (parseInt(usageCounts[jahr], 10) || 0);
  }, 0);
  var unknownFreeCount = Math.max(0, expectedFreeCount - assignedFreeCount);
  var usageOverflow = assignedFreeCount > expectedFreeCount;
  var valid = titel.trim() && fach && preis && totalCount >= issuedCount && !usageOverflow;

  var fieldStyle = {
    width: '100%', padding: '8px 11px',
    border: '1px solid #e2e8f0', borderRadius: 7,
    fontSize: 13.5, fontFamily: 'inherit', color: '#0f172a',
    background: '#fff', outline: 'none',
  };
  var labelStyle = { fontSize: 11.5, color: '#475569', fontWeight: 500, marginBottom: 5, display: 'block' };
  var usageLabel = function (jahr) { return jahr === 0 ? 'Neu' : jahr >= 6 ? 'Jahr 6+' : 'Jahr ' + jahr; };
  var setUsageCount = function (jahr, value) {
    var parsed = Math.max(0, parseInt(value, 10) || 0);
    setUsageCounts({ ...usageCounts, [jahr]: parsed });
  };

  return (
    <Modal onClose={onClose} width={520}>
      <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.01em' }}>Buch bearbeiten</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Basispreis, Gebühr und Gesamtbestand anpassen.</div>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', padding: 4 }}>
          <Icon name="x" size={18} />
        </button>
      </div>
      <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto' }}>
        <div>
          <label style={labelStyle}>Titel</label>
          <input autoFocus value={titel} onChange={function (event) { setTitel(event.target.value); }} placeholder="z.B. Mathematik 7" style={fieldStyle} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: 10 }}>
          <div>
            <label style={labelStyle}>Fach</label>
            <select value={fach} onChange={function (event) { setFach(event.target.value); }} style={fieldStyle}>
              {faecher.map(function (fachName) { return <option key={fachName} value={fachName}>{fachName}</option>; })}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Klassenstufe</label>
            <select value={stufe} onChange={function (event) { setStufe(parseInt(event.target.value, 10)); }} style={fieldStyle}>
              {[5, 6, 7, 8, 9, 10, 11, 12, 13].map(function (level) { return <option key={level} value={level}>Klasse {level}</option>; })}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>Verlag</label>
            <input value={verlag} onChange={function (event) { setVerlag(event.target.value); }} placeholder="z.B. Cornelsen" style={fieldStyle} />
          </div>
          <div>
            <label style={labelStyle}>ISBN</label>
            <input value={isbn} onChange={function (event) { setIsbn(event.target.value); }} placeholder="978-3-..." style={{ ...fieldStyle, fontFamily: 'JetBrains Mono, monospace' }} />
          </div>
        </div>
        <div style={{ paddingTop: 6, borderTop: '1px solid #f1f5f9', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>Basispreis (EUR)</label>
            <input type="number" step="0.01" value={preis} onChange={function (event) { setPreis(event.target.value); }} placeholder="29.90" style={{ ...fieldStyle, fontFamily: 'JetBrains Mono, monospace' }} />
          </div>
          <div>
            <label style={labelStyle}>Gebühr Jahr 6+ (EUR)</label>
            <input type="number" step="0.01" min="0" value={schutzgebuehr} onChange={function (event) { setSchutzgebuehr(event.target.value); }} placeholder="5.00" style={{ ...fieldStyle, fontFamily: 'JetBrains Mono, monospace' }} />
          </div>
          <div>
            <label style={labelStyle}>Bestand gesamt</label>
            <input type="number" value={bestand} onChange={function (event) { setBestand(event.target.value); }} placeholder="50" style={{ ...fieldStyle, fontFamily: 'JetBrains Mono, monospace' }} />
          </div>
        </div>
        <div style={{ paddingTop: 6, borderTop: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Nutzungsjahre freier Bestand</label>
            <span style={{ fontSize: 11.5, color: usageOverflow ? '#b91c1c' : '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
              {assignedFreeCount}/{expectedFreeCount}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(86px, 1fr))', gap: 8 }}>
            {usageYears.map(function (jahr) {
              var colors = njColor(jahr);
              return (
                <div key={jahr} style={{ border: '1px solid #e8ecef', borderRadius: 8, background: colors.bg, padding: 8, minWidth: 0 }}>
                  <div style={{ fontSize: 10.5, color: colors.color, fontWeight: 600, marginBottom: 6 }}>{usageLabel(jahr)}</div>
                  <input
                    type="number"
                    min="0"
                    value={usageCounts[jahr]}
                    onChange={function (event) { setUsageCount(jahr, event.target.value); }}
                    style={{ ...fieldStyle, width: '100%', minWidth: 0, padding: '7px 6px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, background: '#fff' }}
                  />
                </div>
              );
            })}
          </div>
          {totalCount < issuedCount ? (
            <div style={{ fontSize: 11.5, color: '#b91c1c', marginTop: 7 }}>Bestand gesamt darf nicht kleiner als ausgegeben ({issuedCount}) sein.</div>
          ) : usageOverflow ? (
            <div style={{ fontSize: 11.5, color: '#b91c1c', marginTop: 7 }}>Die Summe der Nutzungsjahre darf den freien Bestand nicht überschreiten.</div>
          ) : unknownFreeCount > 0 ? (
            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 7 }}>{unknownFreeCount} nicht zugeteilte Bücher werden als „Unbekannt“ geführt.</div>
          ) : null}
        </div>
      </div>
      <div style={{ padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#fbfcfd', borderRadius: '0 0 12px 12px' }}>
        <Btn kind="ghost" onClick={onClose}>Abbrechen</Btn>
        <Btn kind="primary" accent={accent} icon="check" disabled={!valid} onClick={function () { onSave({ titel: titel, fach: fach, stufe: stufe, verlag: verlag, isbn: isbn, preis: preis, bestand: bestand, schutzgebuehr: schutzgebuehr, zustaende: usageYears.map(function (jahr) { return { zustand: 'sehr_gut', nutzungsjahr: jahr, bestand_verfuegbar: parseInt(usageCounts[jahr], 10) || 0 }; }).filter(function (bucket) { return bucket.bestand_verfuegbar > 0; }) }); }}>
          Speichern
        </Btn>
      </div>
    </Modal>
  );
}

window.Rueckgabe = function Rueckgabe(props) {
  var accent = props.accent;
  var onDone = props.onDone;
  var FlowShell = window.FlowShell;
  var _React$useState15 = React.useState(1), step = _React$useState15[0], setStep = _React$useState15[1];
  var _React$useState16 = React.useState(''), query = _React$useState16[0], setQuery = _React$useState16[1];
  var _React$useState17 = React.useState([]), students = _React$useState17[0], setStudents = _React$useState17[1];
  var _React$useState18 = React.useState(null), selectedStudent = _React$useState18[0], setSelectedStudent = _React$useState18[1];
  var _React$useState19 = React.useState([]), studentBooks = _React$useState19[0], setStudentBooks = _React$useState19[1];
  var _React$useState20 = React.useState({}), selectedReturns = _React$useState20[0], setSelectedReturns = _React$useState20[1];
  var _React$useState21 = React.useState({}), settings = _React$useState21[0], setSettings = _React$useState21[1];
  var _React$useState22b = React.useState({}), beschaedigtMap = _React$useState22b[0], setBeschaedigtMap = _React$useState22b[1];
  var abschlaege = invGetAbschlaege(settings);

  React.useEffect(function () {
    if (step === 1) {
      window.api.schueler.list({ q: query }).then(function (res) {
        setStudents((res.items || []).slice(0, 8));
      }).catch(console.error);
    }
  }, [query, step]);

  React.useEffect(function () {
    if (selectedStudent && step === 3) {
      Promise.all([
        window.api.schueler.aktiveBuecher(selectedStudent.id),
        window.api.einstellungen.get(),
      ]).then(function (data) {
        var booksRes = data[0];
        var settingsRes = data[1];
        var items = booksRes.items || [];
        var defaults = {};
        items.forEach(function (book) {
          defaults[book.rechnungs_posten_id] = false;
        });
        setStudentBooks(items);
        setSettings(settingsRes || {});
        setSelectedReturns(defaults);
        setBeschaedigtMap({});
      }).catch(console.error);
    }
  }, [selectedStudent, step]);

  var returnedBooks = studentBooks.filter(function (book) {
    return !!selectedReturns[book.rechnungs_posten_id];
  });
  var returnedCount = returnedBooks.length;
  var totalCredit = returnedBooks.reduce(function (sum, book) {
    if (beschaedigtMap[book.rechnungs_posten_id]) return sum;
    return sum + (book.gutschrift_cents != null ? book.gutschrift_cents : invCalcReturnPrice(book.preis_cents, book.kaufdatum, abschlaege, book.schutzgebuehr_cents));
  }, 0) / 100;

  function toggleReturn(book, checked) {
    setSelectedReturns({ ...selectedReturns, [book.rechnungs_posten_id]: checked });
    if (!checked) setBeschaedigtMap(function (prev) { var n = { ...prev }; delete n[book.rechnungs_posten_id]; return n; });
  }

  function toggleBeschaedigt(id, checked) {
    setBeschaedigtMap(function (prev) { return { ...prev, [id]: checked }; });
  }

  async function submitReturn(print) {
    var rueckgaben = returnedBooks.map(function (book) {
      return { rechnungs_posten_id: book.rechnungs_posten_id, beschaedigt: !!beschaedigtMap[book.rechnungs_posten_id] };
    });
    if (!rueckgaben.length) return;

    try {
      var res = await window.api.gutschrift({
        schueler_id: selectedStudent.id,
        rueckgaben: rueckgaben,
      });
      await window.openProtectedDocument(window.api.gutschriften.pdf(res.id), print);
      onDone();
    } catch (error) {
      console.error(error);
      window.showToast('error', error.message || 'Fehler bei der Rückgabe.');
    }
  }

  if (step === 1) {
    return (
      <FlowShell title="Buchrückgabe" subtitle="Schritt 1 von 2 · Schüler auswählen" onCancel={onDone} step={1} accent={accent}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <SearchInput value={query} onChange={setQuery} placeholder="Schüler suchen - Name, Klasse oder ID..." autoFocus />
          <div style={{ marginTop: 14, background: '#fff', border: '1px solid #e8ecef', borderRadius: 10, overflow: 'hidden' }}>
            {students.map(function (student, index) {
              return (
                <button key={student.id} onClick={function () { setSelectedStudent(student); setStep(3); }} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', background: 'transparent', border: 'none',
                  borderTop: index === 0 ? 'none' : '1px solid #f8fafc',
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                }}>
                  <Avatar name={student.vorname + ' ' + student.nachname} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: '#0f172a', letterSpacing: '-0.005em' }}>{student.nachname}, {student.vorname}</div>
                    <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 1, fontFamily: 'JetBrains Mono, monospace' }}>{student.id} · Klasse {student.klasse}</div>
                  </div>
                  <span style={{ color: '#cbd5e1' }}><Icon name="chevron-right" size={15} /></span>
                </button>
              );
            })}
          </div>
        </div>
      </FlowShell>
    );
  }

  return (
    <FlowShell title="Buchrückgabe" subtitle="Schritt 2 von 2 · Bücher auswählen und Gutschrift prüfen" onCancel={onDone} onBack={function () { setStep(1); }} step={3} accent={accent}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, maxWidth: 1100, margin: '0 auto' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, padding: '10px 14px', background: '#fff', border: '1px solid #e8ecef', borderRadius: 10 }}>
            <Avatar name={selectedStudent.vorname + ' ' + selectedStudent.nachname} size={34} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: '#0f172a', letterSpacing: '-0.005em' }}>{selectedStudent.nachname}, {selectedStudent.vorname}</div>
              <div style={{ fontSize: 11.5, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>{selectedStudent.id} · Klasse {selectedStudent.klasse}</div>
            </div>
            <button onClick={function () { setStep(1); }} style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Ändern</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: '0 4px' }}>
            <div style={{ fontSize: 12, color: '#64748b' }}>{studentBooks.length} offene Bücher</div>
            <button onClick={function () {
              var all = {};
              studentBooks.forEach(function (book) { all[book.rechnungs_posten_id] = true; });
              setSelectedReturns(all);
            }} style={{ background: 'transparent', border: 'none', color: accent, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
              Alle markieren
            </button>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e8ecef', borderRadius: 10, overflow: 'hidden' }}>
            {studentBooks.map(function (book, index) {
              var isReturned = !!selectedReturns[book.rechnungs_posten_id];
              var isBeschaedigt = !!beschaedigtMap[book.rechnungs_posten_id];
              var nutzungsjahr = book.nutzungsjahr != null ? book.nutzungsjahr : invCalcNutzungsjahr(book.kaufdatum);
              var previewPreis = book.gutschrift_cents != null ? book.gutschrift_cents : invCalcReturnPrice(book.preis_cents, book.kaufdatum, abschlaege, book.schutzgebuehr_cents);
              var jahrLabel = nutzungsjahr >= 6 ? 'Jahr 6+' : 'Jahr ' + nutzungsjahr;
              var _njC = njColor(nutzungsjahr);
              var jahrFarbe = _njC.color;
              var jahrBg = _njC.bg;
              return (
                <div key={book.rechnungs_posten_id} style={{
                  display: 'grid',
                  gridTemplateColumns: '24px 44px 1fr 90px 120px',
                  gap: 12,
                  alignItems: 'center',
                  padding: '12px 14px',
                  borderTop: index === 0 ? 'none' : '1px solid #f8fafc',
                  background: isBeschaedigt ? '#fef2f2' : isReturned ? '#f0fdf4' : 'transparent',
                }}>
                  <input
                    type="checkbox"
                    checked={isReturned}
                    onChange={function (event) { toggleReturn(book, event.target.checked); }}
                    style={{ width: 16, height: 16, accentColor: '#10b981', cursor: 'pointer' }}
                  />
                  <div style={{
                    width: 36, height: 44, borderRadius: 4,
                    background: 'oklch(0.94 0.04 ' + ((book.fach.charCodeAt(0) * 7) % 360) + ')',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'oklch(0.40 0.10 ' + ((book.fach.charCodeAt(0) * 7) % 360) + ')',
                    fontSize: 9, fontWeight: 600,
                    border: '1px solid rgba(0,0,0,.06)',
                  }}>{book.fach.slice(0, 3).toUpperCase()}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a', letterSpacing: '-0.005em' }}>{book.titel}</div>
                    <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 1, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{book.rechnung_id}</span>
                      <span>·</span>
                      <span>SJ {book.verkauft_schuljahr || new Date(book.kaufdatum).toLocaleDateString('de-DE')}</span>
                      <span>·</span>
                      <span>{invFormatEur(book.preis_cents)}</span>
                    </div>
                    {isReturned && (
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 5, cursor: 'pointer', userSelect: 'none' }}>
                        <input
                          type="checkbox"
                          checked={isBeschaedigt}
                          onChange={function (e) { toggleBeschaedigt(book.rechnungs_posten_id, e.target.checked); }}
                          style={{ width: 13, height: 13, accentColor: '#dc2626', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: 11.5, color: isBeschaedigt ? '#dc2626' : '#94a3b8', fontWeight: isBeschaedigt ? 600 : 400 }}>Beschädigt</span>
                      </label>
                    )}
                  </div>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    padding: '5px 10px', borderRadius: 20,
                    background: jahrBg, color: jahrFarbe,
                    fontSize: 12, fontWeight: 600,
                  }}>{jahrLabel}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>
                    {isBeschaedigt
                      ? <span style={{ color: '#dc2626' }}>0,00 EUR</span>
                      : <span style={{ color: '#047857' }}>+{invFormatEur(previewPreis)}</span>
                    }
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div style={{ background: '#fff', border: '1px solid #e8ecef', borderRadius: 10, overflow: 'hidden', position: 'sticky', top: 0 }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.005em' }}>Gutschrift</div>
              <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 1 }}>{returnedCount} von {studentBooks.length} Büchern markiert</div>
            </div>
            <div style={{ padding: '14px' }}>
              <div style={{ fontSize: 11.5, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>Gutschriftbetrag</div>
              <div style={{ fontSize: 28, fontWeight: 600, color: '#047857', letterSpacing: '-0.02em', marginTop: 4, fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums' }}>
                {totalCredit.toFixed(2).replace('.', ',')} EUR
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4, lineHeight: 1.5 }}>
                Die Gutschrift wird automatisch nach Nutzungsjahr berechnet. Ab Jahr 6+ gilt die Gebühr des Buches.
              </div>
            </div>
            <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
              <Btn kind="primary" full accent={accent} icon="invoice" disabled={returnedCount === 0} onClick={function () { submitReturn(false); }}>Gutschrift erstellen</Btn>
              <Btn kind="secondary" full icon="printer" disabled={returnedCount === 0} onClick={function () { submitReturn(true); }}>Erstellen und drucken</Btn>
            </div>
          </div>
        </div>
      </div>
    </FlowShell>
  );
};

function BooksCsvImportDialog({ accent, onClose, onImported }) {
  var _React$useStateCsv = React.useState(false), importing = _React$useStateCsv[0], setImporting = _React$useStateCsv[1];
  var _React$useStateErr = React.useState(''), error = _React$useStateErr[0], setError = _React$useStateErr[1];
  var _React$useStateFile = React.useState(''), fileName = _React$useStateFile[0], setFileName = _React$useStateFile[1];
  var fileInputRef = React.useRef(null);

  async function importFile(file) {
    if (!file) return;
    setImporting(true);
    setError('');
    setFileName(file.name || '');
    try {
      var res = await window.api.buecher.importCsv(file);
      var fachText = res.created_faecher && res.created_faecher.length > 0
        ? ' Neue Fächer: ' + res.created_faecher.join(', ') + '.'
        : '';
      window.showToast('success', res.imported + ' Bücher importiert.' + fachText);
      if (res.skipped > 0) {
        window.showToast('info', res.skipped + ' Zeilen wurden übersprungen.');
      }
      onImported(res);
    } catch (err) {
      setError(err.message || 'Import fehlgeschlagen.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal onClose={onClose} width={620}>
      <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.01em' }}>Bücher per CSV importieren</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Neue Fächer werden beim Import automatisch angelegt.</div>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', padding: 4 }}>
          <Icon name="x" size={18}/>
        </button>
      </div>

      <div style={{ padding: '16px 22px', display: 'grid', gap: 14 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={function (e) {
            var file = e.target.files && e.target.files[0];
            if (file) importFile(file);
          }}
          style={{ display: 'none' }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Btn kind="secondary" icon="download" onClick={function () { fileInputRef.current && fileInputRef.current.click(); }} disabled={importing}>
            {importing ? 'Import läuft...' : 'CSV auswählen'}
          </Btn>
          <span style={{ fontSize: 12, color: '#64748b' }}>{fileName || 'Noch keine Datei ausgewählt'}</span>
        </div>

        {error ? (
          <div style={{
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid #fecaca',
            background: '#fef2f2',
            color: '#b91c1c',
            fontSize: 12.5,
          }}>
            {error}
          </div>
        ) : null}

        <div style={{ border: '1px solid #e8ecef', borderRadius: 10, background: '#fbfcfd', padding: 12 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>Erwartete Spalten</div>
          <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.7 }}>
            Pflicht: <strong>titel</strong>, <strong>fach</strong>, <strong>stufe</strong>, <strong>preis</strong><br />
            Optional: untertitel, isbn, verlag, bestand, nutzungsjahr, nutzungsjahr_1 bis nutzungsjahr_6, schutzgebuehr
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#fbfcfd', borderRadius: '0 0 12px 12px' }}>
        <Btn kind="ghost" onClick={onClose}>Schließen</Btn>
      </div>
    </Modal>
  );
}

window.BuecherListe = function BuecherListe(props) {
  var accent = props.accent;
  var _React$useStateFaecher = React.useState([]), serverFaecher = _React$useStateFaecher[0], setServerFaecher = _React$useStateFaecher[1];
  var _React$useState22 = React.useState([]), books = _React$useState22[0], setBooks = _React$useState22[1];
  var _React$useState23 = React.useState(0), total = _React$useState23[0], setTotal = _React$useState23[1];
  var _React$useState24 = React.useState(''), query = _React$useState24[0], setQuery = _React$useState24[1];
  var _React$useState25 = React.useState(false), showCreate = _React$useState25[0], setShowCreate = _React$useState25[1];
  var _React$useStateImport = React.useState(false), showCsvImport = _React$useStateImport[0], setShowCsvImport = _React$useStateImport[1];
  var _React$useState26 = React.useState(null), editingBook = _React$useState26[0], setEditingBook = _React$useState26[1];
  var _React$useState27 = React.useState(null), confirmDelete = _React$useState27[0], setConfirmDelete = _React$useState27[1];
  var _React$useState28 = React.useState({}), settings = _React$useState28[0], setSettings = _React$useState28[1];
  var _React$useState29 = React.useState(false), savingRules = _React$useState29[0], setSavingRules = _React$useState29[1];
  var _React$useState30 = React.useState('0'), aufschlagProzent = _React$useState30[0], setAufschlagProzent = _React$useState30[1];
  var abschlaege = invGetAbschlaege(settings);
  var _React$useStateFach = React.useState(null), selectedFach = _React$useStateFach[0], setSelectedFach = _React$useStateFach[1];
  var _React$useStateShowFach = React.useState(false), showFachCreate = _React$useStateShowFach[0], setShowFachCreate = _React$useStateShowFach[1];
  var _React$useStateEditFach = React.useState(null), editingFach = _React$useStateEditFach[0], setEditingFach = _React$useStateEditFach[1];

  var faecher = React.useMemo(function () {
    var bookFaecher = books.map(function (b) { return b.fach; }).filter(Boolean);
    var merged = Array.from(new Set(serverFaecher.concat(bookFaecher)));
    merged.sort(function (a, b) { return a.localeCompare(b, 'de'); });
    return merged;
  }, [books, serverFaecher]);

  var fachBooks = React.useMemo(function () {
    if (!selectedFach) return books;
    return books.filter(function (b) { return b.fach === selectedFach; });
  }, [books, selectedFach]);

  React.useEffect(function () {
    setAufschlagProzent(String(Number(settings.rueckgabe_aufschlag_prozent || 0)));
  }, [settings.rueckgabe_aufschlag_prozent]);

  function fetchAll() {
    Promise.all([
      window.api.buecher.list({ q: query, limit: 500 }),
      window.api.buecher.listFaecher(),
      window.api.einstellungen.get(),
    ]).then(function (data) {
      var booksRes = data[0];
      var faecherRes = data[1];
      var settingsRes = data[2];
      setBooks(booksRes.items || []);
      setTotal(booksRes.total || 0);
      setServerFaecher((faecherRes && faecherRes.items) || []);
      setSettings(settingsRes || {});
    }).catch(function (error) {
      console.error(error);
      setBooks([]);
      setTotal(0);
      setServerFaecher([]);
    });
  }

  React.useEffect(function () {
    fetchAll();
  }, [query]);

  function updateRule(nutzungsjahr, value) {
    var key = 'nutzungsjahr_abschlag_' + nutzungsjahr + '_prozent';
    setSettings({ ...settings, [key]: value });
  }

  async function saveRules() {
    setSavingRules(true);
    try {
      var payload = {};
      for (var jahr = 1; jahr <= 5; jahr += 1) {
        payload['nutzungsjahr_abschlag_' + jahr + '_prozent'] = Number(settings['nutzungsjahr_abschlag_' + jahr + '_prozent'] || 0);
      }
      payload['rueckgabe_aufschlag_prozent'] = Math.max(0, Math.round(parseFloat(String(aufschlagProzent).replace(',', '.')) || 0));
      var updated = await window.api.einstellungen.update(payload);
      setSettings(updated || {});
      fetchAll();
      window.showToast('success', 'Regeln erfolgreich gespeichert.');
    } catch (error) {
      console.error(error);
      window.showToast('error', error.message || 'Fehler beim Speichern der Abschläge.');
    } finally {
      setSavingRules(false);
    }
  }

  function addBook(book) {
    window.api.buecher.create({
      titel: book.titel,
      fach: book.fach,
      stufe: book.stufe,
      verlag: book.verlag,
      isbn: book.isbn,
      preis_cents: Math.round(parseFloat(book.preis) * 100),
      bestand_gesamt: parseInt(book.bestand, 10) || 0,
      schutzgebuehr_cents: Math.max(0, Math.round(parseFloat(book.schutzgebuehr || '0') * 100) || 0),
    }).then(function () {
      setShowCreate(false);
      fetchAll();
      window.showToast('success', '„' + book.titel + '“ wurde erfolgreich angelegt.');
    }).catch(function (error) {
      console.error(error);
      window.showToast('error', error.message || 'Fehler beim Anlegen des Buchs.');
    });
  }

  function editBook(id, book) {
    window.api.buecher.update(id, {
      titel: book.titel,
      fach: book.fach,
      stufe: book.stufe,
      verlag: book.verlag,
      isbn: book.isbn,
      preis_cents: Math.round(parseFloat(book.preis) * 100),
      bestand_gesamt: parseInt(book.bestand, 10) || 0,
      schutzgebuehr_cents: Math.max(0, Math.round(parseFloat(book.schutzgebuehr || '0') * 100) || 0),
      zustaende: book.zustaende || [],
    }).then(function () {
      setEditingBook(null);
      fetchAll();
      window.showToast('success', 'Daten von „' + book.titel + '“ wurden aktualisiert.');
    }).catch(function (error) {
      console.error(error);
      window.showToast('error', error.message || 'Fehler beim Speichern des Buchs.');
    });
  }

  function removeBook(id) {
    var titel = confirmDelete ? confirmDelete.titel : 'Buch';
    window.api.buecher.remove(id).then(function () {
      setConfirmDelete(null);
      fetchAll();
      window.showToast('success', '„' + titel + '” wurde aus dem Bestand entfernt.');
    }).catch(function (error) {
      console.error(error);
      window.showToast('error', error.message || 'Fehler beim Entfernen des Buchs.');
    });
  }

  function addFach(name) {
    window.api.buecher.createFach(name).then(function (res) {
      setServerFaecher((res && res.items) || []);
      setShowFachCreate(false);
      window.showToast('success', 'Fach „' + name + '” wurde angelegt.');
    }).catch(function (err) {
      window.showToast('error', err.message || 'Fehler beim Anlegen.');
    });
  }

  async function renameFach(alt, neu) {
    try {
      var res = await window.api.buecher.renameFach(alt, neu);
      if (selectedFach === alt) setSelectedFach(neu);
      setEditingFach(null);
      fetchAll();
      window.showToast('success', '„' + alt + '” wurde in „' + neu + '” umbenannt (' + res.aktualisiert + ' Bücher aktualisiert).');
    } catch (err) {
      window.showToast('error', err.message || 'Fehler beim Umbenennen.');
    }
  }

  function deleteFach(fach) {
    var count = books.filter(function (b) { return b.fach === fach; }).length;
    if (count > 0) {
      window.showToast('error', 'Fach „' + fach + '” hat noch ' + count + ' Bücher. Bitte erst Bücher umhängen oder löschen.');
      return;
    }
    window.api.buecher.deleteFach(fach).then(function () {
      if (selectedFach === fach) setSelectedFach(null);
      fetchAll();
      window.showToast('success', 'Fach „' + fach + '” wurde entfernt.');
    }).catch(function (err) {
      window.showToast('error', err.message || 'Fehler beim Entfernen.');
    });
  }

  return (
    <div style={{ padding: '24px 40px', maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: '#0f172a', margin: 0, letterSpacing: '-0.02em', fontFamily: "'Playfair Display', Georgia, serif" }}>Bücher</h1>
          <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3 }}>{total} Titel im Bestand</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn kind="secondary" accent={accent} icon="plus" onClick={function () { setShowFachCreate(true); }}>Fach anlegen</Btn>
          <Btn kind="secondary" accent={accent} icon="download" onClick={function () { setShowCsvImport(true); }}>CSV importieren</Btn>
          <Btn kind="primary" accent={accent} icon="plus" onClick={function () { setShowCreate(true); }}>Buch anlegen</Btn>
        </div>
      </div>

      <div style={{ marginBottom: 16, background: '#fff', border: '1px solid #e8ecef', borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>Globale Abschläge je Nutzungsjahr</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Diese Werte bestimmen die Gutschrift in Jahr 1 bis 5.</div>
          </div>
          <Btn kind="secondary" accent={accent} icon="check" onClick={saveRules} disabled={savingRules}>{savingRules ? 'Speichert...' : 'Regeln speichern'}</Btn>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {[1, 2, 3, 4, 5].map(function (jahr) {
            var key = 'nutzungsjahr_abschlag_' + jahr + '_prozent';
            return (
              <div key={jahr} style={{ border: '1px solid #e8ecef', borderRadius: 10, padding: 12, background: '#fbfcfd' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>Nutzungsjahr {jahr}</div>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={settings[key] != null ? settings[key] : 0}
                  onChange={function (event) { updateRule(jahr, event.target.value); }}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    border: '1px solid #dbe2ea',
                    borderRadius: 8,
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 13,
                  }}
                />
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
                  Gutschrift: {100 - Number(settings[key] || 0)}% vom Basispreis
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 10 }}>
          Ab Nutzungsjahr 6 gilt die Gebühr je Buch.
        </div>
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 20 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', marginBottom: 6 }}>Rückgabe-Aufschlag</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                step="1"
                min="0"
                value={aufschlagProzent}
                onChange={function (e) { setAufschlagProzent(e.target.value); }}
                style={{ width: 90, padding: '8px 10px', border: '1px solid #dbe2ea', borderRadius: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}
              />
              <span style={{ fontSize: 12.5, color: '#475569' }}>%</span>
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
            Zurückgegebene Bücher werden beim Wiederverkauf für <strong>Gutschriftpreis × (1 + {aufschlagProzent} %)</strong> berechnet.<br />
            Auf der Gutschrift sieht der Schüler nur den Gutschriftpreis — der Aufschlag ist intern.
          </div>
        </div>
      </div>

      {!selectedFach ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 10 }}>
          {faecher.map(function (fach) {
            var hue = (fach.charCodeAt(0) * 7) % 360;
            var count = books.filter(function (b) { return b.fach === fach; }).length;
            return (
              <div key={fach} style={{ position: 'relative' }}
                onMouseEnter={function (e) { var btns = e.currentTarget.querySelector('.fach-actions'); if (btns) btns.style.opacity = '1'; }}
                onMouseLeave={function (e) { var btns = e.currentTarget.querySelector('.fach-actions'); if (btns) btns.style.opacity = '0'; }}
              >
                <button onClick={function () { setSelectedFach(fach); }} style={{
                  width: '100%',
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  padding: '14px 14px 12px', background: '#fff',
                  border: '1px solid #e8ecef', borderRadius: 12,
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                  opacity: count === 0 ? 0.4 : 1,
                }}>
                  <div style={{
                    width: 40, height: 50, borderRadius: 5,
                    background: 'oklch(0.94 0.04 ' + hue + ')',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'oklch(0.40 0.10 ' + hue + ')',
                    fontSize: 9, fontWeight: 700,
                    border: '1px solid rgba(0,0,0,.06)',
                    marginBottom: 10,
                  }}>{fach.slice(0, 3).toUpperCase()}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', lineHeight: 1.3 }}>{fach}</div>
                  <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 3 }}>{count} Titel</div>
                </button>
                <div className="fach-actions" style={{
                  position: 'absolute', top: 6, right: 6,
                  display: 'flex', gap: 2,
                  opacity: 0, transition: 'opacity .15s',
                }}>
                  <button onClick={function (e) { e.stopPropagation(); setEditingFach(fach); }} title="Fach umbenennen" style={{
                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6,
                    color: '#64748b', cursor: 'pointer', padding: '3px 5px', display: 'flex',
                  }}>
                    <Icon name="edit" size={12} />
                  </button>
                  <button onClick={function (e) { e.stopPropagation(); deleteFach(fach); }} title="Fach löschen" style={{
                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6,
                    color: count > 0 ? '#cbd5e1' : '#ef4444', cursor: count > 0 ? 'not-allowed' : 'pointer', padding: '3px 5px', display: 'flex',
                  }}>
                    <Icon name="trash" size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <button onClick={function () { setSelectedFach(null); setQuery(''); }} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
              color: '#475569', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
              padding: '6px 12px', fontWeight: 500,
            }}>
              <Icon name="chevron-left" size={14} /> Zurück
            </button>
            <span style={{ fontSize: 13, color: '#94a3b8' }}>Bücher</span>
            <span style={{ color: '#cbd5e1' }}>·</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{selectedFach}</span>
          </div>

          <div style={{ marginBottom: 14 }}>
            <SearchInput value={query} onChange={setQuery} placeholder={'Suchen in ' + selectedFach + ' ...'} />
          </div>

          <div style={{ background: '#fff', border: '1px solid #e8ecef', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '44px 1.5fr 1fr 90px 110px 1.3fr 64px', gap: 12, padding: '10px 16px', borderBottom: '1px solid #f1f5f9', background: '#fbfcfd', fontSize: 10.5, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              <div></div><div>Titel</div><div>ISBN / Verlag</div><div style={{ textAlign: 'right' }}>Basispreis</div><div style={{ textAlign: 'right' }}>Bestand</div><div>Nutzungsjahre</div><div></div>
            </div>
            {fachBooks.map(function (book, index) {
          var hue = (book.fach.charCodeAt(0) * 7) % 360;
          return (
            <div key={book.id} style={{
              display: 'grid', gridTemplateColumns: '44px 1.5fr 1fr 90px 110px 1.3fr 64px', gap: 12,
              padding: '12px 16px', alignItems: 'center',
              borderTop: index === 0 ? 'none' : '1px solid #f8fafc',
            }}>
              <div style={{
                width: 36, height: 44, borderRadius: 4,
                background: 'oklch(0.94 0.04 ' + hue + ')',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'oklch(0.40 0.10 ' + hue + ')',
                fontSize: 9, fontWeight: 600, border: '1px solid rgba(0,0,0,.06)',
              }}>{book.fach.slice(0, 3).toUpperCase()}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a', letterSpacing: '-0.005em' }}>{book.titel}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>{book.id} · Klasse {book.stufe}</div>
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>{book.isbn || '—'}</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{book.verlag || '—'}</div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 12.5, fontFamily: 'JetBrains Mono, monospace', color: '#0f172a' }}>{invFormatEur(book.preis_cents)}</div>
              <div style={{ textAlign: 'right', fontSize: 12.5, fontFamily: 'JetBrains Mono, monospace', color: '#0f172a' }}>
                {book.bestand_frei}<span style={{ color: '#94a3b8' }}>/{book.bestand_gesamt}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(book.zustaende || []).map(function (bucket) {
                  var nj = bucket.nutzungsjahr != null ? bucket.nutzungsjahr : 0;
                  var isUnknown = bucket.zustand && bucket.zustand !== 'sehr_gut';
                  var jahrLabel = isUnknown ? 'Unbekannt' : nj === 0 ? 'Neu' : nj >= 6 ? 'Jahr 6+' : 'Jahr ' + nj;
                  var _bc = isUnknown ? { bg: '#f1f5f9', color: '#64748b' } : njColor(nj);
                  var aufschlag = Number(settings.rueckgabe_aufschlag_prozent || 0);
                  var verkaufspreis = isUnknown ? null : nj === 0 ? bucket.preis_cents : Math.round(bucket.preis_cents * (1 + aufschlag / 100));
                  return (
                    <div key={bucket.bestand_id} style={{ border: '1px solid #e8ecef', borderRadius: 999, padding: '5px 9px', background: _bc.bg, display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 11.5, color: _bc.color, fontWeight: 600 }}>{jahrLabel}</span>
                      {verkaufspreis != null ? <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>{invFormatEur(verkaufspreis)}</span> : null}
                      <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>x {bucket.bestand_verfuegbar}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                <button onClick={function (event) { event.stopPropagation(); setEditingBook(book); }} title="Buch bearbeiten" style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: 4 }}>
                  <Icon name="edit" size={14} />
                </button>
                <button onClick={function (event) { event.stopPropagation(); setConfirmDelete(book); }} title="Buch entfernen" style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: 4 }}>
                  <Icon name="trash" size={14} />
                </button>
              </div>
            </div>
          );
        })}
          </div>
        </>
      )}

      {showFachCreate ? <FachCreateDialog accent={accent} faecher={faecher} onClose={function () { setShowFachCreate(false); }} onSave={addFach} /> : null}
      {editingFach ? <FachEditDialog accent={accent} fach={editingFach} faecher={faecher} onClose={function () { setEditingFach(null); }} onSave={function (neu) { renameFach(editingFach, neu); }} /> : null}
      {showCsvImport ? <BooksCsvImportDialog accent={accent} onClose={function () { setShowCsvImport(false); }} onImported={function (res) {
        setShowCsvImport(false);
        fetchAll();
      }} /> : null}
      {showCreate ? <InventoryCreateBookDialog accent={accent} faecher={faecher} initialFach={selectedFach} onClose={function () { setShowCreate(false); }} onSave={addBook} /> : null}
      {editingBook ? <InventoryEditBookDialog accent={accent} faecher={faecher} book={editingBook} onClose={function () { setEditingBook(null); }} onSave={function (book) { editBook(editingBook.id, book); }} /> : null}
      {confirmDelete ? <ConfirmDialog
        title="Buch entfernen?"
        body={<span>Möchten Sie <strong>{confirmDelete.titel}</strong> ({confirmDelete.id}) wirklich aus dem Bestand entfernen?</span>}
        confirmLabel="Endgültig entfernen"
        accent={accent}
        onCancel={function () { setConfirmDelete(null); }}
        onConfirm={function () { removeBook(confirmDelete.id); }}
      /> : null}
    </div>
  );
};
