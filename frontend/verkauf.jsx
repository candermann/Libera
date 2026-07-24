// Verkaufs-Flow: 3 Schritte - Schüler, Buchvariante, Rechnung

function njLabel(nj) {
  if (nj == null || nj === 0) return 'Neu';
  if (nj >= 6) return 'Jahr 6+';
  return 'Nutzungsjahr ' + nj;
}

function njColor(nj) {
  if (nj == null || nj === 0) return { color: '#059669', bg: '#d1fae5' };
  if (nj === 1) return { color: '#16a34a', bg: '#dcfce7' };
  if (nj === 2) return { color: '#65a30d', bg: '#ecfccb' };
  if (nj === 3) return { color: '#ca8a04', bg: '#fef9c3' };
  if (nj === 4) return { color: '#ea580c', bg: '#ffedd5' };
  if (nj === 5) return { color: '#dc2626', bg: '#fee2e2' };
  return { color: '#991b1b', bg: '#fecaca' };
}

function flattenBookOptions(books) {
  return (books || []).flatMap(book =>
    (book.zustaende || [])
      .filter(bucket => bucket.bestand_verfuegbar > 0)
      .map(bucket => ({
        id: `${book.id}-${bucket.bestand_id}`,
        buch_id: book.id,
        bestand_id: bucket.bestand_id,
        titel: book.titel,
        fach: book.fach,
        verlag: book.verlag,
        isbn: book.isbn,
        nutzungsjahr: bucket.nutzungsjahr,
        preis_cents: bucket.preis_cents,
        bestand_frei: bucket.bestand_verfuegbar,
        jahrLabel: njLabel(bucket.nutzungsjahr),
      }))
  );
}

function asA4PreviewHtml(html) {
  if (!html) return html;

  const previewStyle = `
<style>
  @media screen {
    * {
      box-sizing: border-box !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #e5e7eb !important;
      overflow-x: auto !important;
    }
    body {
      width: min(210mm, calc(100vw - 28px)) !important;
      min-height: 297mm !important;
      margin: 14px auto !important;
      padding: 14mm !important;
      box-sizing: border-box !important;
      background: #fff !important;
      box-shadow: 0 10px 28px rgba(15, 23, 42, 0.18) !important;
      overflow: visible !important;
      display: flex !important;
      flex-direction: column !important;
    }
    .main-content {
      flex: 1 !important;
      padding-bottom: 0 !important;
    }
    .footer {
      position: static !important;
      left: auto !important;
      right: auto !important;
      bottom: auto !important;
      margin-top: auto !important;
      padding: 6px 0 5px !important;
    }
  }
  @media print {
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
    }
  }
</style>`;

  if (html.includes('</head>')) {
    return html.replace('</head>', `${previewStyle}</head>`);
  }

  return `${previewStyle}${html}`;
}

const VERKAUF_DRAFT_FLOW = 'buchausgabe';

function Verkauf({ accent, density, onDone, preselectedStudent }) {
  const { KLASSEN } = window.CONSTANTS;
  const [step, setStep] = React.useState(preselectedStudent ? 2 : 1);
  const [students, setStudents] = React.useState([]);
  const [query, setQuery] = React.useState('');
  const [selectedStudent, setSelectedStudent] = React.useState(preselectedStudent || null);
  const [showCreate, setShowCreate] = React.useState(false);
  const [books, setBooks] = React.useState([]);
  const [bookQuery, setBookQuery] = React.useState('');
  const [expandedBookId, setExpandedBookId] = React.useState(null);
  const [settings, setSettings] = React.useState({});
  const [cart, setCart] = React.useState([]);
  const [lernmaterialItems, setLernmaterialItems] = React.useState([]);
  const [lmQuery, setLmQuery] = React.useState('');
  const [lmCart, setLmCart] = React.useState([]);
  const [errorMsg, setErrorMsg] = React.useState(null);
  const [saleResult, setSaleResult] = React.useState(null);
  const [mailRechnung, setMailRechnung] = React.useState(null);
  const [rechnungPreviewHtml, setRechnungPreviewHtml] = React.useState('');
  const [previewError, setPreviewError] = React.useState('');
  const [studentSaldo, setStudentSaldo] = React.useState(0);
  const [guthabenVerrechnen, setGuthabenVerrechnen] = React.useState(true);
  const [freiCart, setFreiCart] = React.useState([]);
  const [freiBezeichnung, setFreiBezeichnung] = React.useState('');
  const [freiBetrag, setFreiBetrag] = React.useState('');
  const [freiTyp, setFreiTyp] = React.useState('Pauschal');
  const [freiAlsVorlage, setFreiAlsVorlage] = React.useState(false);
  const [vorlagen, setVorlagen] = React.useState([]);
  const [oberstufeShowBooks, setOberstufeShowBooks] = React.useState(false);
  const eigeneEntwuerfe = useVorgangEntwuerfe().filter(e => e.flow === VERKAUF_DRAFT_FLOW);

  const resetDraftState = () => {
    setCart([]);
    setLmCart([]);
    setFreiCart([]);
    setGuthabenVerrechnen(true);
    setBookQuery('');
    setLmQuery('');
    setFreiBezeichnung('');
    setFreiBetrag('');
    setFreiTyp('Pauschal');
    setFreiAlsVorlage(false);
    setErrorMsg(null);
  };

  const hasDraftContent = () => cart.length > 0 || lmCart.length > 0 || freiCart.length > 0;

  const selectStudent = (student) => {
    setSelectedStudent(student);
    const draft = window.vorgangEntwuerfe.get(VERKAUF_DRAFT_FLOW, student.id);
    if (draft && draft.state) {
      setCart(draft.state.cart || []);
      setLmCart(draft.state.lmCart || []);
      setFreiCart(draft.state.freiCart || []);
      setGuthabenVerrechnen(typeof draft.state.guthabenVerrechnen === 'boolean' ? draft.state.guthabenVerrechnen : true);
      setErrorMsg(null);
    } else {
      resetDraftState();
    }
    setStep(2);
  };

  const handleCancel = async () => {
    if (selectedStudent && step === 2 && hasDraftContent()) {
      window.showToast?.('info', 'Entwurf wird gespeichert...');
      await saveCurrentDraft(false);
    }
    onDone();
  };

  const buildDraftState = () => ({ cart, lmCart, freiCart, guthabenVerrechnen });

  const saveCurrentDraft = async (manual = false) => {
    if (!selectedStudent) return null;
    if (!hasDraftContent()) return null;
    try {
      const saved = await window.vorgangEntwuerfe.saveNow(VERKAUF_DRAFT_FLOW, selectedStudent, buildDraftState());
      if (manual) window.showToast('success', 'Entwurf gespeichert.');
      return saved;
    } catch (error) {
      if (manual) window.showToast('error', error.message || 'Entwurf konnte nicht gespeichert werden.');
      return null;
    }
  };

  React.useEffect(() => {
    if (preselectedStudent) selectStudent(preselectedStudent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!selectedStudent || step !== 2) return;
    const hatInhalt = cart.length > 0 || lmCart.length > 0 || freiCart.length > 0;
    if (!hatInhalt) return;
    window.vorgangEntwuerfe.save(VERKAUF_DRAFT_FLOW, selectedStudent, buildDraftState());
  }, [selectedStudent, cart, lmCart, freiCart, guthabenVerrechnen, step]);

  React.useEffect(() => {
    if (step === 1) {
      window.api.schueler.list({ q: query, limit: 8 }).then(res => setStudents(res.items)).catch(console.error);
    }
  }, [query, step]);

  React.useEffect(() => {
    if (step === 2) {
      var stufe = !bookQuery && selectedStudent
        ? parseInt(String(selectedStudent.klasse || '').replace(/[^0-9]/g, ''), 10) || undefined
        : undefined;
      window.api.buecher.list({ q: bookQuery || undefined, stufe: stufe, limit: 50 }).then(res => {
        setBooks((res.items || []).filter(b => (b.zustaende || []).some(z => z.bestand_verfuegbar > 0)));
      }).catch(console.error);
    }
  }, [bookQuery, step, selectedStudent?.klasse]);

  React.useEffect(() => {
    if (step === 2) {
      window.api.einstellungen.get().then(r => setSettings(r || {})).catch(console.error);
    }
  }, [step]);

  React.useEffect(() => {
    if (step === 2) {
      window.api.lernmaterial.list({ q: lmQuery, limit: 20 }).then(res => {
        setLernmaterialItems(res.items || []);
      }).catch(console.error);
    }
  }, [lmQuery, step]);

  React.useEffect(() => {
    if (step === 2) {
      window.api.freiposten.vorlagen().then(setVorlagen).catch(console.error);
    }
  }, [step]);

  React.useEffect(() => {
    if (step === 2 && selectedStudent) {
      window.api.schueler.get(selectedStudent.id).then(res => {
        setStudentSaldo(res.konto?.saldo_cents ?? 0);
      }).catch(() => setStudentSaldo(0));
    }
  }, [step, selectedStudent?.id]);

  React.useEffect(() => {
    if (!saleResult?.id || step !== 3) {
      setRechnungPreviewHtml('');
      setPreviewError('');
      return;
    }

    let alive = true;
    setPreviewError('');
    setRechnungPreviewHtml('');

    fetch(window.api.rechnung.html(saleResult.id), { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Vorschau konnte nicht geladen werden (HTTP ${res.status})`);
        }
        return res.text();
      })
      .then((html) => {
        if (!alive) return;
        setRechnungPreviewHtml(asA4PreviewHtml(html));
      })
      .catch((error) => {
        if (!alive) return;
        setPreviewError(error.message || 'Vorschau konnte nicht geladen werden.');
      });

    return () => { alive = false; };
  }, [saleResult?.id, step]);

  const addStudent = (student) => {
    window.api.schueler.create(student).then(res => {
      selectStudent(res);
      setShowCreate(false);
    }).catch(console.error);
  };

  const addBook = (option) => {
    if (cart.find(item => item.buch_id === option.buch_id)) {
      setErrorMsg(`"${option.titel}" liegt bereits im Warenkorb.`);
      return;
    }
    if (option.bestand_frei <= 0) {
      setErrorMsg(`Die Variante "${option.titel}" ist aktuell nicht verfügbar.`);
      return;
    }
    setErrorMsg(null);
    setCart([...cart, option]);
    setBookQuery('');
  };

  const removeBook = (id) => setCart(cart.filter(item => item.id !== id));

  const addLernmaterial = (item) => {
    if (item.bestand_frei <= 0) {
      setErrorMsg(`„${item.name}" ist nicht mehr verfügbar.`);
      return;
    }
    setErrorMsg(null);
    setLmCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, menge: i.menge + 1 } : i);
      }
      return [...prev, { ...item, menge: 1 }];
    });
    setLmQuery('');
  };

  const removeLernmaterial = (id) => setLmCart(lmCart.filter(item => item.id !== id));
  const updateLmMenge = (id, delta) => setLmCart(prev =>
    prev.map(i => i.id === id ? { ...i, menge: Math.max(1, i.menge + delta) } : i)
  );

  const addFreiposten = async () => {
    const betragCents = Math.round(parseFloat(freiBetrag.replace(',', '.')) * 100);
    if (!freiBezeichnung.trim() || isNaN(betragCents) || betragCents <= 0) return;
    const item = { _tempId: Date.now(), bezeichnung: freiBezeichnung.trim(), betrag_cents: betragCents, typ: freiTyp.trim() || 'Pauschal' };
    setFreiCart(prev => [...prev, item]);
    if (freiAlsVorlage) {
      try {
        const saved = await window.api.freiposten.createVorlage({ bezeichnung: item.bezeichnung, betrag_cents: item.betrag_cents, typ: item.typ });
        setVorlagen(prev => [...prev, saved]);
      } catch (e) { console.error(e); }
    }
    setFreiBezeichnung('');
    setFreiBetrag('');
    setFreiAlsVorlage(false);
  };

  const removeFreiposten = (tempId) => setFreiCart(freiCart.filter(i => i._tempId !== tempId));

  const deleteVorlage = async (id) => {
    try {
      await window.api.freiposten.deleteVorlage(id);
      setVorlagen(vorlagen.filter(v => v.id !== id));
    } catch (e) { console.error(e); }
  };

  const totalCents = cart.reduce((sum, item) => sum + item.preis_cents, 0)
    + lmCart.reduce((sum, item) => sum + item.preis_cents * item.menge, 0)
    + freiCart.reduce((sum, item) => sum + item.betrag_cents, 0);
  const total = totalCents / 100;
  const guthabenAngewendetCents = guthabenVerrechnen ? Math.min(studentSaldo, totalCents) : 0;
  const zuZahlenCents = Math.max(0, totalCents - guthabenAngewendetCents);

  const handleCheckout = async () => {
    try {
      const savedDraft = await saveCurrentDraft(false);
      const res = await window.api.verkauf({
        schueler_id: selectedStudent.id,
        positionen: cart.map(item => ({
          buch_id: item.buch_id,
          bestand_id: item.bestand_id,
        })),
        lernmaterial_positionen: lmCart.map(item => ({ id: item.id, menge: item.menge })),
        freiposten: freiCart.map(item => ({ bezeichnung: item.bezeichnung, betrag_cents: item.betrag_cents, typ: item.typ })),
        guthaben_verrechnen: guthabenVerrechnen,
        entwurf_id: savedDraft?.id || null,
      });
      window.vorgangEntwuerfe.refresh().catch(console.error);
      setSaleResult(res);
      setStep(3);
      const anzahlBuecher = cart.length;
      const anzahlLm = lmCart.length;
      let artLabel = '';
      if (anzahlBuecher > 0 && anzahlLm > 0) {
        artLabel = `${anzahlBuecher} ${anzahlBuecher === 1 ? 'Buch' : 'Bücher'} + ${anzahlLm} Lernmaterial`;
      } else if (anzahlBuecher > 0) {
        artLabel = `${anzahlBuecher} ${anzahlBuecher === 1 ? 'Buch' : 'Bücher'}`;
      } else {
        artLabel = `${anzahlLm} Lernmaterial`;
      }
      const guthaben = res.verrechnet_cents > 0 ? ` · ${(res.verrechnet_cents / 100).toFixed(2).replace('.', ',')} € Guthaben verrechnet` : '';
      window.showToast('success', `${artLabel} verkauft und Rechnung ${res.id} hinterlegt.${guthaben}`);
    } catch (error) {
      console.error(error);
      window.showToast('error', error.message || 'Fehler beim Verkauf.');
    }
  };

  if (step === 1) {
    return (
      <FlowShell title="Buchausgabe" subtitle="Schritt 1 von 3 · Schüler auswählen" onCancel={handleCancel} step={1} accent={accent}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <OffeneVorgaengeListe entwuerfe={eigeneEntwuerfe} onSelect={selectStudent} />
          <SearchInput value={query} onChange={setQuery} placeholder="Schüler suchen - Name, Klasse oder ID..." autoFocus />
          <div style={{ marginTop: 14, background: '#fff', border: '1px solid #e8ecef', borderRadius: 10, overflow: 'hidden' }}>
            {students.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Keine Schüler gefunden.</div>
            ) : students.map((student, index) => (
              <button key={student.id} onClick={() => selectStudent(student)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px',
                background: 'transparent', border: 'none',
                borderTop: index === 0 ? 'none' : '1px solid #f8fafc',
                cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <Avatar name={student.vorname + ' ' + student.nachname} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: '#0f172a', letterSpacing: '-0.005em' }}>{student.nachname}, {student.vorname}</div>
                  <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 1, fontFamily: 'JetBrains Mono, monospace' }}>{student.id} · Klasse {student.klasse}</div>
                </div>
                <Badge tone="slate">Klasse {student.klasse}</Badge>
                <span style={{ color: '#cbd5e1', display: 'flex' }}><Icon name="chevron-right" size={15} /></span>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 14, fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
            Schüler nicht gefunden? <a href="#" onClick={(e) => { e.preventDefault(); setShowCreate(true); }} style={{ color: accent, textDecoration: 'none', fontWeight: 500 }}>Neu anlegen →</a>
          </div>
        </div>
        {showCreate && <window.CreateStudentDialog accent={accent} klassen={KLASSEN} onClose={() => setShowCreate(false)} onSave={addStudent} />}
      </FlowShell>
    );
  }

  if (step === 2) {
    return (
      <FlowShell title="Buchausgabe" subtitle="Schritt 2 von 3 · Buchqualität auswählen" onCancel={handleCancel} onBack={() => { setStep(1); setErrorMsg(null); }} step={2} accent={accent}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, maxWidth: 1100, margin: '0 auto' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, padding: '10px 14px', background: '#fff', border: '1px solid #e8ecef', borderRadius: 10 }}>
              <Avatar name={selectedStudent.vorname + ' ' + selectedStudent.nachname} size={34} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: '#0f172a', letterSpacing: '-0.005em' }}>{selectedStudent.nachname}, {selectedStudent.vorname}</div>
                <div style={{ fontSize: 11.5, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>{selectedStudent.id} · Klasse {selectedStudent.klasse}</div>
              </div>
              <button onClick={() => { setStep(1); setErrorMsg(null); }} style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Ändern</button>
            </div>

            {['11', '12'].includes(String(selectedStudent?.klasse || '').replace(/[a-zA-Z]/g, '')) ? (
              <>
                <div style={{ marginBottom: 12, padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 9, fontSize: 12.5, color: '#92400e' }}>
                  <div>Oberstufe (Klasse {selectedStudent.klasse}) — normalerweise werden nur Materialien und Pauschalen ausgegeben.</div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8, cursor: 'pointer', userSelect: 'none', fontWeight: 500 }}>
                    <input type="checkbox" checked={oberstufeShowBooks} onChange={e => setOberstufeShowBooks(e.target.checked)} style={{ accentColor: '#92400e', cursor: 'pointer' }} />
                    Bücher optional ausgeben
                  </label>
                </div>
                {oberstufeShowBooks && (
                  <>
                    <SearchInput value={bookQuery} onChange={(value) => { setBookQuery(value); setErrorMsg(null); }} placeholder="Buch suchen - Titel, Fach oder ISBN..." autoFocus />

                    {errorMsg && (
                      <div style={{ marginTop: 12, padding: '10px 12px', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12.5 }}>
                        {errorMsg}
                      </div>
                    )}

                    <div style={{ marginTop: 12, background: '#fff', border: '1px solid #e8ecef', borderRadius: 10, overflow: 'hidden' }}>
                      {books.length === 0 ? (
                        <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                          {bookQuery ? 'Keine passenden Bücher gefunden.' : 'Alle Bücher ausgegeben oder kein Bestand vorhanden.'}
                        </div>
                      ) : books.map((book, index) => {
                        const inCart = !!cart.find(item => item.buch_id === book.id);
                        const isExpanded = expandedBookId === book.id;
                        const hue = (book.fach.charCodeAt(0) * 7) % 360;
                        const availableBuckets = (book.zustaende || []).filter(b => b.bestand_verfuegbar > 0);
                        const totalAvailable = availableBuckets.reduce((s, b) => s + b.bestand_verfuegbar, 0);
                        return (
                          <React.Fragment key={book.id}>
                            <div
                              style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: '11px 14px',
                                borderTop: index === 0 ? 'none' : '1px solid #f8fafc',
                                cursor: 'pointer',
                                background: isExpanded ? '#f8faff' : inCart ? '#f0fdf4' : 'transparent',
                              }}
                              onClick={() => setExpandedBookId(isExpanded ? null : book.id)}
                            >
                              <div style={{ width: 36, height: 44, borderRadius: 4, background: `oklch(0.94 0.04 ${hue})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: `oklch(0.40 0.10 ${hue})`, fontSize: 9, fontWeight: 600, flexShrink: 0, border: '1px solid rgba(0,0,0,.06)' }}>{book.fach.slice(0, 3).toUpperCase()}</div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a', letterSpacing: '-0.005em' }}>{book.titel}</div>
                                <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 1, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  {inCart ? <span style={{ color: '#16a34a', fontWeight: 500 }}>Im Warenkorb</span> : <span>{totalAvailable} verfügbar</span>}
                                  <span>·</span>
                                  <span>{book.verlag || '—'}</span>
                                </div>
                              </div>
                              <span style={{ color: '#94a3b8', display: 'flex', transition: 'transform 0.15s', transform: isExpanded ? 'rotate(90deg)' : 'none', flexShrink: 0 }}>
                                <Icon name="chevron-right" size={16} />
                              </span>
                            </div>
                            {isExpanded && (
                              <div style={{ borderTop: '1px solid #e8ecef', background: '#f8fafc', padding: '10px 14px 10px 62px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                                  {availableBuckets.map(bucket => {
                                    const aufschlagProzent = Number(settings.rueckgabe_aufschlag_prozent || 0);
                                    const nj = bucket.nutzungsjahr != null ? bucket.nutzungsjahr : 0;
                                    const jahrLabel = njLabel(nj);
                                    const jahrC = njColor(nj);
                                    const displayPreisCents = nj > 0 ? Math.round(bucket.preis_cents * (1 + aufschlagProzent / 100)) : bucket.preis_cents;
                                    const option = { id: `${book.id}-${bucket.bestand_id}`, buch_id: book.id, bestand_id: bucket.bestand_id, titel: book.titel, fach: book.fach, verlag: book.verlag, isbn: book.isbn, nutzungsjahr: nj, preis_cents: displayPreisCents, bestand_frei: bucket.bestand_verfuegbar, jahrLabel };
                                    const bucketInCart = !!cart.find(item => item.id === option.id);
                                    return (
                                      <div key={bucket.bestand_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                          <span style={{ fontSize: 12, fontWeight: 600, color: jahrC.color, background: jahrC.bg, padding: '2px 8px', borderRadius: 999, minWidth: 0 }}>{jahrLabel}</span>
                                          <span style={{ fontSize: 12.5, fontFamily: 'JetBrains Mono, monospace', color: '#475569' }}>{(displayPreisCents / 100).toFixed(2).replace('.', ',')} €</span>
                                          <span style={{ fontSize: 11.5, color: '#94a3b8' }}>{bucket.bestand_verfuegbar} verfügbar</span>
                                        </div>
                                        <Btn kind={bucketInCart || inCart ? 'ghost' : 'secondary'} icon={bucketInCart ? 'check' : 'plus'} onClick={e => { e.stopPropagation(); addBook(option); }} accent={accent} disabled={bucketInCart || inCart}>
                                          {bucketInCart ? 'Im Warenkorb' : (inCart ? 'Belegt' : 'Hinzufügen')}
                                        </Btn>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
            <SearchInput value={bookQuery} onChange={(value) => { setBookQuery(value); setErrorMsg(null); }} placeholder="Buch suchen - Titel, Fach oder ISBN..." autoFocus />

            {errorMsg && (
              <div style={{ marginTop: 12, padding: '10px 12px', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12.5 }}>
                {errorMsg}
              </div>
            )}

            <div style={{ marginTop: 12, background: '#fff', border: '1px solid #e8ecef', borderRadius: 10, overflow: 'hidden' }}>
              {books.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                  {bookQuery ? 'Keine passenden Bücher gefunden.' : 'Alle Bücher ausgegeben oder kein Bestand vorhanden.'}
                </div>
              ) : books.map((book, index) => {
                const inCart = !!cart.find(item => item.buch_id === book.id);
                const isExpanded = expandedBookId === book.id;
                const hue = (book.fach.charCodeAt(0) * 7) % 360;
                const availableBuckets = (book.zustaende || []).filter(b => b.bestand_verfuegbar > 0);
                const totalAvailable = availableBuckets.reduce((s, b) => s + b.bestand_verfuegbar, 0);
                return (
                  <React.Fragment key={book.id}>
                    <div
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '11px 14px',
                        borderTop: index === 0 ? 'none' : '1px solid #f8fafc',
                        cursor: 'pointer',
                        background: isExpanded ? '#f8faff' : inCart ? '#f0fdf4' : 'transparent',
                      }}
                      onClick={() => setExpandedBookId(isExpanded ? null : book.id)}
                    >
                      <div style={{ width: 36, height: 44, borderRadius: 4, background: `oklch(0.94 0.04 ${hue})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: `oklch(0.40 0.10 ${hue})`, fontSize: 9, fontWeight: 600, flexShrink: 0, border: '1px solid rgba(0,0,0,.06)' }}>{book.fach.slice(0, 3).toUpperCase()}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a', letterSpacing: '-0.005em' }}>{book.titel}</div>
                        <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 1, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {inCart ? <span style={{ color: '#16a34a', fontWeight: 500 }}>Im Warenkorb</span> : <span>{totalAvailable} verfügbar</span>}
                          <span>·</span>
                          <span>{book.verlag || '—'}</span>
                        </div>
                      </div>
                      <span style={{ color: '#94a3b8', display: 'flex', transition: 'transform 0.15s', transform: isExpanded ? 'rotate(90deg)' : 'none', flexShrink: 0 }}>
                        <Icon name="chevron-right" size={16} />
                      </span>
                    </div>
                    {isExpanded && (
                      <div style={{ borderTop: '1px solid #e8ecef', background: '#f8fafc', padding: '10px 14px 10px 62px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                          {availableBuckets.map(bucket => {
                            const aufschlagProzent = Number(settings.rueckgabe_aufschlag_prozent || 0);
                            const nj = bucket.nutzungsjahr != null ? bucket.nutzungsjahr : 0;
                            const jahrLabel = njLabel(nj);
                            const jahrC = njColor(nj);
                            const displayPreisCents = nj > 0 ? Math.round(bucket.preis_cents * (1 + aufschlagProzent / 100)) : bucket.preis_cents;
                            const option = { id: `${book.id}-${bucket.bestand_id}`, buch_id: book.id, bestand_id: bucket.bestand_id, titel: book.titel, fach: book.fach, verlag: book.verlag, isbn: book.isbn, nutzungsjahr: nj, preis_cents: displayPreisCents, bestand_frei: bucket.bestand_verfuegbar, jahrLabel };
                            const bucketInCart = !!cart.find(item => item.id === option.id);
                            return (
                              <div key={bucket.bestand_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: jahrC.color, background: jahrC.bg, padding: '2px 8px', borderRadius: 999, minWidth: 0 }}>{jahrLabel}</span>
                                  <span style={{ fontSize: 12.5, fontFamily: 'JetBrains Mono, monospace', color: '#475569' }}>{(displayPreisCents / 100).toFixed(2).replace('.', ',')} €</span>
                                  <span style={{ fontSize: 11.5, color: '#94a3b8' }}>{bucket.bestand_verfuegbar} verfügbar</span>
                                </div>
                                <Btn kind={bucketInCart || inCart ? 'ghost' : 'secondary'} icon={bucketInCart ? 'check' : 'plus'} onClick={e => { e.stopPropagation(); addBook(option); }} accent={accent} disabled={bucketInCart || inCart}>
                                  {bucketInCart ? 'Im Warenkorb' : (inCart ? 'Belegt' : 'Hinzufügen')}
                                </Btn>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            </>
            )}
            {/* ── Lernmaterial-Sektion ─────────────────────────── */}
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8, padding: '0 2px' }}>
                Lernmaterial
              </div>
              <SearchInput value={lmQuery} onChange={(v) => { setLmQuery(v); setErrorMsg(null); }} placeholder="Material suchen – Bezeichnung oder Kategorie..." />
              <div style={{ marginTop: 10, background: '#fff', border: '1px solid #e8ecef', borderRadius: 10, overflow: 'hidden' }}>
                {lernmaterialItems.length === 0 ? (
                  <div style={{ padding: '20px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                    {lmQuery ? 'Kein passendes Material gefunden.' : 'Kein Lernmaterial im Bestand.'}
                  </div>
                ) : lernmaterialItems.map((item, index) => {
                  const inCart = !!lmCart.find(i => i.id === item.id);
                  const outOfStock = item.bestand_frei <= 0;
                  const hue = (item.kategorie.charCodeAt(0) * 37) % 360;
                  return (
                    <div key={item.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px',
                      borderTop: index === 0 ? 'none' : '1px solid #f8fafc',
                    }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                        background: `oklch(0.94 0.04 ${hue})`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: `oklch(0.40 0.10 ${hue})`,
                      }}>
                        <Icon name="package" size={15} stroke={1.75} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: outOfStock ? '#94a3b8' : '#0f172a', letterSpacing: '-0.005em' }}>{item.name}</div>
                        <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Badge tone="slate">{item.kategorie}</Badge>
                          <span>{item.bestand_frei} verfügbar</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: outOfStock ? '#94a3b8' : '#0f172a', fontFamily: 'JetBrains Mono, monospace', minWidth: 70, textAlign: 'right' }}>
                        {(item.preis_cents / 100).toFixed(2).replace('.', ',')} €
                      </div>
                      <Btn kind={inCart || outOfStock ? 'ghost' : 'secondary'} icon={inCart ? 'check' : (outOfStock ? 'alert' : 'plus')} onClick={() => addLernmaterial(item)} accent={accent} disabled={inCart || outOfStock}>
                        {inCart ? 'Im Warenkorb' : (outOfStock ? 'Leer' : 'Hinzufügen')}
                      </Btn>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Weitere Posten ─────────────────────────── */}
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10, padding: '0 2px' }}>
                Weitere Posten
              </div>

              {/* Gespeicherte Vorlagen */}
              {vorlagen.length > 0 && (
                <div style={{ marginBottom: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {vorlagen.map(v => (
                    <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 0, background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
                      <button
                        onClick={() => setFreiCart(prev => [...prev, { _tempId: Date.now(), bezeichnung: v.bezeichnung, betrag_cents: v.betrag_cents, typ: v.typ }])}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 9px', fontSize: 12, color: '#334155', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <span>{v.bezeichnung}</span>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#64748b' }}>{(v.betrag_cents / 100).toFixed(2).replace('.', ',')} €</span>
                      </button>
                      <button onClick={() => deleteVorlage(v.id)} title="Vorlage löschen" style={{ background: 'transparent', border: 'none', borderLeft: '1px solid #e2e8f0', cursor: 'pointer', padding: '4px 7px', color: '#cbd5e1', display: 'flex' }}>
                        <Icon name="x" size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Eingabezeile */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ flex: 2 }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Bezeichnung</div>
                  <input
                    value={freiBezeichnung}
                    onChange={e => setFreiBezeichnung(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addFreiposten()}
                    placeholder="z.B. Kopiergeld"
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', color: '#0f172a', background: '#fff', outline: 'none' }}
                  />
                </div>
                <div style={{ flex: '0 0 90px' }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Betrag (€)</div>
                  <input
                    type="number" step="0.01" min="0.01"
                    value={freiBetrag}
                    onChange={e => setFreiBetrag(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addFreiposten()}
                    placeholder="5,00"
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13, fontFamily: 'JetBrains Mono, monospace', color: '#0f172a', background: '#fff', outline: 'none' }}
                  />
                </div>
                <div style={{ flex: '0 0 100px' }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Typ</div>
                  <input
                    value={freiTyp}
                    onChange={e => setFreiTyp(e.target.value)}
                    placeholder="Pauschal"
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', color: '#0f172a', background: '#fff', outline: 'none' }}
                  />
                </div>
                <Btn kind="secondary" accent={accent} icon="plus" onClick={addFreiposten} disabled={!freiBezeichnung.trim() || !freiBetrag}>
                  Hinzufügen
                </Btn>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8, cursor: 'pointer', fontSize: 12, color: '#64748b', userSelect: 'none' }}>
                <input type="checkbox" checked={freiAlsVorlage} onChange={e => setFreiAlsVorlage(e.target.checked)} style={{ accentColor: accent, cursor: 'pointer' }} />
                Als Vorlage speichern
              </label>
            </div>
          </div>

          <div>
            <div style={{ background: '#fff', border: '1px solid #e8ecef', borderRadius: 10, overflow: 'hidden', position: 'sticky', top: 0 }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.005em' }}>Warenkorb</div>
                <Badge tone="slate">{cart.length + lmCart.length + freiCart.length} Artikel</Badge>
              </div>
              {cart.length === 0 && lmCart.length === 0 && freiCart.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 12.5 }}>
                  Noch keine Artikel hinzugefügt.
                </div>
              ) : (
                <div>
                  {cart.length > 0 && (
                    <div>
                      <div style={{ padding: '6px 14px 4px', fontSize: 10.5, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', background: '#fbfcfd', borderBottom: '1px solid #f1f5f9' }}>Bücher</div>
                      {cart.map((book, index) => (
                        <div key={book.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '9px 14px',
                          borderTop: index === 0 ? 'none' : '1px solid #f8fafc',
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 500, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{book.titel}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1, display: 'flex', gap: 6 }}>
                              <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{book.buch_id}</span>
                              <span>·</span>
                              <span>{book.jahrLabel || njLabel(book.nutzungsjahr)}</span>
                            </div>
                          </div>
                          <div style={{ fontSize: 12.5, fontFamily: 'JetBrains Mono, monospace', color: '#0f172a' }}>
                            {(book.preis_cents / 100).toFixed(2).replace('.', ',')} €
                          </div>
                          <button onClick={() => removeBook(book.id)} style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', display: 'flex', padding: 2 }}>
                            <Icon name="x" size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {lmCart.length > 0 && (
                    <div>
                      <div style={{ padding: '6px 14px 4px', fontSize: 10.5, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', background: '#fbfcfd', borderBottom: '1px solid #f1f5f9', borderTop: cart.length > 0 ? '1px solid #f1f5f9' : 'none' }}>Lernmaterial</div>
                      {lmCart.map((item, index) => (
                        <div key={item.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '9px 14px',
                          borderTop: index === 0 ? 'none' : '1px solid #f8fafc',
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 500, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{item.kategorie}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <button onClick={() => updateLmMenge(item.id, -1)} style={{ width: 20, height: 20, borderRadius: 4, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', cursor: 'pointer', fontSize: 13, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>−</button>
                            <span style={{ fontSize: 12.5, fontFamily: 'JetBrains Mono, monospace', minWidth: 18, textAlign: 'center' }}>{item.menge}</span>
                            <button onClick={() => updateLmMenge(item.id, +1)} style={{ width: 20, height: 20, borderRadius: 4, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', cursor: 'pointer', fontSize: 13, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>+</button>
                          </div>
                          <div style={{ fontSize: 12.5, fontFamily: 'JetBrains Mono, monospace', color: '#0f172a', minWidth: 60, textAlign: 'right' }}>
                            {(item.preis_cents * item.menge / 100).toFixed(2).replace('.', ',')} €
                          </div>
                          <button onClick={() => removeLernmaterial(item.id)} style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', display: 'flex', padding: 2 }}>
                            <Icon name="x" size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {freiCart.length > 0 && (
                    <div>
                      <div style={{ padding: '6px 14px 4px', fontSize: 10.5, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', background: '#fbfcfd', borderBottom: '1px solid #f1f5f9', borderTop: (cart.length > 0 || lmCart.length > 0) ? '1px solid #f1f5f9' : 'none' }}>Weitere Posten</div>
                      {freiCart.map((item, index) => (
                        <div key={item._tempId} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '9px 14px',
                          borderTop: index === 0 ? 'none' : '1px solid #f8fafc',
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 500, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.bezeichnung}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{item.typ}</div>
                          </div>
                          <div style={{ fontSize: 12.5, fontFamily: 'JetBrains Mono, monospace', color: '#0f172a' }}>
                            {(item.betrag_cents / 100).toFixed(2).replace('.', ',')} €
                          </div>
                          <button onClick={() => removeFreiposten(item._tempId)} style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', display: 'flex', padding: 2 }}>
                            <Icon name="x" size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div style={{ padding: '12px 14px', borderTop: '1px solid #f1f5f9', background: '#fbfcfd' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#475569', marginBottom: 4 }}>
                  <span>Zwischensumme</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums' }}>{total.toFixed(2).replace('.', ',')} €</span>
                </div>

                {studentSaldo > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <label style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '7px 10px',
                      background: guthabenVerrechnen ? '#f0fdf4' : '#f8fafc',
                      border: `1px solid ${guthabenVerrechnen ? '#bbf7d0' : '#e2e8f0'}`,
                      borderRadius: 7,
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <input
                          type="checkbox"
                          checked={guthabenVerrechnen}
                          onChange={e => setGuthabenVerrechnen(e.target.checked)}
                          style={{ width: 13, height: 13, accentColor: '#16a34a', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: 12.5, color: guthabenVerrechnen ? '#15803d' : '#475569', fontWeight: 500 }}>
                          Guthaben verrechnen
                        </span>
                      </div>
                      <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#16a34a', fontWeight: 600 }}>
                        {(studentSaldo / 100).toFixed(2).replace('.', ',')} €
                      </span>
                    </label>
                    {guthabenVerrechnen && guthabenAngewendetCents > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#15803d', marginTop: 4, padding: '0 2px' }}>
                        <span>Abzug Guthaben</span>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>− {(guthabenAngewendetCents / 100).toFixed(2).replace('.', ',')} €</span>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 12, letterSpacing: '-0.005em' }}>
                  <span>Zu zahlen</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums' }}>{(zuZahlenCents / 100).toFixed(2).replace('.', ',')} €</span>
                </div>
                <Btn kind="primary" full accent={accent} icon="arrow-right" onClick={handleCheckout} disabled={cart.length === 0 && lmCart.length === 0 && freiCart.length === 0}>
                  Rechnung erstellen
                </Btn>
                <div style={{ marginTop: 7 }}>
                  <Btn kind="secondary" full icon="folder" onClick={() => saveCurrentDraft(true)} disabled={cart.length === 0 && lmCart.length === 0 && freiCart.length === 0}>
                    Als Entwurf speichern
                  </Btn>
                </div>
              </div>
            </div>
          </div>
        </div>
      </FlowShell>
    );
  }

  return (
    <FlowShell title="Buchausgabe" subtitle="Schritt 3 von 3 · Rechnung und Druck" onCancel={handleCancel} step={3} accent={accent}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, maxWidth: 1100, margin: '0 auto' }}>
        <div>
          <div style={{ fontSize: 11.5, color: '#94a3b8', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>Vorschau</div>
          <div style={{
            background: '#fff',
            border: '1px solid #e8ecef',
            borderRadius: 10,
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
          }}>
            {previewError ? (
              <div style={{ padding: 24, color: '#b91c1c', fontSize: 12.5 }}>{previewError}</div>
            ) : !rechnungPreviewHtml ? (
              <div style={{ padding: 24, color: '#64748b', fontSize: 12.5 }}>Lade Vorschau...</div>
            ) : (
              <iframe
                title="Rechnungsvorschau"
                srcDoc={rechnungPreviewHtml}
                style={{
                  width: '100%',
                  height: '1150px',
                  border: 'none',
                  background: '#e5e7eb',
                }}
              />
            )}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: '#ecfdf5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="check" size={16} />
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.005em' }}>Bereit zum Drucken</div>
                <div style={{ fontSize: 11.5, color: '#64748b' }}>{cart.length} Bücher · {(saleResult.summe_cents / 100).toFixed(2).replace('.', ',')} €</div>
              </div>
            </div>
            {saleResult.verrechnet_cents > 0 && (
              <div style={{ marginBottom: 8, padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 7, fontSize: 12, color: '#15803d' }}>
                <span style={{ fontWeight: 500 }}>Guthaben verrechnet: </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums' }}>
                  {(saleResult.verrechnet_cents / 100).toFixed(2).replace('.', ',')} €
                </span>
                {' · Noch zu zahlen: '}
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  {(saleResult.zu_zahlen_cents / 100).toFixed(2).replace('.', ',')} €
                </span>
              </div>
            )}
            <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5, padding: '10px 12px', background: '#fbfcfd', borderRadius: 7, border: '1px solid #f1f5f9' }}>
              Die gewählten Qualitäten wurden auf der Rechnung als Snapshot festgehalten und erscheinen später genauso in der Rückgabe.
            </div>
          </Card>
          <Card padding={14}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>Aktionen</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <Btn kind="primary" full accent={accent} icon="printer" onClick={async () => {
                try {
                  await window.openProtectedDocument(window.api.rechnung.pdf(saleResult.id), true);
                } catch (error) {
                  console.error(error);
                  window.showToast('error', error.message || 'Fehler beim Laden der Rechnung.');
                }
              }}>Rechnung drucken</Btn>
              <Btn kind="secondary" full icon="download" onClick={async () => {
                try {
                  await window.downloadProtectedDocument(window.api.rechnung.pdf(saleResult.id), `${saleResult.id}.pdf`);
                } catch (error) {
                  console.error(error);
                  window.showToast('error', error.message || 'Fehler beim Laden der Rechnung.');
                }
              }}>Als PDF speichern</Btn>
              <Btn kind="secondary" full icon="mail" onClick={() => setMailRechnung({
                id: saleResult.id,
                schueler_name: `${selectedStudent.nachname}, ${selectedStudent.vorname}`,
                status: 'offen',
              })}>Per E-Mail senden</Btn>
            </div>
          </Card>
        </div>
      </div>
      {mailRechnung && window.RechnungMailDialog && (
        <window.RechnungMailDialog
          rechnung={mailRechnung}
          accent={accent}
          onClose={() => setMailRechnung(null)}
          onSent={() => setMailRechnung(null)}
        />
      )}
    </FlowShell>
  );
}

function InvoicePreview({ student, books, rechnungsNr, total, accent }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e8ecef', borderRadius: 10,
      padding: 36,
      fontSize: 11, color: '#1e293b',
      boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
      aspectRatio: '210/297',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `2px solid ${accent}`, paddingBottom: 12, marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>Städtisches Gymnasium</div>
          <div style={{ fontSize: 9.5, color: '#64748b', marginTop: 2 }}>Schulstraße 12 · 52538 Gangelt</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: accent, letterSpacing: '-0.01em' }}>RECHNUNG</div>
          <div style={{ fontSize: 9.5, color: '#64748b', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>Nr. {rechnungsNr}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 8.5, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Empfänger</div>
          <div style={{ fontSize: 10.5, fontWeight: 600 }}>{student.nachname}, {student.vorname}</div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>Klasse {student.klasse}</div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>{student.strasse || ''}</div>
          <div style={{ fontSize: 10, color: '#475569' }}>{student.plz || ''} {student.ort || ''}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 8.5, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Datum</div>
          <div style={{ fontSize: 10.5, fontFamily: 'JetBrains Mono, monospace' }}>{new Date().toLocaleDateString('de-DE')}</div>
          <div style={{ fontSize: 8.5, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 8, marginBottom: 4 }}>Schüler-ID</div>
          <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}>{student.id}</div>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
            <th style={{ textAlign: 'left', padding: '6px 0', fontSize: 8.5, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Pos</th>
            <th style={{ textAlign: 'left', padding: '6px 0', fontSize: 8.5, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Bezeichnung</th>
            <th style={{ textAlign: 'left', padding: '6px 0', fontSize: 8.5, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>ISBN</th>
            <th style={{ textAlign: 'right', padding: '6px 0', fontSize: 8.5, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Preis</th>
          </tr>
        </thead>
        <tbody>
          {books.map((book, index) => (
            <tr key={book.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '8px 0', color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>{String(index + 1).padStart(2, '0')}</td>
              <td style={{ padding: '8px 0', fontWeight: 500 }}>
                {book.titel}
                <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 400 }}>{book.jahrLabel || njLabel(book.nutzungsjahr)} · {book.verlag || '—'}</div>
              </td>
              <td style={{ padding: '8px 0', color: '#64748b', fontFamily: 'JetBrains Mono, monospace', fontSize: 9 }}>{book.isbn?.slice(-13) || '—'}</td>
              <td style={{ padding: '8px 0', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums' }}>{(book.preis_cents / 100).toFixed(2).replace('.', ',')} €</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 18, marginLeft: 'auto', width: 220 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, fontWeight: 700, padding: '8px 0', color: '#0f172a' }}>
          <span>Gesamt</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums' }}>{total.toFixed(2).replace('.', ',')} €</span>
        </div>
      </div>
    </div>
  );
}

function FlowShell({ title, subtitle, onCancel, onBack, step, accent, children }) {
  return (
    <div>
      <div style={{ padding: '20px 40px 16px', background: '#fbfcfd', borderBottom: '1px solid #e8ecef' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, maxWidth: 1100, margin: '0 auto' }}>
          {onBack ? (
            <button onClick={onBack} style={{ background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 7, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#475569', cursor: 'pointer', fontFamily: 'inherit' }}>
              <Icon name="arrow-left" size={13} /> Zurück
            </button>
          ) : null}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11.5, color: '#94a3b8', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{subtitle}</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.015em', marginTop: 2, fontFamily: "'Playfair Display', Georgia, serif" }}>{title}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {[1, 2, 3].map(index => (
              <div key={index} style={{
                width: index === step ? 24 : 8, height: 6, borderRadius: 999,
                background: index <= step ? accent : '#e2e8f0',
                transition: 'all .2s',
              }} />
            ))}
          </div>
          <button onClick={onCancel} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', padding: '6px 8px' }}>Abbrechen</button>
        </div>
      </div>
      <div style={{ padding: '28px 40px' }}>{children}</div>
    </div>
  );
}

const KOMBINIERT_DRAFT_FLOW = 'ausgabe-rueckgabe';

function KombiniertFlow({ accent, density, onDone, preselectedStudent }) {
  const { KLASSEN } = window.CONSTANTS;
  const [step, setStep] = React.useState(preselectedStudent ? 2 : 1);
  const [students, setStudents] = React.useState([]);
  const [query, setQuery] = React.useState('');
  const [selectedStudent, setSelectedStudent] = React.useState(preselectedStudent || null);
  const [showCreate, setShowCreate] = React.useState(false);
  // Neue Bücher
  const [books, setBooks] = React.useState([]);
  const [bookQuery, setBookQuery] = React.useState('');
  const [expandedBookId, setExpandedBookId] = React.useState(null);
  const [settings, setSettings] = React.useState({});
  const [cart, setCart] = React.useState([]);
  const [lernmaterialItems, setLernmaterialItems] = React.useState([]);
  const [lmQuery, setLmQuery] = React.useState('');
  const [lmCart, setLmCart] = React.useState([]);
  const [freiCart, setFreiCart] = React.useState([]);
  const [freiBezeichnung, setFreiBezeichnung] = React.useState('');
  const [freiBetrag, setFreiBetrag] = React.useState('');
  const [freiTyp, setFreiTyp] = React.useState('Pauschal');
  const [freiAlsVorlage, setFreiAlsVorlage] = React.useState(false);
  const [vorlagen, setVorlagen] = React.useState([]);
  const [errorMsg, setErrorMsg] = React.useState(null);
  // Rückgaben
  const [studentBooks, setStudentBooks] = React.useState([]);
  const [returned, setReturned] = React.useState({});
  const [beschaedigtKombi, setBeschaedigtKombi] = React.useState({});
  // Ergebnis
  const [saleResult, setSaleResult] = React.useState(null);
  const [mailRechnung, setMailRechnung] = React.useState(null);
  const [rechnungPreviewHtml, setRechnungPreviewHtml] = React.useState('');
  const [previewError, setPreviewError] = React.useState('');
  const pendingRestoreRef = React.useRef(null);
  const eigeneEntwuerfe = useVorgangEntwuerfe().filter(e => e.flow === KOMBINIERT_DRAFT_FLOW);

  const resetDraftState = () => {
    setCart([]);
    setLmCart([]);
    setFreiCart([]);
    setReturned({});
    setBeschaedigtKombi({});
    pendingRestoreRef.current = null;
    setBookQuery('');
    setLmQuery('');
    setFreiBezeichnung('');
    setFreiBetrag('');
    setFreiTyp('Pauschal');
    setFreiAlsVorlage(false);
    setErrorMsg(null);
  };

  const hasDraftContent = () => cart.length > 0 || lmCart.length > 0 || freiCart.length > 0
    || Object.values(returned).some(Boolean);

  const selectStudent = (student) => {
    setSelectedStudent(student);
    const draft = window.vorgangEntwuerfe.get(KOMBINIERT_DRAFT_FLOW, student.id);
    if (draft && draft.state) {
      setCart(draft.state.cart || []);
      setLmCart(draft.state.lmCart || []);
      setFreiCart(draft.state.freiCart || []);
      pendingRestoreRef.current = {
        returned: draft.state.returned || {},
        beschaedigtKombi: draft.state.beschaedigtKombi || {},
      };
      setReturned(draft.state.returned || {});
      setBeschaedigtKombi(draft.state.beschaedigtKombi || {});
      setErrorMsg(null);
    } else {
      resetDraftState();
    }
    setStep(2);
  };

  const handleCancel = async () => {
    if (selectedStudent && step === 2 && hasDraftContent()) {
      window.showToast?.('info', 'Entwurf wird gespeichert...');
      await saveCurrentDraft(false);
    }
    onDone();
  };

  const buildDraftState = () => ({ cart, lmCart, freiCart, returned, beschaedigtKombi });

  const saveCurrentDraft = async (manual = false) => {
    if (!selectedStudent) return null;
    if (!hasDraftContent()) return null;
    try {
      const saved = await window.vorgangEntwuerfe.saveNow(KOMBINIERT_DRAFT_FLOW, selectedStudent, buildDraftState());
      if (manual) window.showToast('success', 'Entwurf gespeichert.');
      return saved;
    } catch (error) {
      if (manual) window.showToast('error', error.message || 'Entwurf konnte nicht gespeichert werden.');
      return null;
    }
  };

  React.useEffect(() => {
    if (preselectedStudent) selectStudent(preselectedStudent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!selectedStudent || step !== 2) return;
    const hatInhalt = cart.length > 0 || lmCart.length > 0 || freiCart.length > 0
      || Object.values(returned).some(Boolean);
    if (!hatInhalt) return;
    window.vorgangEntwuerfe.save(KOMBINIERT_DRAFT_FLOW, selectedStudent, buildDraftState());
  }, [selectedStudent, cart, lmCart, freiCart, returned, beschaedigtKombi, step]);

  React.useEffect(() => {
    if (step === 1) {
      window.api.schueler.list({ q: query, limit: 8 }).then(res => setStudents(res.items)).catch(console.error);
    }
  }, [query, step]);

  React.useEffect(() => {
    if (step === 2) {
      var stufe = !bookQuery && selectedStudent
        ? parseInt(String(selectedStudent.klasse || '').replace(/[^0-9]/g, ''), 10) || undefined
        : undefined;
      window.api.buecher.list({ q: bookQuery || undefined, stufe: stufe, limit: 50 }).then(res => {
        setBooks((res.items || []).filter(b => (b.zustaende || []).some(z => z.bestand_verfuegbar > 0)));
      }).catch(console.error);
    }
  }, [bookQuery, step, selectedStudent?.klasse]);

  React.useEffect(() => {
    if (step === 2) {
      window.api.einstellungen.get().then(r => setSettings(r || {})).catch(console.error);
    }
  }, [step]);

  React.useEffect(() => {
    if (step === 2) {
      window.api.lernmaterial.list({ q: lmQuery, limit: 20 }).then(res => setLernmaterialItems(res.items || [])).catch(console.error);
    }
  }, [lmQuery, step]);

  React.useEffect(() => {
    if (step === 2 && selectedStudent) {
      window.api.schueler.aktiveBuecher(selectedStudent.id).then(res => {
        setStudentBooks(res.items || []);
        if (pendingRestoreRef.current) {
          setReturned(pendingRestoreRef.current.returned || {});
          setBeschaedigtKombi(pendingRestoreRef.current.beschaedigtKombi || {});
          pendingRestoreRef.current = null;
        } else {
          setReturned({});
          setBeschaedigtKombi({});
        }
      }).catch(console.error);
    }
  }, [step, selectedStudent?.id]);

  React.useEffect(() => {
    if (step === 2) {
      window.api.freiposten.vorlagen().then(setVorlagen).catch(console.error);
    }
  }, [step]);

  React.useEffect(() => {
    if (!saleResult?.id || step !== 3) { setRechnungPreviewHtml(''); setPreviewError(''); return; }
    let alive = true;
    setPreviewError(''); setRechnungPreviewHtml('');
    fetch(window.api.rechnung.html(saleResult.id), { credentials: 'include' })
      .then(async res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.text(); })
      .then(html => { if (alive) setRechnungPreviewHtml(asA4PreviewHtml(html)); })
      .catch(err => { if (alive) setPreviewError(err.message || 'Vorschau konnte nicht geladen werden.'); });
    return () => { alive = false; };
  }, [saleResult?.id, step]);

  const addBook = (option) => {
    if (cart.find(item => item.buch_id === option.buch_id)) { setErrorMsg(`"${option.titel}" liegt bereits im Warenkorb.`); return; }
    setErrorMsg(null); setCart([...cart, option]); setBookQuery('');
  };
  const removeBook = (id) => setCart(cart.filter(item => item.id !== id));
  const addLernmaterial = (item) => {
    if (item.bestand_frei <= 0) { setErrorMsg(`„${item.name}" ist nicht mehr verfügbar.`); return; }
    setErrorMsg(null);
    setLmCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) return prev.map(i => i.id === item.id ? { ...i, menge: i.menge + 1 } : i);
      return [...prev, { ...item, menge: 1 }];
    });
    setLmQuery('');
  };
  const removeLernmaterial = (id) => setLmCart(lmCart.filter(item => item.id !== id));
  const updateLmMenge = (id, delta) => setLmCart(prev =>
    prev.map(i => i.id === id ? { ...i, menge: Math.max(1, i.menge + delta) } : i)
  );
  const addFreiposten = async () => {
    const betragCents = Math.round(parseFloat(freiBetrag.replace(',', '.')) * 100);
    if (!freiBezeichnung.trim() || isNaN(betragCents) || betragCents <= 0) return;
    const item = { _tempId: Date.now(), bezeichnung: freiBezeichnung.trim(), betrag_cents: betragCents, typ: freiTyp.trim() || 'Pauschal' };
    setFreiCart(prev => [...prev, item]);
    if (freiAlsVorlage) {
      try {
        const saved = await window.api.freiposten.createVorlage({ bezeichnung: item.bezeichnung, betrag_cents: item.betrag_cents, typ: item.typ });
        setVorlagen(prev => [...prev, saved]);
      } catch (e) { console.error(e); }
    }
    setFreiBezeichnung(''); setFreiBetrag(''); setFreiAlsVorlage(false);
  };
  const removeFreiposten = (tempId) => setFreiCart(freiCart.filter(i => i._tempId !== tempId));
  const deleteVorlage = async (id) => {
    try {
      await window.api.freiposten.deleteVorlage(id);
      setVorlagen(vorlagen.filter(v => v.id !== id));
    } catch (e) { console.error(e); }
  };

  const totalNewCents = cart.reduce((s, i) => s + i.preis_cents, 0)
    + lmCart.reduce((s, i) => s + i.preis_cents * i.menge, 0)
    + freiCart.reduce((s, i) => s + i.betrag_cents, 0);
  const returnedBooks = studentBooks.filter(b => returned[b.rechnungs_posten_id]);
  const totalReturnCents = returnedBooks.reduce((s, b) => beschaedigtKombi[b.rechnungs_posten_id] ? s : s + b.gutschrift_cents, 0);
  const zuZahlenCents = Math.max(0, totalNewCents - totalReturnCents);

  const handleCheckout = async () => {
    try {
      const rueckgaben_kombi = returnedBooks.map(b => ({ rechnungs_posten_id: b.rechnungs_posten_id, beschaedigt: !!beschaedigtKombi[b.rechnungs_posten_id] }));
      const savedDraft = await saveCurrentDraft(false);
      const res = await window.api.verkauf({
        schueler_id: selectedStudent.id,
        positionen: cart.map(item => ({ buch_id: item.buch_id, bestand_id: item.bestand_id })),
        lernmaterial_positionen: lmCart.map(item => ({ id: item.id, menge: item.menge })),
        freiposten: freiCart.map(item => ({ bezeichnung: item.bezeichnung, betrag_cents: item.betrag_cents, typ: item.typ })),
        guthaben_verrechnen: false,
        rueckgaben: rueckgaben_kombi,
        entwurf_id: savedDraft?.id || null,
      });
      window.vorgangEntwuerfe.refresh().catch(console.error);
      setSaleResult(res);
      setStep(3);
      const rueckgabeInfo = rueckgaben_kombi.length > 0 ? ` · ${rueckgaben_kombi.length} ${rueckgaben_kombi.length === 1 ? 'Buch' : 'Bücher'} zurückgenommen` : '';
      window.showToast('success', `Rechnung ${res.id} erstellt.${rueckgabeInfo}`);
    } catch (error) {
      console.error(error);
      window.showToast('error', error.message || 'Fehler beim Erstellen der Rechnung.');
    }
  };

  if (step === 1) {
    return (
      <FlowShell title="Ausgabe & Rückgabe" subtitle="Schritt 1 von 3 · Schüler auswählen" onCancel={handleCancel} step={1} accent={accent}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <OffeneVorgaengeListe entwuerfe={eigeneEntwuerfe} onSelect={selectStudent} />
          <SearchInput value={query} onChange={setQuery} placeholder="Schüler suchen — Name, Klasse oder ID…" autoFocus />
          <div style={{ marginTop: 14, background: '#fff', border: '1px solid #e8ecef', borderRadius: 10, overflow: 'hidden' }}>
            {students.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Keine Schüler gefunden.</div>
            ) : students.map((student, index) => (
              <button key={student.id} onClick={() => selectStudent(student)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', background: 'transparent', border: 'none',
                borderTop: index === 0 ? 'none' : '1px solid #f8fafc',
                cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Avatar name={student.vorname + ' ' + student.nachname} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: '#0f172a' }}>{student.nachname}, {student.vorname}</div>
                  <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 1, fontFamily: 'JetBrains Mono, monospace' }}>{student.id} · Klasse {student.klasse}</div>
                </div>
                <Badge tone="slate">Klasse {student.klasse}</Badge>
                <span style={{ color: '#cbd5e1', display: 'flex' }}><Icon name="chevron-right" size={15} /></span>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 14, fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
            Schüler nicht gefunden? <a href="#" onClick={e => { e.preventDefault(); setShowCreate(true); }} style={{ color: accent, textDecoration: 'none', fontWeight: 500 }}>Neu anlegen →</a>
          </div>
        </div>
        {showCreate && <window.CreateStudentDialog accent={accent} klassen={KLASSEN} onClose={() => setShowCreate(false)} onSave={student => { window.api.schueler.create(student).then(res => { selectStudent(res); setShowCreate(false); }).catch(console.error); }} />}
      </FlowShell>
    );
  }

  if (step === 2) {
    return (
      <FlowShell title="Ausgabe & Rückgabe" subtitle="Schritt 2 von 3 · Auswahl" onCancel={handleCancel} onBack={() => { setStep(1); setErrorMsg(null); }} step={2} accent={accent}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, maxWidth: 1100, margin: '0 auto' }}>
          <div>
            {/* Schüler-Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, padding: '10px 14px', background: '#fff', border: '1px solid #e8ecef', borderRadius: 10 }}>
              <Avatar name={selectedStudent.vorname + ' ' + selectedStudent.nachname} size={34} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: '#0f172a' }}>{selectedStudent.nachname}, {selectedStudent.vorname}</div>
                <div style={{ fontSize: 11.5, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>{selectedStudent.id} · Klasse {selectedStudent.klasse}</div>
              </div>
              <button onClick={() => { setStep(1); setErrorMsg(null); }} style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Ändern</button>
            </div>

            {/* Neue Bücher */}
            <div style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8, padding: '0 2px' }}>Neue Bücher</div>
            <SearchInput value={bookQuery} onChange={v => { setBookQuery(v); setErrorMsg(null); }} placeholder="Buch suchen — Titel, Fach oder ISBN…" autoFocus />
            {errorMsg && <div style={{ marginTop: 10, padding: '10px 12px', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12.5 }}>{errorMsg}</div>}
            <div style={{ marginTop: 10, background: '#fff', border: '1px solid #e8ecef', borderRadius: 10, overflow: 'hidden' }}>
              {books.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>{bookQuery ? 'Keine passenden Bücher gefunden.' : 'Alle Bücher ausgegeben oder kein Bestand.'}</div>
              ) : books.map((book, index) => {
                const inCart = !!cart.find(item => item.buch_id === book.id);
                const isExpanded = expandedBookId === book.id;
                const hue = (book.fach.charCodeAt(0) * 7) % 360;
                const availableBuckets = (book.zustaende || []).filter(b => b.bestand_verfuegbar > 0);
                const totalAvailable = availableBuckets.reduce((s, b) => s + b.bestand_verfuegbar, 0);
                return (
                  <React.Fragment key={book.id}>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderTop: index === 0 ? 'none' : '1px solid #f8fafc', cursor: 'pointer', background: isExpanded ? '#f8faff' : inCart ? '#f0fdf4' : 'transparent' }}
                      onClick={() => setExpandedBookId(isExpanded ? null : book.id)}
                    >
                      <div style={{ width: 36, height: 44, borderRadius: 4, background: `oklch(0.94 0.04 ${hue})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: `oklch(0.40 0.10 ${hue})`, fontSize: 9, fontWeight: 600, flexShrink: 0, border: '1px solid rgba(0,0,0,.06)' }}>{book.fach.slice(0, 3).toUpperCase()}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a' }}>{book.titel}</div>
                        <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                          {inCart ? <span style={{ color: '#16a34a', fontWeight: 500 }}>Im Warenkorb</span> : <span>{totalAvailable} verfügbar</span>}
                          {book.verlag && <><span>·</span><span>{book.verlag}</span></>}
                        </div>
                      </div>
                      <span style={{ color: '#94a3b8', display: 'flex', transition: 'transform 0.15s', transform: isExpanded ? 'rotate(90deg)' : 'none', flexShrink: 0 }}>
                        <Icon name="chevron-right" size={16} />
                      </span>
                    </div>
                    {isExpanded && (
                      <div style={{ borderTop: '1px solid #e8ecef', background: '#f8fafc', padding: '10px 14px 10px 62px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                          {availableBuckets.map(bucket => {
                            const aufschlagProzent = Number(settings.rueckgabe_aufschlag_prozent || 0);
                            const nj = bucket.nutzungsjahr != null ? bucket.nutzungsjahr : 0;
                            const jahrLabel = njLabel(nj);
                            const jahrC = njColor(nj);
                            const displayPreisCents = nj > 0 ? Math.round(bucket.preis_cents * (1 + aufschlagProzent / 100)) : bucket.preis_cents;
                            const option = { id: `${book.id}-${bucket.bestand_id}`, buch_id: book.id, bestand_id: bucket.bestand_id, titel: book.titel, fach: book.fach, verlag: book.verlag, isbn: book.isbn, nutzungsjahr: nj, preis_cents: displayPreisCents, bestand_frei: bucket.bestand_verfuegbar, jahrLabel };
                            const bucketInCart = !!cart.find(item => item.id === option.id);
                            return (
                              <div key={bucket.bestand_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: jahrC.color, background: jahrC.bg, padding: '2px 8px', borderRadius: 999, minWidth: 0 }}>{jahrLabel}</span>
                                  <span style={{ fontSize: 12.5, fontFamily: 'JetBrains Mono, monospace', color: '#475569' }}>{(displayPreisCents / 100).toFixed(2).replace('.', ',')} €</span>
                                  <span style={{ fontSize: 11.5, color: '#94a3b8' }}>{bucket.bestand_verfuegbar} verfügbar</span>
                                </div>
                                <Btn kind={bucketInCart || inCart ? 'ghost' : 'secondary'} icon={bucketInCart ? 'check' : 'plus'} onClick={e => { e.stopPropagation(); addBook(option); }} accent={accent} disabled={bucketInCart || inCart}>
                                  {bucketInCart ? 'Im Warenkorb' : (inCart ? 'Belegt' : 'Hinzufügen')}
                                </Btn>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Lernmaterial */}
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8, padding: '0 2px' }}>Lernmaterial</div>
              <SearchInput value={lmQuery} onChange={v => { setLmQuery(v); setErrorMsg(null); }} placeholder="Material suchen…" />
              <div style={{ marginTop: 10, background: '#fff', border: '1px solid #e8ecef', borderRadius: 10, overflow: 'hidden' }}>
                {lernmaterialItems.length === 0 ? (
                  <div style={{ padding: '18px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>{lmQuery ? 'Kein passendes Material.' : 'Kein Lernmaterial im Bestand.'}</div>
                ) : lernmaterialItems.map((item, index) => {
                  const inCart = !!lmCart.find(i => i.id === item.id);
                  const outOfStock = item.bestand_frei <= 0;
                  const hue = (item.kategorie.charCodeAt(0) * 37) % 360;
                  return (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderTop: index === 0 ? 'none' : '1px solid #f8fafc' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, background: `oklch(0.94 0.04 ${hue})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: `oklch(0.40 0.10 ${hue})` }}>
                        <Icon name="package" size={15} stroke={1.75} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: outOfStock ? '#94a3b8' : '#0f172a' }}>{item.name}</div>
                        <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 1, display: 'flex', alignItems: 'center', gap: 8 }}><Badge tone="slate">{item.kategorie}</Badge><span>{item.bestand_frei} verfügbar</span></div>
                      </div>
                      <div style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', minWidth: 70, textAlign: 'right', color: outOfStock ? '#94a3b8' : '#0f172a' }}>{(item.preis_cents / 100).toFixed(2).replace('.', ',')} €</div>
                      <Btn kind={inCart || outOfStock ? 'ghost' : 'secondary'} icon={inCart ? 'check' : (outOfStock ? 'alert' : 'plus')} onClick={() => addLernmaterial(item)} accent={accent} disabled={inCart || outOfStock}>{inCart ? 'Im Warenkorb' : (outOfStock ? 'Leer' : 'Hinzufügen')}</Btn>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Weitere Posten */}
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10, padding: '0 2px' }}>Weitere Posten</div>
              {vorlagen.length > 0 && (
                <div style={{ marginBottom: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {vorlagen.map(v => (
                    <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 0, background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
                      <button
                        onClick={() => setFreiCart(prev => [...prev, { _tempId: Date.now(), bezeichnung: v.bezeichnung, betrag_cents: v.betrag_cents, typ: v.typ }])}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 9px', fontSize: 12, color: '#334155', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <span>{v.bezeichnung}</span>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#64748b' }}>{(v.betrag_cents / 100).toFixed(2).replace('.', ',')} €</span>
                      </button>
                      <button onClick={() => deleteVorlage(v.id)} title="Vorlage löschen" style={{ background: 'transparent', border: 'none', borderLeft: '1px solid #e2e8f0', cursor: 'pointer', padding: '4px 7px', color: '#cbd5e1', display: 'flex' }}>
                        <Icon name="x" size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ flex: 2 }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Bezeichnung</div>
                  <input value={freiBezeichnung} onChange={e => setFreiBezeichnung(e.target.value)} onKeyDown={e => e.key === 'Enter' && addFreiposten()} placeholder="z.B. Kopiergeld" style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', color: '#0f172a', background: '#fff', outline: 'none' }} />
                </div>
                <div style={{ flex: '0 0 90px' }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Betrag (€)</div>
                  <input type="number" step="0.01" min="0.01" value={freiBetrag} onChange={e => setFreiBetrag(e.target.value)} onKeyDown={e => e.key === 'Enter' && addFreiposten()} placeholder="5,00" style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13, fontFamily: 'JetBrains Mono, monospace', color: '#0f172a', background: '#fff', outline: 'none' }} />
                </div>
                <div style={{ flex: '0 0 100px' }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Typ</div>
                  <input value={freiTyp} onChange={e => setFreiTyp(e.target.value)} placeholder="Pauschal" style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', color: '#0f172a', background: '#fff', outline: 'none' }} />
                </div>
                <Btn kind="secondary" accent={accent} icon="plus" onClick={addFreiposten} disabled={!freiBezeichnung.trim() || !freiBetrag}>Hinzufügen</Btn>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8, cursor: 'pointer', fontSize: 12, color: '#64748b', userSelect: 'none' }}>
                <input type="checkbox" checked={freiAlsVorlage} onChange={e => setFreiAlsVorlage(e.target.checked)} style={{ accentColor: accent, cursor: 'pointer' }} />
                Als Vorlage speichern
              </label>
            </div>

            {/* Bücher zurückgeben */}
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '2px dashed #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Bücher zurückgeben</div>
                {studentBooks.length > 0 && (
                  <button onClick={() => {
                    const allSelected = studentBooks.every(b => returned[b.rechnungs_posten_id]);
                    const next = {};
                    if (!allSelected) studentBooks.forEach(b => { next[b.rechnungs_posten_id] = true; });
                    setReturned(next);
                  }} style={{ background: 'transparent', border: 'none', color: accent, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit', padding: 0, fontWeight: 500 }}>
                    {studentBooks.every(b => returned[b.rechnungs_posten_id]) ? 'Alle abwählen' : 'Alle auswählen'}
                  </button>
                )}
              </div>
              {studentBooks.length === 0 ? (
                <div style={{ padding: '16px 14px', background: '#f8fafc', border: '1px solid #e8ecef', borderRadius: 10, color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
                  Keine aktiven Bücher bei diesem Schüler.
                </div>
              ) : (
                <div style={{ background: '#fff', border: '1px solid #e8ecef', borderRadius: 10, overflow: 'hidden' }}>
                  {studentBooks.map((b, index) => {
                    const isChecked = !!returned[b.rechnungs_posten_id];
                    const isBeschaedigt = !!beschaedigtKombi[b.rechnungs_posten_id];
                    return (
                      <div key={b.rechnungs_posten_id} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '11px 14px',
                        borderTop: index === 0 ? 'none' : '1px solid #f8fafc',
                        background: isBeschaedigt ? '#fef2f2' : isChecked ? '#eff6ff' : 'transparent',
                        transition: 'background 0.15s',
                      }}>
                        <input type="checkbox" checked={isChecked} onChange={e => {
                          setReturned(prev => ({ ...prev, [b.rechnungs_posten_id]: e.target.checked }));
                          if (!e.target.checked) setBeschaedigtKombi(prev => { const n = { ...prev }; delete n[b.rechnungs_posten_id]; return n; });
                        }} style={{ accentColor: accent, cursor: 'pointer', width: 15, height: 15, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a' }}>{b.titel}</div>
                          <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 1, display: 'flex', gap: 8 }}>
                            <span>{b.fach}</span>
                            <span>·</span>
                            <span>SJ {b.verkauft_schuljahr || b.kaufdatum}</span>
                          </div>
                          {isChecked && (
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 5, cursor: 'pointer', userSelect: 'none' }}>
                              <input
                                type="checkbox"
                                checked={isBeschaedigt}
                                onChange={e => setBeschaedigtKombi(prev => ({ ...prev, [b.rechnungs_posten_id]: e.target.checked }))}
                                style={{ width: 13, height: 13, accentColor: '#dc2626', cursor: 'pointer' }}
                              />
                              <span style={{ fontSize: 11.5, color: isBeschaedigt ? '#dc2626' : '#94a3b8', fontWeight: isBeschaedigt ? 600 : 400 }}>Nicht zurückgenommen</span>
                            </label>
                          )}
                        </div>
                        <div style={{ fontSize: 11.5, textAlign: 'right', lineHeight: 1.55 }}>
                          <div style={{ color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>
                            <span>EK </span>
                            <span style={{ textDecoration: b.abschreibung_prozent > 0 ? 'line-through' : 'none' }}>
                              {(b.preis_cents / 100).toFixed(2).replace('.', ',')} €
                            </span>
                          </div>
                          {b.abschreibung_prozent > 0 && !isBeschaedigt && (
                            <div style={{ color: '#94a3b8', fontSize: 11 }}>
                              {b.nutzungsjahr >= 6 ? `ab Jahr 6` : `Jahr ${b.nutzungsjahr}`} · −{b.abschreibung_prozent} %
                            </div>
                          )}
                          {isBeschaedigt
                            ? <div style={{ color: '#dc2626', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>0,00 €</div>
                            : <div style={{ color: isChecked ? '#1d4ed8' : '#475569', fontFamily: 'JetBrains Mono, monospace', fontWeight: isChecked ? 600 : 500 }}>
                                {(b.gutschrift_cents / 100).toFixed(2).replace('.', ',')} €
                              </div>
                          }
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Rechte Spalte: Warenkorb + Zusammenfassung */}
          <div>
            <div style={{ background: '#fff', border: '1px solid #e8ecef', borderRadius: 10, overflow: 'hidden', position: 'sticky', top: 0 }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Übersicht</div>
                <Badge tone="slate">{cart.length + lmCart.length + freiCart.length} neu · {returnedBooks.length} zurück</Badge>
              </div>

              {cart.length === 0 && lmCart.length === 0 && freiCart.length === 0 && returnedBooks.length === 0 ? (
                <div style={{ padding: '28px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 12.5 }}>Noch keine Auswahl getroffen.</div>
              ) : (
                <div>
                  {/* Neue Bücher im Warenkorb */}
                  {cart.length > 0 && (
                    <div>
                      <div style={{ padding: '6px 14px 4px', fontSize: 10.5, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', background: '#fbfcfd', borderBottom: '1px solid #f1f5f9' }}>Neue Bücher</div>
                      {cart.map((book, index) => (
                        <div key={book.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderTop: index === 0 ? 'none' : '1px solid #f8fafc' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 500, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{book.titel}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{book.jahrLabel || njLabel(book.nutzungsjahr)}</div>
                          </div>
                          <div style={{ fontSize: 12.5, fontFamily: 'JetBrains Mono, monospace', color: '#0f172a' }}>{(book.preis_cents / 100).toFixed(2).replace('.', ',')} €</div>
                          <button onClick={() => removeBook(book.id)} style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', display: 'flex', padding: 2 }}><Icon name="x" size={14} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  {lmCart.length > 0 && (
                    <div>
                      <div style={{ padding: '6px 14px 4px', fontSize: 10.5, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', background: '#fbfcfd', borderBottom: '1px solid #f1f5f9', borderTop: cart.length > 0 ? '1px solid #f1f5f9' : 'none' }}>Lernmaterial</div>
                      {lmCart.map((item, index) => (
                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderTop: index === 0 ? 'none' : '1px solid #f8fafc' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 500, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{item.kategorie}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <button onClick={() => updateLmMenge(item.id, -1)} style={{ width: 20, height: 20, borderRadius: 4, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', cursor: 'pointer', fontSize: 13, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>−</button>
                            <span style={{ fontSize: 12.5, fontFamily: 'JetBrains Mono, monospace', minWidth: 18, textAlign: 'center' }}>{item.menge}</span>
                            <button onClick={() => updateLmMenge(item.id, +1)} style={{ width: 20, height: 20, borderRadius: 4, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', cursor: 'pointer', fontSize: 13, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>+</button>
                          </div>
                          <div style={{ fontSize: 12.5, fontFamily: 'JetBrains Mono, monospace', color: '#0f172a', minWidth: 60, textAlign: 'right' }}>{(item.preis_cents * item.menge / 100).toFixed(2).replace('.', ',')} €</div>
                          <button onClick={() => removeLernmaterial(item.id)} style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', display: 'flex', padding: 2 }}><Icon name="x" size={14} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  {freiCart.length > 0 && (
                    <div>
                      <div style={{ padding: '6px 14px 4px', fontSize: 10.5, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', background: '#fbfcfd', borderBottom: '1px solid #f1f5f9', borderTop: (cart.length > 0 || lmCart.length > 0) ? '1px solid #f1f5f9' : 'none' }}>Weitere Posten</div>
                      {freiCart.map((item, index) => (
                        <div key={item._tempId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderTop: index === 0 ? 'none' : '1px solid #f8fafc' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 500, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.bezeichnung}</div>
                          </div>
                          <div style={{ fontSize: 12.5, fontFamily: 'JetBrains Mono, monospace', color: '#0f172a' }}>{(item.betrag_cents / 100).toFixed(2).replace('.', ',')} €</div>
                          <button onClick={() => removeFreiposten(item._tempId)} style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', display: 'flex', padding: 2 }}><Icon name="x" size={14} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Rückgaben im Warenkorb */}
                  {returnedBooks.length > 0 && (
                    <div>
                      <div style={{ padding: '6px 14px 4px', fontSize: 10.5, color: '#1d4ed8', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', background: '#eff6ff', borderBottom: '1px solid #dbeafe', borderTop: '1px solid #f1f5f9' }}>Rückgaben</div>
                      {returnedBooks.map((b, index) => {
                        const isBeschaedigtCart = !!beschaedigtKombi[b.rechnungs_posten_id];
                        return (
                          <div key={b.rechnungs_posten_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderTop: index === 0 ? 'none' : '1px solid #eff6ff', background: isBeschaedigtCart ? '#fef2f2' : '#f8fbff' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 500, color: isBeschaedigtCart ? '#991b1b' : '#1e40af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.titel}</div>
                              {isBeschaedigtCart && <div style={{ fontSize: 10.5, color: '#dc2626', fontWeight: 600 }}>Nicht zurückgenommen</div>}
                            </div>
                            <div style={{ fontSize: 12.5, fontFamily: 'JetBrains Mono, monospace', color: isBeschaedigtCart ? '#dc2626' : '#1d4ed8' }}>
                              {isBeschaedigtCart ? '0,00 €' : '−' + (b.gutschrift_cents / 100).toFixed(2).replace('.', ',') + ' €'}
                            </div>
                            <button onClick={() => { setReturned(prev => ({ ...prev, [b.rechnungs_posten_id]: false })); setBeschaedigtKombi(prev => { const n = { ...prev }; delete n[b.rechnungs_posten_id]; return n; }); }} style={{ background: 'transparent', border: 'none', color: '#93c5fd', cursor: 'pointer', display: 'flex', padding: 2 }}><Icon name="x" size={14} /></button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Summen */}
              <div style={{ padding: '12px 14px', borderTop: '1px solid #f1f5f9', background: '#fbfcfd' }}>
                {totalNewCents > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569', marginBottom: 4 }}>
                    <span>Neue Positionen</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums' }}>{(totalNewCents / 100).toFixed(2).replace('.', ',')} €</span>
                  </div>
                )}
                {totalReturnCents > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#1d4ed8', marginBottom: 4 }}>
                    <span>Rückgaben</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums' }}>−{(Math.min(totalReturnCents, totalNewCents) / 100).toFixed(2).replace('.', ',')} €</span>
                  </div>
                )}
                {totalReturnCents > totalNewCents && (
                  <div style={{ fontSize: 11, color: '#059669', marginBottom: 4, textAlign: 'right' }}>
                    +{((totalReturnCents - totalNewCents) / 100).toFixed(2).replace('.', ',')} € verbleiben als Guthaben
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 12, paddingTop: totalReturnCents > 0 ? 6 : 0, borderTop: totalReturnCents > 0 ? '1px solid #e2e8f0' : 'none', letterSpacing: '-0.005em' }}>
                  <span>Zu zahlen</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums' }}>{(zuZahlenCents / 100).toFixed(2).replace('.', ',')} €</span>
                </div>
                <Btn kind="primary" full accent={accent} icon="arrow-right" onClick={handleCheckout} disabled={cart.length === 0 && lmCart.length === 0 && freiCart.length === 0}>
                  Rechnung erstellen
                </Btn>
                <div style={{ marginTop: 7 }}>
                  <Btn kind="secondary" full icon="folder" onClick={() => saveCurrentDraft(true)} disabled={cart.length === 0 && lmCart.length === 0 && freiCart.length === 0 && returnedBooks.length === 0}>
                    Als Entwurf speichern
                  </Btn>
                </div>
              </div>
            </div>
          </div>
        </div>
      </FlowShell>
    );
  }

  return (
    <FlowShell title="Ausgabe & Rückgabe" subtitle="Schritt 3 von 3 · Rechnung und Druck" onCancel={handleCancel} step={3} accent={accent}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, maxWidth: 1100, margin: '0 auto' }}>
        <div>
          <div style={{ fontSize: 11.5, color: '#94a3b8', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>Vorschau</div>
          <div style={{ background: '#fff', border: '1px solid #e8ecef', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
            {previewError ? (
              <div style={{ padding: 24, color: '#b91c1c', fontSize: 12.5 }}>{previewError}</div>
            ) : !rechnungPreviewHtml ? (
              <div style={{ padding: 24, color: '#64748b', fontSize: 12.5 }}>Lade Vorschau...</div>
            ) : (
              <iframe title="Rechnungsvorschau" srcDoc={rechnungPreviewHtml} style={{ width: '100%', height: '1150px', border: 'none', background: '#e5e7eb' }} />
            )}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: '#ecfdf5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="check" size={16} />
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a' }}>Bereit zum Drucken</div>
                <div style={{ fontSize: 11.5, color: '#64748b' }}>
                  {cart.length} {cart.length === 1 ? 'Buch' : 'Bücher'} ausgegeben
                  {returnedBooks.length > 0 ? ` · ${returnedBooks.length} zurückgenommen` : ''}
                </div>
              </div>
            </div>
            {saleResult && saleResult.verrechnet_cents > 0 && (
              <div style={{ marginBottom: 8, padding: '8px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 7, fontSize: 12, color: '#1d4ed8' }}>
                <span style={{ fontWeight: 500 }}>Gutschrift verrechnet: </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{(saleResult.verrechnet_cents / 100).toFixed(2).replace('.', ',')} €</span>
                {saleResult.zu_zahlen_cents > 0 && <>
                  {' · Zu zahlen: '}
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{(saleResult.zu_zahlen_cents / 100).toFixed(2).replace('.', ',')} €</span>
                </>}
              </div>
            )}
          </Card>
          <Card padding={14}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>Aktionen</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <Btn kind="primary" full accent={accent} icon="printer" onClick={async () => {
                try { await window.openProtectedDocument(window.api.rechnung.pdf(saleResult.id), true); }
                catch (e) { window.showToast('error', e.message || 'Fehler.'); }
              }}>Rechnung drucken</Btn>
              <Btn kind="secondary" full icon="download" onClick={async () => {
                try { await window.downloadProtectedDocument(window.api.rechnung.pdf(saleResult.id), `${saleResult.id}.pdf`); }
                catch (e) { window.showToast('error', e.message || 'Fehler.'); }
              }}>Als PDF speichern</Btn>
              <Btn kind="secondary" full icon="mail" onClick={() => setMailRechnung({
                id: saleResult.id,
                schueler_name: `${selectedStudent.nachname}, ${selectedStudent.vorname}`,
                status: 'offen',
              })}>Per E-Mail senden</Btn>
            </div>
          </Card>
        </div>
      </div>
      {mailRechnung && window.RechnungMailDialog && (
        <window.RechnungMailDialog
          rechnung={mailRechnung}
          accent={accent}
          onClose={() => setMailRechnung(null)}
          onSent={() => setMailRechnung(null)}
        />
      )}
    </FlowShell>
  );
}

window.Verkauf = Verkauf;
window.KombiniertFlow = KombiniertFlow;
window.FlowShell = FlowShell;
