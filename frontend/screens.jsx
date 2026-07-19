// Rückgabe-Flow + Listen-Screens (Schüler, Bücher, Mahnungen)
// Explizite Abhängigkeiten aus vorher geladenen Dateien
var FlowShell = window.FlowShell;

const RUECKGABE_DRAFT_FLOW = 'buchruckgabe';

function Rueckgabe({ accent, onDone, preselectedStudent }) {
  const [step, setStep] = React.useState(1);
  const [query, setQuery] = React.useState('');
  const [students, setStudents] = React.useState([]);
  const [selectedStudent, setSelectedStudent] = React.useState(null);
  const [studentBooks, setStudentBooks] = React.useState([]);
  const [returned, setReturned] = React.useState({});
  const pendingRestoreRef = React.useRef(null);
  const eigeneEntwuerfe = useVorgangEntwuerfe().filter(e => e.flow === RUECKGABE_DRAFT_FLOW);

  const selectStudent = (student) => {
    const draft = window.vorgangEntwuerfe.get(RUECKGABE_DRAFT_FLOW, student.id);
    pendingRestoreRef.current = (draft && draft.state && draft.state.returned) || null;
    setSelectedStudent(student);
    setStep(3);
  };

  React.useEffect(() => {
    if (preselectedStudent) {
      selectStudent(preselectedStudent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedStudent]);

  React.useEffect(() => {
    if (step === 1) {
      window.api.schueler.list({ q: query }).then(res => setStudents(res.items.slice(0, 8))).catch(console.error);
    }
  }, [query, step]);

  React.useEffect(() => {
    if (selectedStudent && step === 3) {
      window.api.schueler.aktiveBuecher(selectedStudent.id).then(res => {
        setStudentBooks(res.items || []);
        if (pendingRestoreRef.current) {
          setReturned(pendingRestoreRef.current);
          pendingRestoreRef.current = null;
        } else {
          setReturned({});
        }
      }).catch(console.error);
    }
  }, [selectedStudent, step]);

  React.useEffect(() => {
    if (!selectedStudent) return;
    const hatAuswahl = Object.values(returned).some(Boolean);
    if (!hatAuswahl) return;
    window.vorgangEntwuerfe.save(RUECKGABE_DRAFT_FLOW, selectedStudent, { returned });
  }, [selectedStudent, returned]);

  const handleCancel = () => {
    if (selectedStudent) window.vorgangEntwuerfe.remove(RUECKGABE_DRAFT_FLOW, selectedStudent.id);
    onDone();
  };

  const totalCredit = studentBooks.filter(b => returned[b.rechnungs_posten_id]).reduce((s, b) => s + b.gutschrift_cents, 0) / 100;
  const returnedCount = Object.values(returned).filter(Boolean).length;

  const submitReturn = async (print) => {
    const posten_ids = studentBooks.filter(b => returned[b.rechnungs_posten_id]).map(b => b.rechnungs_posten_id);
    if (posten_ids.length === 0) return;
    
    try {
      const res = await window.api.gutschrift({ schueler_id: selectedStudent.id, rechnungs_posten_ids: posten_ids });
      const anzahl = posten_ids.length === 1 ? '1 Buch' : `${posten_ids.length} Bücher`;
      const gutschrift = `${(res.summe_cents / 100).toFixed(2).replace('.', ',')} €`;
      window.showToast('success', `${anzahl} zurückgegeben und Gutschrift ${res.id} (${gutschrift}) in der Schülerkartei hinterlegt.`);
      window.vorgangEntwuerfe.remove(RUECKGABE_DRAFT_FLOW, selectedStudent.id);
      await window.openProtectedDocument(window.api.gutschriften.pdf(res.id), print);
      onDone();
    } catch (e) {
      console.error(e);
      window.showToast('error', e.message || 'Fehler bei der Rückgabe.');
    }
  };

  if (step === 1) {
    return (
      <FlowShell title="Buchrückgabe" subtitle="Schritt 1 von 2 · Schüler auswählen" onCancel={handleCancel} step={1} accent={accent}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <OffeneVorgaengeListe entwuerfe={eigeneEntwuerfe} onSelect={selectStudent} />
          <SearchInput value={query} onChange={setQuery} placeholder="Schüler suchen — Name, Klasse oder ID…" autoFocus/>
          <div style={{ marginTop: 14, background: '#fff', border: '1px solid #e8ecef', borderRadius: 10, overflow: 'hidden' }}>
            {students.map((s, i) => (
              <button key={s.id} onClick={() => selectStudent(s)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px',
                background: 'transparent', border: 'none',
                borderTop: i === 0 ? 'none' : '1px solid #f8fafc',
                cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <Avatar name={s.vorname + " " + s.nachname} size={32}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: '#0f172a', letterSpacing: '-0.005em' }}>{s.nachname}, {s.vorname}</div>
                  <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 1, fontFamily: 'JetBrains Mono, monospace' }}>{s.id} · Klasse {s.klasse}</div>
                </div>
                <span style={{ color: '#cbd5e1' }}><Icon name="chevron-right" size={15}/></span>
              </button>
            ))}
          </div>
        </div>
      </FlowShell>
    );
  }

  return (
    <FlowShell title="Buchrückgabe" subtitle="Schritt 2 von 2 · Bücher zurücknehmen" onCancel={handleCancel} onBack={() => setStep(1)} step={3} accent={accent}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, maxWidth: 1100, margin: '0 auto' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, padding: '10px 14px', background: '#fff', border: '1px solid #e8ecef', borderRadius: 10 }}>
            <Avatar name={selectedStudent.vorname + " " + selectedStudent.nachname} size={34}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: '#0f172a', letterSpacing: '-0.005em' }}>{selectedStudent.nachname}, {selectedStudent.vorname}</div>
              <div style={{ fontSize: 11.5, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>{selectedStudent.id} · Klasse {selectedStudent.klasse}</div>
            </div>
            <button onClick={() => setStep(1)} style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Ändern</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: '0 4px' }}>
            <div style={{ fontSize: 12, color: '#64748b' }}>{studentBooks.length} offene Bücher</div>
            <button onClick={() => {
              const all = {};
              studentBooks.forEach(b => all[b.rechnungs_posten_id] = true);
              setReturned(all);
            }} style={{ background: 'transparent', border: 'none', color: accent, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
              Alle markieren
            </button>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e8ecef', borderRadius: 10, overflow: 'hidden' }}>
            {studentBooks.map((b, i) => {
              const isReturned = !!returned[b.rechnungs_posten_id];
              return (
                <label key={b.rechnungs_posten_id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px',
                  borderTop: i === 0 ? 'none' : '1px solid #f8fafc',
                  cursor: 'pointer',
                  background: isReturned ? '#f0fdf4' : 'transparent',
                }}>
                  <input type="checkbox" checked={isReturned} onChange={(e) => setReturned({ ...returned, [b.rechnungs_posten_id]: e.target.checked })}
                    style={{ width: 16, height: 16, accentColor: '#10b981', cursor: 'pointer' }}/>
                  <div style={{
                    width: 36, height: 44, borderRadius: 4,
                    background: `oklch(0.94 0.04 ${(b.fach.charCodeAt(0) * 7) % 360})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: `oklch(0.40 0.10 ${(b.fach.charCodeAt(0) * 7) % 360})`,
                    fontSize: 9, fontWeight: 600, flexShrink: 0,
                    border: '1px solid rgba(0,0,0,.06)',
                  }}>{b.fach.slice(0, 3).toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a', letterSpacing: '-0.005em' }}>{b.titel}</div>
                    <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 1, display: 'flex', gap: 8 }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{b.rechnung_id}</span>
                      <span>·</span>
                      <span>gekauft {b.kaufdatum}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, fontFamily: 'JetBrains Mono, monospace', color: '#047857', minWidth: 70, textAlign: 'right' }}>
                    +{(b.gutschrift_cents / 100).toFixed(2).replace('.',',')} €
                  </div>
                </label>
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
                {totalCredit.toFixed(2).replace('.',',')} €
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4, lineHeight: 1.4 }}>
                Gutschrift entspricht dem Kaufpreis pro Buch.
              </div>
            </div>
            <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
              <Btn kind="primary" full accent={accent} icon="invoice" disabled={returnedCount === 0} onClick={() => submitReturn(false)}>Gutschrift erstellen</Btn>
              <Btn kind="secondary" full icon="printer" disabled={returnedCount === 0} onClick={() => submitReturn(true)}>Erstellen & drucken</Btn>
            </div>
          </div>
        </div>
      </div>
    </FlowShell>
  );
}

// ---- Schülerliste ----
function SchuelerListe({ accent, onOpenStudent }) {
  const { KLASSEN } = window.CONSTANTS;
  const [students, setStudents] = React.useState([]);
  const [total, setTotal] = React.useState(0);
  const [query, setQuery] = React.useState('');
  const [klasseFilter, setKlasseFilter] = React.useState('');
  const [schuldenFilter, setSchuldenFilter] = React.useState(false);
  const [sortBy, setSortBy] = React.useState(null);
  const [sortDir, setSortDir] = React.useState('asc');
  const [showCreate, setShowCreate] = React.useState(false);
  const [showCsvImport, setShowCsvImport] = React.useState(false);
  const [editingStudent, setEditingStudent] = React.useState(null);
  const [confirmDelete, setConfirmDelete] = React.useState(null);

  const fetchStudents = React.useCallback(() => {
    window.api.schueler.list({ q: query, klasse: klasseFilter, schulden_nur: schuldenFilter ? true : null }).then(res => {
      setStudents(res.items);
      setTotal(res.total);
    }).catch(console.error);
  }, [query, klasseFilter, schuldenFilter]);

  React.useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const _fetchStudentsRef = React.useRef(fetchStudents);
  React.useEffect(() => { _fetchStudentsRef.current = fetchStudents; }, [fetchStudents]);
  React.useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') _fetchStudentsRef.current(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const addStudent = (s) => {
    window.api.schueler.create(s).then(() => {
      setShowCreate(false);
      fetchStudents();
      window.showToast('success', `Schüler ${s.nachname}, ${s.vorname} wurde erfolgreich angelegt.`);
    }).catch(console.error);
  };

  const editStudent = (id, s) => {
    window.api.schueler.update(id, s).then(() => {
      setEditingStudent(null);
      fetchStudents();
      window.showToast('success', `Daten von ${s.nachname}, ${s.vorname} wurden aktualisiert.`);
    }).catch(console.error);
  };

  const removeStudent = (id) => {
    const name = `${confirmDelete.nachname}, ${confirmDelete.vorname}`;
    window.api.schueler.remove(id).then(() => {
      setConfirmDelete(null);
      fetchStudents();
      window.showToast('success', `Schüler ${name} wurde entfernt.`);
    }).catch(console.error);
  };

  const toggleSort = (field) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('asc'); }
  };

  const sortedStudents = React.useMemo(() => {
    if (!sortBy) return students;
    return [...students].sort((a, b) => {
      let va, vb;
      if (sortBy === 'klasse') {
        const cmp = parseInt(a.klasse, 10) - parseInt(b.klasse, 10);
        return sortDir === 'asc' ? cmp : -cmp;
      }
      if (sortBy === 'id') { va = a.id; vb = b.id; }
      else if (sortBy === 'name') { va = `${a.nachname} ${a.vorname}`; vb = `${b.nachname} ${b.vorname}`; }
      const cmp = va.localeCompare(vb, 'de');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [students, sortBy, sortDir]);

  const SortHeader = ({ field, children, style }) => {
    const active = sortBy === field;
    return (
      <div onClick={() => toggleSort(field)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, userSelect: 'none', color: active ? '#334155' : '#94a3b8', ...style }}>
        {children}
        <span style={{ fontSize: 9, opacity: active ? 1 : 0.4 }}>{active && sortDir === 'desc' ? '▼' : '▲'}</span>
      </div>
    );
  };

  return (
    <div style={{ padding: '24px 40px', maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: '#0f172a', margin: 0, letterSpacing: '-0.02em', fontFamily: "'Playfair Display', Georgia, serif" }}>Schüler</h1>
          <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3 }}>{total.toLocaleString('de-DE')} Datensätze</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn kind="secondary" icon="download" onClick={() => setShowCsvImport(true)}>CSV importieren</Btn>
          <Btn kind="primary" accent={accent} icon="plus" onClick={() => setShowCreate(true)}>Schüler anlegen</Btn>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><SearchInput value={query} onChange={setQuery} placeholder="Suchen — Name, Schüler-ID…"/></div>
        <select value={klasseFilter} onChange={(e) => setKlasseFilter(e.target.value)} style={{
          padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8,
          background: '#fff', fontSize: 13.5, fontFamily: 'inherit', color: '#0f172a',
        }}>
          <option value="">Alle Klassen</option>
          {KLASSEN.map(k => <option key={k} value={k}>Klasse {k}</option>)}
        </select>
        <label style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', border: '1px solid', borderColor: schuldenFilter ? '#fca5a5' : '#e2e8f0', borderRadius: 8,
          background: schuldenFilter ? '#fef2f2' : '#fff',
          color: schuldenFilter ? '#b91c1c' : '#475569',
          fontSize: 13.5, fontWeight: 500, cursor: 'pointer',
        }}>
          <input type="checkbox" checked={schuldenFilter} onChange={(e) => setSchuldenFilter(e.target.checked)} style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#b91c1c' }} />
          Schüler mit negativem Saldo
        </label>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e8ecef', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '36px 90px 1fr 80px 1.2fr 110px 130px 64px', gap: 12, padding: '10px 16px', borderBottom: '1px solid #f1f5f9', background: '#fbfcfd', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          <div></div>
          <SortHeader field="id">ID</SortHeader>
          <SortHeader field="name">Name</SortHeader>
          <SortHeader field="klasse">Klasse</SortHeader>
          <div style={{ color: '#94a3b8' }}>Adresse</div>
          <div style={{ textAlign: 'right', color: '#94a3b8' }}>Saldo</div>
          <div style={{ color: '#94a3b8' }}>Letzter Vorgang</div>
          <div></div>
        </div>
        {sortedStudents.map((s, i) => {
          const saldo = s.saldo_cents / 100;
          const saldoFarbe = saldo > 0.005 ? '#047857' : (saldo < -0.005 ? '#b91c1c' : '#94a3b8');
          return (
            <div key={s.id} onClick={() => onOpenStudent && onOpenStudent(s)} style={{
              display: 'grid', gridTemplateColumns: '36px 90px 1fr 80px 1.2fr 110px 130px 64px', gap: 12,
              padding: '10px 16px',
              alignItems: 'center',
              borderTop: i === 0 ? 'none' : '1px solid #f8fafc',
              position: 'relative',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#fbfcfd'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <Avatar name={s.vorname + " " + s.nachname} size={28}/>
              <Badge tone="slate">{s.id}</Badge>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a', letterSpacing: '-0.005em' }}>{s.nachname}, {s.vorname}</div>
              </div>
              <Badge tone="slate" style={{ minWidth: 'calc(2ch + 16px)', justifyContent: 'center' }}>{s.klasse}</Badge>
              <div style={{ fontSize: 12, color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {s.strasse || ''} {s.plz ? `, ${s.plz}` : ''} {s.ort || ''}
              </div>
              <div style={{ textAlign: 'right', fontSize: 12.5, fontFamily: 'JetBrains Mono, monospace', color: saldoFarbe, fontVariantNumeric: 'tabular-nums', fontWeight: Math.abs(saldo) > 0.005 ? 500 : 400 }}>
                {Math.abs(saldo) < 0.005 ? '0,00 €' : `${saldo > 0 ? '+' : ''}${saldo.toFixed(2).replace('.',',')} €`}
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
                {s.letzter_vorgang_datum || '—'}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                <button onClick={(e) => { e.stopPropagation(); setEditingStudent(s); }} title="Schüler bearbeiten" style={{
                  background: 'transparent', border: 'none', color: '#cbd5e1',
                  cursor: 'pointer', padding: 4,
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = accent}
                onMouseLeave={(e) => e.currentTarget.style.color = '#cbd5e1'}
                ><Icon name="edit" size={14}/></button>
                <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(s); }} title="Schüler entfernen" style={{
                  background: 'transparent', border: 'none', color: '#cbd5e1',
                  cursor: 'pointer', padding: 4,
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#b91c1c'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#cbd5e1'}
                ><Icon name="trash" size={14}/></button>
              </div>
            </div>
          );
        })}
      </div>

      {showCreate && <CreateStudentDialog accent={accent} klassen={KLASSEN} onClose={() => setShowCreate(false)} onSave={addStudent}/>}
      {showCsvImport && <ImportStudentsCsvDialog
        accent={accent}
        onClose={() => setShowCsvImport(false)}
        onImported={() => {
          fetchStudents();
          setShowCsvImport(false);
        }}
      />}
      {editingStudent && <EditStudentDialog accent={accent} klassen={KLASSEN} student={editingStudent} onClose={() => setEditingStudent(null)} onSave={(s) => editStudent(editingStudent.id, s)}/>}
      {confirmDelete && <ConfirmDialog
        title="Schüler entfernen?"
        body={<>Möchten Sie <strong>{confirmDelete.nachname}, {confirmDelete.vorname}</strong> ({confirmDelete.id}, Klasse {confirmDelete.klasse}) wirklich entfernen? Zugeordnete Vorgänge bleiben in der Historie erhalten.</>}
        confirmLabel="Endgültig entfernen"
        accent={accent}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => removeStudent(confirmDelete.id)}
      />}
    </div>
  );
}

function Modal({ children, onClose, width = 460 }) {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, backdropFilter: 'blur(2px)',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 12, width,
        boxShadow: '0 20px 60px rgba(15,23,42,0.25)',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
      }}>
        <window.ErrorBoundary onClose={onClose}>{children}</window.ErrorBoundary>
      </div>
    </div>
  );
}

function ImportStudentsCsvDialog({ accent, onClose, onImported }) {
  const REQUIRED_FIELDS = ['vorname', 'nachname', 'klasse'];
  const [loadingPreview, setLoadingPreview] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [preview, setPreview] = React.useState(null);
  const [rowsData, setRowsData] = React.useState([]);
  const [error, setError] = React.useState('');
  const [selected, setSelected] = React.useState({});
  const [fileName, setFileName] = React.useState('');
  const fileInputRef = React.useRef(null);

  const normalize = (value) => (value || '').toString().trim();
  const toKey = (row) => {
    const vorname = normalize(row.vorname).toLowerCase();
    const nachname = normalize(row.nachname).toLowerCase();
    const klasse = normalize(row.klasse).toLowerCase();
    if (!vorname || !nachname || !klasse) return null;
    return `${vorname}|${nachname}|${klasse}`;
  };
  const calcMissing = (row) => REQUIRED_FIELDS.filter((f) => !normalize(row[f]));
  const isMissing = (row, field) => (row.fehlende_felder || []).includes(field);
  const cellInputStyle = (row, field) => ({
    width: '100%',
    padding: '6px 8px',
    border: '1px solid',
    borderColor: isMissing(row, field) ? '#fca5a5' : '#e2e8f0',
    background: isMissing(row, field) ? '#fff1f2' : '#fff',
    borderRadius: 6,
    fontSize: 12.5,
    fontFamily: 'inherit',
    color: '#0f172a',
  });

  const recalcRows = React.useCallback((rows) => {
    const keys = {};
    rows.forEach((row, index) => {
      const key = toKey(row);
      if (!key) return;
      if (!keys[key]) keys[key] = [];
      keys[key].push(index);
    });

    return rows.map((row) => {
      const key = toKey(row);
      const fehlende_felder = calcMissing(row);
      const duplicate_file = key ? (keys[key] || []).length > 1 : false;
      const valid = fehlende_felder.length === 0 && !row.duplicate_existing && !duplicate_file;
      return {
        ...row,
        fehlende_felder,
        duplicate_file,
        valid,
      };
    });
  }, []);

  const setRowsAndSelection = React.useCallback((nextRows, keepSelection = false) => {
    const recalculated = recalcRows(nextRows);
    setRowsData(recalculated);
    setSelected((prev) => {
      if (!keepSelection) {
        const init = {};
        recalculated.forEach((row) => {
          if (row.valid) init[row.row_number] = true;
        });
        return init;
      }
      const next = { ...prev };
      recalculated.forEach((row) => {
        if (!row.valid) delete next[row.row_number];
      });
      return next;
    });
  }, [recalcRows]);

  const updateRowField = (rowNumber, field, value) => {
    const edited = rowsData.map((row) => (
      row.row_number === rowNumber ? { ...row, [field]: value } : row
    ));
    setRowsAndSelection(edited, true);
  };

  const loadPreview = async (file) => {
    setLoadingPreview(true);
    setError('');
    setPreview(null);
    setRowsData([]);
    setSelected({});
    setFileName(file?.name || '');
    try {
      const data = await window.api.schueler.importCsvPreview(file);
      setPreview(data);
      setRowsAndSelection(data.rows || []);
    } catch (err) {
      setError(err.message || 'CSV konnte nicht gelesen werden.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const validRows = rowsData.filter((row) => row.valid);
  const selectableRows = validRows;
  const invalidRowsCount = rowsData.length - validRows.length;
  const selectedCount = selectableRows.filter((row) => !!selected[row.row_number]).length;
  const allSelected = selectableRows.length > 0 && selectableRows.every((row) => !!selected[row.row_number]);

  const toggleAll = () => {
    if (!preview) return;
    setSelected((prev) => {
      const next = { ...prev };
      const turnOn = !allSelected;
      selectableRows.forEach((row) => {
        next[row.row_number] = turnOn;
      });
      return next;
    });
  };

  const toggleOne = (row) => {
    if (!row.valid) return;
    setSelected((prev) => ({ ...prev, [row.row_number]: !prev[row.row_number] }));
  };

  const submitImport = async () => {
    if (!preview) return;
    const rows = rowsData
      .filter((row) => !!selected[row.row_number])
      .map((row) => ({
        vorname: normalize(row.vorname) || null,
        nachname: normalize(row.nachname) || null,
        klasse: normalize(row.klasse) || null,
        strasse: normalize(row.strasse) || null,
        plz: normalize(row.plz) || null,
        ort: normalize(row.ort) || null,
        email_eltern: normalize(row.email_eltern) || null,
        notizen: normalize(row.notizen) || null,
      }));

    if (rows.length === 0) {
      setError('Bitte mindestens einen gültigen Datensatz markieren.');
      return;
    }

    setImporting(true);
    setError('');
    try {
      const res = await window.api.schueler.importCsv(rows);
      window.showToast('success', `${res.imported} Schüler importiert.`);
      if (res.skipped > 0) {
        window.showToast('info', `${res.skipped} Einträge wurden übersprungen.`);
      }
      onImported();
    } catch (err) {
      setError(err.message || 'Import fehlgeschlagen.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal onClose={onClose} width={1040}>
      <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.01em' }}>Schüler per CSV importieren</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Datei hochladen, Datensätze prüfen und anschließend gezielt übernehmen.</div>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', padding: 4 }}>
          <Icon name="x" size={18}/>
        </button>
      </div>

      <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden', flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const file = e.target.files && e.target.files[0];
              if (file) loadPreview(file);
            }}
            style={{ display: 'none' }}
          />
          <Btn kind="secondary" icon="download" onClick={() => fileInputRef.current?.click()} disabled={loadingPreview || importing}>
            {loadingPreview ? 'Datei wird gelesen...' : 'CSV auswählen'}
          </Btn>
          <span style={{ fontSize: 12, color: '#64748b' }}>{fileName || 'Noch keine Datei ausgewählt'}</span>
        </div>

        {error && (
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
        )}

        {preview && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Badge tone="blue">{rowsData.length} Zeilen</Badge>
            <Badge tone="green">{validRows.length} gültig</Badge>
            <Badge tone="red">{invalidRowsCount} mit Problemen</Badge>
          </div>
        )}

        {preview && (
          <div style={{ background: '#fff', border: '1px solid #e8ecef', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #f1f5f9', background: '#fbfcfd' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  {selectedCount} von {selectableRows.length} gültigen Datensätzen ausgewählt
                </div>
                <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#64748b' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#fef2f2', border: '1px solid #f87171', display: 'inline-block' }} />Pflichtfeld fehlt</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#fffbeb', border: '1px solid #fbbf24', display: 'inline-block' }} />Duplikat</span>
                </div>
              </div>
              <Btn kind="ghost" onClick={toggleAll}>{allSelected ? 'Alle abwählen' : 'Alle markieren'}</Btn>
            </div>
            <div style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '42px 70px 1fr 1fr 90px 1fr 1fr 110px 1fr 170px', gap: 10, padding: '8px 14px', borderBottom: '1px solid #f1f5f9', fontSize: 10.5, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', background: '#fbfcfd' }}>
                <div />
                <div>Zeile</div>
                <div>Nachname</div>
                <div>Vorname</div>
                <div>Klasse</div>
                <div>E-Mail</div>
                <div>Straße</div>
                <div>PLZ</div>
                <div>Ort</div>
                <div>Status</div>
              </div>
              {rowsData.map((row, index) => {
                const isChecked = !!selected[row.row_number];
                const status = [];
                if (row.fehlende_felder.length > 0) status.push(`Fehlt: ${row.fehlende_felder.join(', ')}`);
                if (row.duplicate_existing) status.push('Schon vorhanden');
                if (row.duplicate_file) status.push('Doppelt in CSV');
                const ok = status.length === 0;

                const hasMissingFields = row.fehlende_felder.length > 0;
                const isDuplicate = !hasMissingFields && (row.duplicate_existing || row.duplicate_file);
                const rowBg = row.valid
                  ? (isChecked ? '#f0fdf4' : 'transparent')
                  : hasMissingFields
                    ? '#fef2f2'
                    : '#fffbeb';
                const rowBorderLeft = row.valid ? 'none' : hasMissingFields ? '3px solid #f87171' : '3px solid #fbbf24';

                return (
                  <div key={`${row.row_number}-${index}`} style={{
                    display: 'grid',
                    gridTemplateColumns: '42px 70px 1fr 1fr 90px 1fr 1fr 110px 1fr 170px',
                    gap: 10,
                    padding: '9px 14px',
                    alignItems: 'center',
                    borderTop: index === 0 ? 'none' : '1px solid #f8fafc',
                    borderLeft: rowBorderLeft,
                    background: rowBg,
                    opacity: row.valid ? 1 : 0.92,
                  }}>
                    <div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={!row.valid}
                        onChange={() => toggleOne(row)}
                        style={{ width: 15, height: 15, cursor: row.valid ? 'pointer' : 'not-allowed', accentColor: accent }}
                      />
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>{row.row_number}</div>
                    <input
                      value={row.nachname || ''}
                      onChange={(e) => updateRowField(row.row_number, 'nachname', e.target.value)}
                      style={cellInputStyle(row, 'nachname')}
                    />
                    <input
                      value={row.vorname || ''}
                      onChange={(e) => updateRowField(row.row_number, 'vorname', e.target.value)}
                      style={cellInputStyle(row, 'vorname')}
                    />
                    <input
                      value={row.klasse || ''}
                      onChange={(e) => updateRowField(row.row_number, 'klasse', e.target.value)}
                      style={cellInputStyle(row, 'klasse')}
                    />
                    <input
                      value={row.email_eltern || ''}
                      onChange={(e) => updateRowField(row.row_number, 'email_eltern', e.target.value)}
                      style={cellInputStyle(row, 'email_eltern')}
                      placeholder="optional"
                    />
                    <input
                      value={row.strasse || ''}
                      onChange={(e) => updateRowField(row.row_number, 'strasse', e.target.value)}
                      style={cellInputStyle(row, 'strasse')}
                    />
                    <input
                      value={row.plz || ''}
                      onChange={(e) => updateRowField(row.row_number, 'plz', e.target.value)}
                      style={cellInputStyle(row, 'plz')}
                    />
                    <input
                      value={row.ort || ''}
                      onChange={(e) => updateRowField(row.row_number, 'ort', e.target.value)}
                      style={cellInputStyle(row, 'ort')}
                    />
                    <div style={{ fontSize: 11.5, color: ok ? '#047857' : hasMissingFields ? '#dc2626' : '#b45309', fontWeight: ok ? 400 : 500 }}>
                      {ok ? 'Bereit für Import' : status.join(' · ')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', gap: 8, background: '#fbfcfd', borderRadius: '0 0 12px 12px' }}>
        <div style={{ fontSize: 12, color: '#64748b', alignSelf: 'center' }}>
          Pflichtfelder: <strong>nachname, vorname, klasse</strong> · Optional: e-mail, straße, plz, ort
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn kind="ghost" onClick={onClose}>Abbrechen</Btn>
          <Btn kind="primary" accent={accent} icon="check" onClick={submitImport} disabled={importing || selectedCount === 0}>
            {importing ? 'Import läuft...' : 'Ausgewählte übernehmen'}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

function CreateStudentDialog({ accent, klassen, onClose, onSave }) {
  const [vorname, setVorname] = React.useState('');
  const [nachname, setNachname] = React.useState('');
  const [klasse, setKlasse] = React.useState(klassen[0]);
  const [emailEltern, setEmailEltern] = React.useState('');
  const [strasse, setStrasse] = React.useState('');
  const [plz, setPlz] = React.useState('');
  const [ort, setOrt] = React.useState('');
  const valid = vorname.trim() && nachname.trim() && klasse;

  const fieldStyle = {
    width: '100%', padding: '8px 11px',
    border: '1px solid #e2e8f0', borderRadius: 7,
    fontSize: 13.5, fontFamily: 'inherit', color: '#0f172a',
    background: '#fff', outline: 'none',
  };
  const labelStyle = { fontSize: 11.5, color: '#475569', fontWeight: 500, marginBottom: 5, display: 'block' };

  return (
    <Modal onClose={onClose} width={520}>
      <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.01em' }}>Schüler anlegen</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Stammdaten erfassen — Schüler-ID wird automatisch vergeben.</div>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', padding: 4 }}>
          <Icon name="x" size={18}/>
        </button>
      </div>
      <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>Vorname</label>
            <input autoFocus value={vorname} onChange={(e) => setVorname(e.target.value)} placeholder="z.B. Lukas" style={fieldStyle}/>
          </div>
          <div>
            <label style={labelStyle}>Nachname</label>
            <input value={nachname} onChange={(e) => setNachname(e.target.value)} placeholder="z.B. Müller" style={fieldStyle}/>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Klasse</label>
          <select value={klasse} onChange={(e) => setKlasse(e.target.value)} style={fieldStyle}>
            {klassen.map(k => <option key={k} value={k}>Klasse {k}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>E-Mail Eltern (optional)</label>
          <input value={emailEltern} onChange={(e) => setEmailEltern(e.target.value)} placeholder="eltern@example.com" style={fieldStyle}/>
        </div>
        <div style={{ paddingTop: 6, borderTop: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 10 }}>Adresse <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400, color: '#cbd5e1' }}>· optional</span></div>
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Straße & Hausnr.</label>
            <input value={strasse} onChange={(e) => setStrasse(e.target.value)} placeholder="Hauptstraße 12" style={fieldStyle}/>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>PLZ</label>
              <input value={plz} onChange={(e) => setPlz(e.target.value)} placeholder="52538" style={fieldStyle}/>
            </div>
            <div>
              <label style={labelStyle}>Ort</label>
              <input value={ort} onChange={(e) => setOrt(e.target.value)} placeholder="Gangelt" style={fieldStyle}/>
            </div>
          </div>
        </div>
      </div>
      <div style={{ padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#fbfcfd', borderRadius: '0 0 12px 12px' }}>
        <Btn kind="ghost" onClick={onClose}>Abbrechen</Btn>
        <Btn kind="primary" accent={accent} icon="check" disabled={!valid}
          onClick={() => onSave({ vorname, nachname, klasse, email_eltern: emailEltern, strasse, plz, ort })}>
          Schüler anlegen
        </Btn>
      </div>
    </Modal>
  );
}

function EditStudentDialog({ accent, klassen, student, onClose, onSave }) {
  const [vorname, setVorname] = React.useState(student.vorname || '');
  const [nachname, setNachname] = React.useState(student.nachname || '');
  const [klasse, setKlasse] = React.useState(student.klasse || klassen[0]);
  const [emailEltern, setEmailEltern] = React.useState(student.email_eltern || '');
  const [strasse, setStrasse] = React.useState(student.strasse || '');
  const [plz, setPlz] = React.useState(student.plz || '');
  const [ort, setOrt] = React.useState(student.ort || '');
  const valid = vorname.trim() && nachname.trim() && klasse;

  const fieldStyle = {
    width: '100%', padding: '8px 11px',
    border: '1px solid #e2e8f0', borderRadius: 7,
    fontSize: 13.5, fontFamily: 'inherit', color: '#0f172a',
    background: '#fff', outline: 'none',
  };
  const labelStyle = { fontSize: 11.5, color: '#475569', fontWeight: 500, marginBottom: 5, display: 'block' };

  return (
    <Modal onClose={onClose} width={520}>
      <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.01em' }}>Schüler bearbeiten</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Stammdaten aktualisieren.</div>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', padding: 4 }}>
          <Icon name="x" size={18}/>
        </button>
      </div>
      <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>Vorname</label>
            <input autoFocus value={vorname} onChange={(e) => setVorname(e.target.value)} placeholder="z.B. Lukas" style={fieldStyle}/>
          </div>
          <div>
            <label style={labelStyle}>Nachname</label>
            <input value={nachname} onChange={(e) => setNachname(e.target.value)} placeholder="z.B. Müller" style={fieldStyle}/>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Klasse</label>
          <select value={klasse} onChange={(e) => setKlasse(e.target.value)} style={fieldStyle}>
            {klassen.map(k => <option key={k} value={k}>Klasse {k}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>E-Mail Eltern (optional)</label>
          <input value={emailEltern} onChange={(e) => setEmailEltern(e.target.value)} placeholder="eltern@example.com" style={fieldStyle}/>
        </div>
        <div style={{ paddingTop: 6, borderTop: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 10 }}>Adresse <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400, color: '#cbd5e1' }}>· optional</span></div>
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Straße & Hausnr.</label>
            <input value={strasse} onChange={(e) => setStrasse(e.target.value)} placeholder="Hauptstraße 12" style={fieldStyle}/>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>PLZ</label>
              <input value={plz} onChange={(e) => setPlz(e.target.value)} placeholder="52538" style={fieldStyle}/>
            </div>
            <div>
              <label style={labelStyle}>Ort</label>
              <input value={ort} onChange={(e) => setOrt(e.target.value)} placeholder="Gangelt" style={fieldStyle}/>
            </div>
          </div>
        </div>
      </div>
      <div style={{ padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#fbfcfd', borderRadius: '0 0 12px 12px' }}>
        <Btn kind="ghost" onClick={onClose}>Abbrechen</Btn>
        <Btn kind="primary" accent={accent} icon="check" disabled={!valid}
          onClick={() => onSave({ vorname, nachname, klasse, email_eltern: emailEltern, strasse, plz, ort })}>
          Speichern
        </Btn>
      </div>
    </Modal>
  );
}

function ConfirmDialog({ title, body, confirmLabel, accent, onCancel, onConfirm }) {
  return (
    <Modal onClose={onCancel} width={420}>
      <div style={{ padding: '20px 22px 14px' }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: '#fef2f2', color: '#b91c1c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="trash" size={17}/>
          </div>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.005em' }}>{title}</div>
            <div style={{ fontSize: 12.5, color: '#475569', marginTop: 6, lineHeight: 1.5 }}>{body}</div>
          </div>
        </div>
      </div>
      <div style={{ padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#fbfcfd', borderRadius: '0 0 12px 12px' }}>
        <Btn kind="ghost" onClick={onCancel}>Abbrechen</Btn>
        <Btn kind="danger" icon="trash" onClick={onConfirm}>{confirmLabel}</Btn>
      </div>
    </Modal>
  );
}

function RechnungMailDialog({ rechnung, accent, onClose, onSent }) {
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState('');
  const [rendered, setRendered] = React.useState({ subject: '', body: '' });
  const [legacyPreviewMode, setLegacyPreviewMode] = React.useState(false);
  const [form, setForm] = React.useState({
    to_email: '',
    subject_template: '',
    body_template: '',
  });

  const loadPreview = React.useCallback(async (payload = {}) => {
    try {
      setLegacyPreviewMode(false);
      const data = await window.api.rechnung.mailVorschau(rechnung.id, payload);
      return { data, legacy: false };
    } catch (err) {
      const msg = (err?.message || '').toLowerCase();
      const isMethodNotAllowed = msg.includes('method not allowed') || msg.includes('http 405');
      if (!isMethodNotAllowed) throw err;
      setLegacyPreviewMode(true);
      const data = await window.api.rechnung.mailVorlage(rechnung.id);
      return { data, legacy: true };
    }
  }, [rechnung.id]);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    loadPreview({})
      .then(({ data }) => {
        if (!alive) return;
        setForm({
          to_email: data.to_email || '',
          subject_template: data.subject_template || '',
          body_template: data.body_template || '',
        });
        setRendered({
          subject: data.rendered_subject || '',
          body: data.rendered_body || '',
        });
      })
      .catch((err) => {
        if (!alive) return;
        setError(err.message || 'Mail-Vorlage konnte nicht geladen werden.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [loadPreview]);

  const refreshPreview = async () => {
    setError('');
    try {
      const { data, legacy } = await loadPreview(form);
      setRendered({
        subject: data.rendered_subject || '',
        body: data.rendered_body || '',
      });
      if (legacy) {
        setError('Hinweis: Der laufende Backend-Stand nutzt eine alte Vorschau-API. Bitte Backend neu starten, damit bearbeitete Templates direkt gerendert werden.');
      }
    } catch (err) {
      setError(err.message || 'Vorschau konnte nicht aktualisiert werden.');
    }
  };

  const sendMail = async () => {
    setSending(true);
    setError('');
    try {
      const data = await window.api.rechnung.mailSenden(rechnung.id, form);
      window.showToast('success', `Rechnung ${rechnung.anzeige_nr || rechnung.id} wurde an ${data.to_email} versendet.`);
      onSent?.();
    } catch (err) {
      setError(err.message || 'Versand fehlgeschlagen.');
      setSending(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    fontSize: 13,
    fontFamily: 'inherit',
    color: '#0f172a',
    boxSizing: 'border-box',
  };

  return (
    <Modal onClose={onClose} width={760}>
      <div style={{ padding: '18px 20px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.01em' }}>
              Rechnung per E-Mail versenden
            </div>
            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
              {rechnung.anzeige_nr || rechnung.id} · {rechnung.schueler_name}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}>
            <Icon name="x" size={16} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '24px 6px', color: '#64748b', fontSize: 13 }}>Lade Mail-Vorlage...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11.5, color: '#475569', fontWeight: 500, marginBottom: 4 }}>Empfaenger</div>
                <input
                  value={form.to_email}
                  onChange={(e) => setForm((prev) => ({ ...prev, to_email: e.target.value }))}
                  style={inputStyle}
                  placeholder="eltern@example.org"
                />
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11.5, color: '#475569', fontWeight: 500, marginBottom: 4 }}>Betreff-Template</div>
                <input
                  value={form.subject_template}
                  onChange={(e) => setForm((prev) => ({ ...prev, subject_template: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: '#475569', fontWeight: 500, marginBottom: 4 }}>Text-Template</div>
                <textarea
                  value={form.body_template}
                  onChange={(e) => setForm((prev) => ({ ...prev, body_template: e.target.value }))}
                  style={{ ...inputStyle, minHeight: 230, resize: 'vertical', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}
                />
              </div>
              <div style={{ marginTop: 8, fontSize: 11.5, color: '#64748b' }}>
                Platzhalter z.B. <code>{'{{ schueler.name }}'}</code>, <code>{'{{ rechnung.id }}'}</code>, <code>{'{{ rechnung.summe_eur }}'}</code>
              </div>
            </div>

            <div style={{ border: '1px solid #e8ecef', borderRadius: 10, background: '#fbfcfd', padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>Gerenderte Vorschau</div>
                <Btn kind="ghost" icon="refresh-cw" onClick={refreshPreview}>Aktualisieren</Btn>
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Betreff</div>
              <div style={{ marginTop: 4, fontSize: 13, color: '#0f172a', fontWeight: 500, padding: '8px 10px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                {rendered.subject || '—'}
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Text</div>
              <pre style={{
                margin: '4px 0 0',
                padding: '10px',
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                minHeight: 230,
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit',
                fontSize: 12.5,
                color: '#0f172a',
                lineHeight: 1.45,
              }}>
                {rendered.body || '—'}
              </pre>
            </div>
          </div>
        )}

        {error && (
          <div style={{
            marginTop: 10,
            padding: '9px 10px',
            borderRadius: 8,
            border: '1px solid #fecaca',
            background: '#fef2f2',
            color: '#b91c1c',
            fontSize: 12.5,
          }}>
            {error}
          </div>
        )}
        {legacyPreviewMode && !error && (
          <div style={{
            marginTop: 10,
            padding: '9px 10px',
            borderRadius: 8,
            border: '1px solid #fde68a',
            background: '#fffbeb',
            color: '#92400e',
            fontSize: 12.5,
          }}>
            Hinweis: Altes Backend erkannt. Bitte Backend neu starten, damit die Vorschau den bearbeiteten Template-Text sofort übernimmt.
          </div>
        )}
      </div>
      <div style={{
        padding: '12px 20px',
        borderTop: '1px solid #f1f5f9',
        background: '#fbfcfd',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 8,
        borderRadius: '0 0 12px 12px',
      }}>
        <Btn kind="secondary" onClick={onClose}>Abbrechen</Btn>
        <Btn kind="primary" accent={accent} icon="mail" onClick={sendMail} disabled={loading || sending}>
          {sending ? 'Wird versendet...' : 'Mail senden'}
        </Btn>
      </div>
    </Modal>
  );
}

function RechnungsNrDialog({ rechnung, accent, onClose, onSaved }) {
  const [value, setValue] = React.useState(rechnung.anzeige_nr || rechnung.id);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  const save = async () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError('Rechnungsnummer darf nicht leer sein.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await window.api.rechnung.updateAnzeigeNr(rechnung.id, { anzeige_nr: trimmed });
      onSaved(res.anzeige_nr);
    } catch (err) {
      setError(err.message || 'Speichern fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} width={380}>
      <div style={{ padding: '20px 22px 14px' }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.005em', marginBottom: 4 }}>
          Rechnungsnummer bearbeiten
        </div>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>{rechnung.schueler_name}</div>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
          autoFocus
          style={{
            width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8,
            fontSize: 13, fontFamily: 'JetBrains Mono, monospace', color: '#0f172a', boxSizing: 'border-box',
          }}
        />
        {error && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#b91c1c' }}>{error}</div>
        )}
      </div>
      <div style={{
        padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 8,
        background: '#fbfcfd', borderRadius: '0 0 12px 12px',
      }}>
        <Btn kind="secondary" onClick={onClose}>Abbrechen</Btn>
        <Btn kind="primary" accent={accent} onClick={save} disabled={saving}>
          {saving ? 'Speichern...' : 'Speichern'}
        </Btn>
      </div>
    </Modal>
  );
}

// ---- Klassenliste (eigenständige Komponente) ----
function compareKlasseAsc(a, b) {
  const normalize = (value) => String(value || '').trim().toUpperCase();
  const parse = (value) => {
    const normalized = normalize(value);
    const match = normalized.match(/^(\d+)(.*)$/);
    if (!match) return { number: Number.POSITIVE_INFINITY, suffix: normalized };
    return {
      number: parseInt(match[1], 10),
      suffix: (match[2] || '').trim(),
    };
  };

  const left = parse(a);
  const right = parse(b);
  if (left.number !== right.number) return left.number - right.number;
  return left.suffix.localeCompare(right.suffix, 'de', { numeric: true });
}

function KlassenlisteTab({ accent, tabBar }) {
  const [alle, setAlle] = React.useState([]);
  const [settings, setSettings] = React.useState({});
  const [loading, setLoading] = React.useState(true);
  const [filterSj, setFilterSj] = React.useState('');
  const [filterKlasse, setFilterKlasse] = React.useState('');
  const [selected, setSelected] = React.useState(new Set());

  React.useEffect(() => {
    setLoading(true);
    const fn = window.api?.buchhaltung?.alleRechnungen;
    if (!fn) { setLoading(false); return; }
    fn()
      .then(res => {
        const aktive = (res.items || []).filter(r => r.status !== 'storniert' && r.zu_zahlen_cents > 0);
        setAlle(aktive);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    window.api?.einstellungen?.get?.()
      .then(res => setSettings(res || {}))
      .catch(console.error);
  }, []);


  const schuljahre = [...new Set(alle.map(r => r.schuljahr).filter(Boolean))].sort().reverse();
  const klassen = [...new Set(
    alle.filter(r => !filterSj || r.schuljahr === filterSj).map(r => r.klasse).filter(Boolean)
  )].sort(compareKlasseAsc);

  const gefiltert = React.useMemo(() => {
    const source = alle.filter(r => {
      if (filterSj && r.schuljahr !== filterSj) return false;
      if (filterKlasse && r.klasse !== filterKlasse) return false;
      return true;
    });
    const map = new Map();
    source.forEach(r => {
      if (map.has(r.schueler_id)) {
        const entry = map.get(r.schueler_id);
        entry.zu_zahlen_cents += r.zu_zahlen_cents;
        entry.summe_cents += r.summe_cents;
        if ((r.schuljahr || '') > (entry.schuljahr || '')) entry.schuljahr = r.schuljahr;
      } else {
        map.set(r.schueler_id, { ...r, _key: r.schueler_id });
      }
    });
    return [...map.values()]
      .map(r => ({ ...r, zu_zahlen_cents: Math.max(0, r.zu_zahlen_cents - (r.zahlungen_cents || 0)) }))
      .filter(r => r.zu_zahlen_cents > 0)
      .sort((a, b) => {
      const kA = parseInt(a.klasse, 10) || 0;
      const kB = parseInt(b.klasse, 10) || 0;
      if (kA !== kB) return kA - kB;
      return (a.schueler_name || '').localeCompare(b.schueler_name || '', 'de');
    });
  }, [alle, filterSj, filterKlasse]);

  const toggleOne = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const alleAuswaehlen = () => setSelected(new Set(gefiltert.map(r => r._key)));
  const alleAbwaehlen = () => setSelected(new Set());
  const ausgewaehlt = gefiltert.filter(r => selected.has(r._key));
  const ausgewaehltSumme = ausgewaehlt.reduce((s, r) => s + r.zu_zahlen_cents, 0);

  const titelZeile = () => {
    const teile = [];
    if (filterSj) teile.push(`Schuljahr ${filterSj}`);
    if (filterKlasse) teile.push(`Klasse ${filterKlasse}`);
    return teile.length > 0 ? teile.join(' · ') : 'Alle Schuljahre & Klassen';
  };

  const downloadPDF = async () => {
    if (ausgewaehlt.length === 0) return;
    const loadPrintLogo = async () => {
      const candidates = [
        new URL('/logo.png', window.location.origin).toString(),
        new URL('/logo.svg', window.location.origin).toString(),
      ];
      for (const src of candidates) {
        try {
          const res = await fetch(src, { cache: 'force-cache' });
          if (!res.ok) continue;
          const blob = await res.blob();
          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result || '');
            reader.onerror = () => reject(new Error('logo-read-failed'));
            reader.readAsDataURL(blob);
          });
          if (typeof dataUrl === 'string' && dataUrl) return dataUrl;
        } catch (err) {
          // Fallback to the next asset candidate.
        }
      }
      return '';
    };
    const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
    const eur = (cents) => `${(Number(cents || 0) / 100).toFixed(2).replace('.', ',')} €`;
    const docAccent = '#0f766e';
    const schoolName = settings.schule_name || 'Staedtisches Gymnasium';
    const schoolStreet = settings.schule_strasse || 'Schulstrasse 12';
    const schoolZipCity = [settings.schule_plz || '52538', settings.schule_ort || 'Gangelt'].filter(Boolean).join(' ');
    const schoolPhone = settings.schule_telefon || '02454 / 12345';
    const schoolBank = settings.schule_bank || 'Sparkasse Heinsberg';
    const schoolIban = settings.schule_iban || 'DE12 3704 0044 0532 0130 00';
    const schoolBic = settings.schule_bic || 'COBADEFFXXX';
    const heute = new Date().toLocaleDateString('de-DE');
    const logoSrc = await loadPrintLogo();
    const rows = ausgewaehlt.map(r => `
        <tr>
          <td class="mono muted">${esc(r.schueler_id)}</td>
          <td>${esc(r.schueler_name)}</td>
          <td>${esc(r.klasse)}</td>
          <td class="muted">${esc(r.schuljahr)}</td>
          <td class="right">${eur(r.zu_zahlen_cents)}</td>
        </tr>
      `).join('');
    const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Klassenliste</title>
  <style>
    @page { size: A4; margin: 18mm 18mm 26mm 18mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.5;
      color: #222;
      display: flex;
      flex-direction: column;
      min-height: 100%;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .main-content { flex: 1; padding-bottom: 24mm; }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid ${docAccent};
      padding-bottom: 12px;
      margin-bottom: 24px;
    }
    .header-left { display: flex; align-items: flex-start; gap: 14px; }
    .header-logo-wrap {
      width: 90px;
      height: 90px;
      flex-shrink: 0;
      display: flex;
      align-items: flex-start;
      justify-content: flex-start;
      overflow: hidden;
    }
    .header-logo {
      display: block;
      max-width: 100%;
      max-height: 100%;
      width: auto;
      height: auto;
      object-fit: contain;
      object-position: left top;
      flex-shrink: 0;
    }
    .school-name { font-size: 15pt; font-weight: 700; color: ${docAccent}; line-height: 1.2; }
    .school-address { font-size: 8.5pt; color: #555; margin-top: 4px; }
    .doc-info { text-align: right; }
    .doc-title { font-size: 14pt; font-weight: 700; color: ${docAccent}; }
    .doc-date { font-size: 9pt; color: #555; margin-top: 2px; }
    .summary {
      margin-bottom: 24px;
      padding: 12px 16px;
      background: #f0fdfa;
      border-left: 4px solid ${docAccent};
    }
    .summary .label {
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #888;
      margin-bottom: 4px;
    }
    .summary .title { font-size: 13pt; font-weight: 700; color: ${docAccent}; }
    .summary .meta { font-size: 9.5pt; color: #555; margin-top: 2px; }
    .section-title {
      font-size: 11pt;
      font-weight: 700;
      color: ${docAccent};
      margin: 16px 0 8px;
      break-after: avoid;
      page-break-after: avoid;
    }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    thead { display: table-header-group; }
    thead th {
      background: ${docAccent};
      color: #fff;
      font-size: 8.5pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 7px 10px;
      text-align: left;
    }
    tbody td, tfoot td {
      padding: 7px 10px;
      border-bottom: 1px solid #e0e0e0;
      font-size: 9.5pt;
      vertical-align: top;
    }
    tbody tr { break-inside: avoid; page-break-inside: avoid; }
    tbody tr:nth-child(even) { background: #fafcfc; }
    tfoot td {
      border-top: 2px solid ${docAccent};
      border-bottom: none;
      font-weight: 700;
      font-size: 11pt;
      padding-top: 8px;
    }
    .right { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .mono { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-variant-numeric: tabular-nums; }
    .muted { color: #777; }
    .footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      border-top: 1px solid #ccc;
      padding: 6px 18mm 5px;
      font-size: 7.5pt;
      color: #777;
      display: flex;
      justify-content: space-between;
      background: #fff;
    }
    .footer .bank-info { text-align: right; }
    @media screen {
      body { min-height: 257mm !important; }
      .footer {
        position: static !important;
        left: auto !important;
        right: auto !important;
        bottom: auto !important;
        margin-top: auto !important;
        padding: 6px 0 5px !important;
      }
    }
  </style>
</head>
<body>
<div class="main-content">
  <div class="header">
    <div class="header-left">
      ${logoSrc ? `<div class="header-logo-wrap"><img class="header-logo" src="${logoSrc}" alt="Logo" /></div>` : ''}
      <div>
        <div class="school-name">${esc(schoolName)}</div>
        <div class="school-address">
          ${esc(schoolStreet)}<br>
          ${esc(schoolZipCity)}<br>
          Tel: ${esc(schoolPhone)}
        </div>
      </div>
    </div>
    <div class="doc-info">
      <div class="doc-title">Klassenliste</div>
      <div class="doc-date">Datum: ${esc(heute)}</div>
      <div class="doc-date">${esc(titelZeile())}</div>
    </div>
  </div>

  <div class="summary">
    <div class="label">Auswahl</div>
    <div class="title">${esc(titelZeile())}</div>
    <div class="meta">${ausgewaehlt.length} Einträge · Gesamtbetrag ${eur(ausgewaehltSumme)}</div>
  </div>

  <div class="section-title">Einzugsbeträge</div>
  <table>
    <thead>
      <tr>
        <th style="width:90px;">ID</th>
        <th>Name</th>
        <th style="width:70px;">Klasse</th>
        <th style="width:110px;">Schuljahr</th>
        <th class="right" style="width:120px;">Zu zahlen</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="4">Gesamt (${ausgewaehlt.length} ausgewählt)</td>
        <td class="right">${eur(ausgewaehltSumme)}</td>
      </tr>
    </tfoot>
  </table>
</div>

<div class="footer">
  <div>${esc(schoolName)} · ${esc(schoolStreet)} · ${esc(schoolZipCity)}</div>
  <div class="bank-info">IBAN: ${esc(schoolIban)} · BIC: ${esc(schoolBic)}<br>${esc(schoolBank)}</div>
</div>
</body>
</html>`;
    const w = window.open('', '_blank');
    if (!w) {
      window.showToast?.('error', 'Bitte Pop-ups erlauben, um die Klassenliste anzuzeigen.');
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  const downloadCSV = () => {
    if (ausgewaehlt.length === 0) return;
    const bom = '﻿';
    const header = 'ID;Name;Klasse;Schuljahr;Zu zahlen\n';
    const zeilen = ausgewaehlt.map(r =>
      `${r.schueler_id};"${r.schueler_name}";${r.klasse};${r.schuljahr};"${(r.zu_zahlen_cents/100).toFixed(2).replace('.',',')} €"`
    ).join('\n');
    const blob = new Blob([bom + header + zeilen], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Klassenliste_${filterSj || 'alle'}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sel = selected.size;
  const selInView = ausgewaehlt.length;

  return (
    <div style={{ padding: '24px 40px', maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: '#0f172a', margin: 0, letterSpacing: '-0.02em', fontFamily: "'Playfair Display', Georgia, serif" }}>Buchhaltung</h1>
        <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3 }}>Einzugsbeträge auswählen und herunterladen.</div>
      </div>
      {tabBar}

      {/* Filter-Zeile */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={filterSj} onChange={e => { setFilterSj(e.target.value); setFilterKlasse(''); }} style={{ padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', fontSize: 13, fontFamily: 'inherit', color: '#0f172a' }}>
          <option value="">Alle Schuljahre</option>
          {schuljahre.map(sj => <option key={sj} value={sj}>{sj}</option>)}
        </select>
        <select value={filterKlasse} onChange={e => setFilterKlasse(e.target.value)} style={{ padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', fontSize: 13, fontFamily: 'inherit', color: '#0f172a' }}>
          <option value="">Alle Klassen</option>
          {klassen.map(k => <option key={k} value={k}>Klasse {k}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button onClick={alleAuswaehlen} style={{ padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: '#475569' }}>Alle auswählen</button>
        <button onClick={alleAbwaehlen} disabled={sel === 0} style={{ padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: sel === 0 ? '#cbd5e1' : '#475569' }}>Auswahl aufheben</button>
        <Btn kind="secondary" icon="printer" onClick={downloadPDF} disabled={selInView === 0}>PDF</Btn>
        <Btn kind="secondary" icon="download" onClick={downloadCSV} disabled={selInView === 0}>Excel / CSV</Btn>
      </div>

      {/* Ausgewählt-Info */}
      {selInView > 0 && (
        <div style={{ marginBottom: 12, padding: '8px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 12.5, color: '#1d4ed8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{selInView} ausgewählt</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{(ausgewaehltSumme/100).toFixed(2).replace('.',',')} €</span>
        </div>
      )}

      {/* Tabelle */}
      {loading ? (
        <div style={{ padding: '48px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Lade...</div>
      ) : gefiltert.length === 0 ? (
        <div style={{ padding: '48px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Keine Einträge.</div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e8ecef', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '36px 90px 1fr 80px 110px 130px', gap: 12, padding: '10px 16px', borderBottom: '1px solid #f1f5f9', background: '#fbfcfd', fontSize: 10.5, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            <div>
              <input type="checkbox"
                checked={gefiltert.length > 0 && gefiltert.every(r => selected.has(r._key))}
                onChange={e => e.target.checked ? alleAuswaehlen() : alleAbwaehlen()}
                style={{ width: 14, height: 14, cursor: 'pointer' }}
              />
            </div>
            <div>ID</div>
            <div>Name</div>
            <div>Klasse</div>
            <div>Schuljahr</div>
            <div style={{ textAlign: 'right' }}>Zu zahlen</div>
          </div>
          {gefiltert.map((r, i) => {
            const isSelected = selected.has(r._key);
            return (
              <div key={r._key} onClick={() => toggleOne(r._key)} style={{
                display: 'grid', gridTemplateColumns: '36px 90px 1fr 80px 110px 130px', gap: 12,
                padding: '10px 16px', alignItems: 'center',
                borderTop: i === 0 ? 'none' : '1px solid #f8fafc',
                background: isSelected ? '#eff6ff' : 'transparent',
                cursor: 'pointer',
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f8fafc'; }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
              >
                <input type="checkbox" checked={isSelected} onChange={() => toggleOne(r._key)} onClick={e => e.stopPropagation()} style={{ width: 14, height: 14, cursor: 'pointer', accentColor: accent }} />
                <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>{r.schueler_id}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a', letterSpacing: '-0.005em' }}>{r.schueler_name}</div>
                <Badge tone="slate">{r.klasse}</Badge>
                <div style={{ fontSize: 11.5, color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>{r.schuljahr}</div>
                <div style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 600, color: '#0f172a', fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums' }}>
                  {(r.zu_zahlen_cents/100).toFixed(2).replace('.',',')} €
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- Buchhaltung ----
function Buchhaltung({ accent }) {
  const [activeTab, setActiveTab] = React.useState('versand');
  const [schuljahre, setSchuljahre] = React.useState([]);
  const [selectedSj, setSelectedSj] = React.useState(null);
  const [rechnungen, setRechnungen] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [filterKlasse, setFilterKlasse] = React.useState('');
  const [mailRechnung, setMailRechnung] = React.useState(null);
  const [unversandt, setUnversandt] = React.useState([]);
  const [unversandtLoading, setUnversandtLoading] = React.useState(false);
  const [versandt, setVersandt] = React.useState([]);
  const [versandtLoading, setVersandtLoading] = React.useState(false);
  const [archivierend, setArchivierend] = React.useState(null);
  const [editingRechnung, setEditingRechnung] = React.useState(null);
  const [stornierend, setStornierend] = React.useState(null);
  const [confirmStornoId, setConfirmStornoId] = React.useState(null);

  const updateAnzeigeNrLocal = (id, anzeigeNr) => {
    const patch = (list) => list.map(item => item.id === id ? { ...item, anzeige_nr: anzeigeNr } : item);
    setUnversandt(patch);
    setVersandt(patch);
    setRechnungen(patch);
  };

  const loadSchuljahre = () => {
    window.api.buchhaltung.schuljahre().then(res => {
      setSchuljahre(res.items || []);
    }).catch(console.error);
  };

  const loadUnversandt = () => {
    setUnversandtLoading(true);
    window.api.buchhaltung.unversandt()
      .then(res => setUnversandt(res.items || []))
      .catch(console.error)
      .finally(() => setUnversandtLoading(false));
  };

  const loadVersandt = () => {
    setVersandtLoading(true);
    window.api.buchhaltung.versandt()
      .then(res => setVersandt(res.items || []))
      .catch(console.error)
      .finally(() => setVersandtLoading(false));
  };

  const archivierenRechnung = async (r) => {
    setArchivierend(r.id);
    try {
      await window.api.rechnung.archivieren(r.id);
      window.showToast('success', `Rechnung ${r.anzeige_nr || r.id} archiviert.`);
      loadUnversandt();
      loadVersandt();
    } catch (err) {
      window.showToast('error', err.message || 'Fehler beim Archivieren.');
    } finally {
      setArchivierend(null);
    }
  };

  const stornoRechnung = async (r) => {
    setStornierend(r.id);
    try {
      await window.api.rechnung.storno(r.id);
      window.showToast('success', `Rechnung ${r.anzeige_nr || r.id} storniert.`);
      setRechnungen(list => list.map(item => item.id === r.id ? { ...item, status: 'storniert' } : item));
      loadUnversandt();
      loadVersandt();
    } catch (err) {
      window.showToast('error', err.message || 'Fehler beim Stornieren.');
    } finally {
      setStornierend(null);
    }
  };

  React.useEffect(() => { loadSchuljahre(); loadUnversandt(); loadVersandt(); }, []);

  React.useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') { loadUnversandt(); loadVersandt(); } };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  React.useEffect(() => {
    if (!selectedSj) return;
    setFilterKlasse('');
    setLoading(true);
    window.api.buchhaltung.rechnungen(selectedSj)
      .then(res => setRechnungen(res.items || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedSj]);

  const klassen = [...new Set(rechnungen.map(r => r.klasse).filter(Boolean))].sort(compareKlasseAsc);
  const rechnungenGefiltert = filterKlasse ? rechnungen.filter(r => r.klasse === filterKlasse) : rechnungen;
  const aktive = rechnungenGefiltert.filter(r => r.status !== 'storniert');
  const gesamtCents = aktive.reduce((s, r) => s + r.zu_zahlen_cents, 0);
  const storniertAnzahl = rechnungenGefiltert.length - aktive.length;

  const TABS = [
    { id: 'versand', label: 'Rechnungsversand', badge: unversandt.length > 0 ? unversandt.length : null },
    { id: 'buchhaltung', label: 'Buchhaltung' },
    { id: 'klassenliste', label: 'Klassenliste' },
  ];

  const tabBar = (
    <div style={{ display: 'flex', gap: 2, borderBottom: '2px solid #e2e8f0', marginBottom: 24 }}>
      {TABS.map(tab => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 18px',
              fontSize: 13.5,
              fontWeight: active ? 600 : 400,
              color: active ? (accent || '#2563eb') : '#64748b',
              background: 'none',
              border: 'none',
              borderBottom: active ? `2px solid ${accent || '#2563eb'}` : '2px solid transparent',
              marginBottom: -2,
              cursor: 'pointer',
              borderRadius: '6px 6px 0 0',
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              fontFamily: 'inherit',
            }}
          >
            {tab.label}
            {tab.badge != null && (
              <span style={{
                background: accent || '#2563eb',
                color: '#fff',
                fontSize: 10.5,
                fontWeight: 600,
                borderRadius: 99,
                padding: '1px 6px',
                lineHeight: 1.5,
              }}>{tab.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );

  // ── Tab: Rechnungsversand ─────────────────────────────────────────────
  if (activeTab === 'versand') {
    return (
      <div style={{ padding: '24px 40px', maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: '#0f172a', margin: 0, letterSpacing: '-0.02em', fontFamily: "'Playfair Display', Georgia, serif" }}>Buchhaltung</h1>
          <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3 }}>Rechnungen verwalten und per E-Mail versenden.</div>
        </div>
        {tabBar}
        <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, color: '#475569' }}>
            {unversandt.length === 0
              ? 'Alle Rechnungen wurden bereits versandt.'
              : `${unversandt.length} ${unversandt.length === 1 ? 'Rechnung wurde' : 'Rechnungen wurden'} noch nicht per E-Mail versandt.`}
          </div>
          <button
            onClick={() => { loadUnversandt(); loadVersandt(); }}
            style={{ background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 7, padding: '5px 12px', fontSize: 12, color: '#64748b', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Icon name="refresh-cw" size={12} />
            Aktualisieren
          </button>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e8ecef', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '160px minmax(180px, 0.92fr) 64px 96px 108px 108px 176px', gap: 8, padding: '10px 16px', borderBottom: '1px solid #f1f5f9', background: '#fbfcfd', fontSize: 10.5, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            <div>Rechnungs-Nr.</div>
            <div>Schüler</div>
            <div style={{ textAlign: 'center' }}>Klasse</div>
            <div>Datum</div>
            <div style={{ textAlign: 'right' }}>Brutto</div>
            <div style={{ textAlign: 'right' }}>Zu zahlen</div>
            <div />
          </div>
          {unversandtLoading ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Lade...</div>
          ) : unversandt.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>✓</div>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: '#0f172a' }}>Postausgang leer</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Alle erstellten Rechnungen wurden bereits versandt.</div>
            </div>
          ) : unversandt.map((r, i) => (
            <div key={r.id} onClick={() => window.openProtectedDocument(window.api.rechnung.pdf(r.id), false)} style={{
              display: 'grid', gridTemplateColumns: '160px minmax(180px, 0.92fr) 64px 96px 108px 108px 176px', gap: 8,
              padding: '11px 16px', alignItems: 'center',
              borderTop: i === 0 ? 'none' : '1px solid #f8fafc',
              cursor: 'pointer',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ fontSize: 11.5, fontFamily: 'JetBrains Mono, monospace', color: '#475569' }}>{r.anzeige_nr || r.id}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a', letterSpacing: '-0.005em' }}>{r.schueler_name}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace', marginTop: 1 }}>
                  {r.schueler_id}{r.email_eltern ? ` · ${r.email_eltern}` : ' · keine E-Mail'}
                </div>
              </div>
              <Badge tone="slate">{r.klasse}</Badge>
              <div style={{ fontSize: 11.5, color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                {new Date(r.datum).toLocaleDateString('de-DE')}
              </div>
              <div style={{ textAlign: 'right', fontSize: 12.5, color: r.verrechnet_cents > 0 ? '#94a3b8' : '#0f172a', fontFamily: 'JetBrains Mono, monospace', textDecoration: r.verrechnet_cents > 0 ? 'line-through' : 'none' }}>
                {(r.summe_cents / 100).toFixed(2).replace('.', ',')} €
              </div>
              <div style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 600, color: '#0f172a', fontFamily: 'JetBrains Mono, monospace' }}>
                {(r.zu_zahlen_cents / 100).toFixed(2).replace('.', ',')} €
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                <button
                  title="Rechnung öffnen"
                  onClick={e => { e.stopPropagation(); window.openProtectedDocument(window.api.rechnung.pdf(r.id), false); }}
                  style={{ background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.color = '#0f172a'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
                >
                  <Icon name="invoice" size={13} />
                </button>
                <button
                  title="PDF herunterladen"
                  onClick={async e => {
                    e.stopPropagation();
                    try {
                      await window.downloadProtectedDocument(window.api.rechnung.pdf(r.id), `${r.id}.pdf`);
                    } catch (err) {
                      window.showToast('error', err.message || 'PDF konnte nicht heruntergeladen werden.');
                    }
                  }}
                  style={{ background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.color = '#0f172a'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
                >
                  <Icon name="download" size={13} />
                </button>
                <button
                  title="Per E-Mail senden"
                  onClick={e => { e.stopPropagation(); setMailRechnung(r); }}
                  style={{ background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.color = '#0f172a'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
                >
                  <Icon name="mail" size={13} />
                </button>
                <button
                  title="Rechnungsnummer bearbeiten"
                  onClick={e => { e.stopPropagation(); setEditingRechnung(r); }}
                  style={{ background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.color = '#0f172a'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
                >
                  <Icon name="edit" size={13} />
                </button>
                <button
                  title="Rechnung archivieren"
                  disabled={archivierend === r.id}
                  onClick={e => { e.stopPropagation(); archivierenRechnung(r); }}
                  style={{ background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', opacity: archivierend === r.id ? 0.5 : 1 }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.color = '#0f172a'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
                >
                  <Icon name="archive" size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Bereits versandt */}
        {(versandt.length > 0 || versandtLoading) && (
          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10 }}>
              Bereits versandt ({versandt.length})
            </div>
            <div style={{ background: '#fff', border: '1px solid #e8ecef', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '160px minmax(180px, 0.92fr) 64px 96px 108px 132px 100px', gap: 8, padding: '10px 16px', borderBottom: '1px solid #f1f5f9', background: '#fbfcfd', fontSize: 10.5, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                <div>Rechnungs-Nr.</div>
                <div>Schüler</div>
                <div style={{ textAlign: 'center' }}>Klasse</div>
                <div>Datum</div>
                <div style={{ textAlign: 'right' }}>Zu zahlen</div>
                <div>Versandt am</div>
                <div />
              </div>
              {versandtLoading ? (
                <div style={{ padding: '24px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Lade...</div>
              ) : versandt.map((r, i) => (
                <div key={r.id} onClick={() => window.openProtectedDocument(window.api.rechnung.pdf(r.id), false)} style={{
                  display: 'grid', gridTemplateColumns: '160px minmax(180px, 0.92fr) 64px 96px 108px 132px 100px', gap: 8,
                  padding: '11px 16px', alignItems: 'center',
                  borderTop: i === 0 ? 'none' : '1px solid #f8fafc',
                  opacity: 0.75, cursor: 'pointer',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.opacity = '1'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.opacity = '0.75'; }}
                >
                  <div style={{ fontSize: 11.5, fontFamily: 'JetBrains Mono, monospace', color: '#475569' }}>{r.anzeige_nr || r.id}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a', letterSpacing: '-0.005em' }}>{r.schueler_name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace', marginTop: 1 }}>
                      {r.mail_versandt_an || r.email_eltern || 'keine E-Mail'}
                    </div>
                  </div>
                  <Badge tone="slate">{r.klasse}</Badge>
                  <div style={{ fontSize: 11.5, color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                    {new Date(r.datum).toLocaleDateString('de-DE')}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 600, color: '#0f172a', fontFamily: 'JetBrains Mono, monospace' }}>
                    {(r.zu_zahlen_cents / 100).toFixed(2).replace('.', ',')} €
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Badge tone="green">✓</Badge>
                    <span style={{ fontSize: 11.5, color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                      {new Date(r.mail_versandt_am).toLocaleDateString('de-DE')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                    <button
                      title="Rechnung öffnen"
                      onClick={e => { e.stopPropagation(); window.openProtectedDocument(window.api.rechnung.pdf(r.id), false); }}
                      style={{ background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.color = '#0f172a'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
                    >
                      <Icon name="invoice" size={13} />
                    </button>
                    <button
                      title="PDF herunterladen"
                      onClick={async e => {
                        e.stopPropagation();
                        try {
                          await window.downloadProtectedDocument(window.api.rechnung.pdf(r.id), `${r.id}.pdf`);
                        } catch (err) {
                          window.showToast('error', err.message || 'PDF konnte nicht heruntergeladen werden.');
                        }
                      }}
                      style={{ background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.color = '#0f172a'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
                    >
                      <Icon name="download" size={13} />
                    </button>
                    <button
                      title="Rechnungsnummer bearbeiten"
                      onClick={e => { e.stopPropagation(); setEditingRechnung(r); }}
                      style={{ background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.color = '#0f172a'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
                    >
                      <Icon name="edit" size={13} />
                    </button>
                    <button
                      title="Rechnung archivieren"
                      disabled={archivierend === r.id}
                      onClick={e => { e.stopPropagation(); archivierenRechnung(r); }}
                      style={{ background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', opacity: archivierend === r.id ? 0.5 : 1 }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.color = '#0f172a'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
                    >
                      <Icon name="archive" size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {mailRechnung && (
          <RechnungMailDialog
            rechnung={mailRechnung}
            accent={accent}
            onClose={() => setMailRechnung(null)}
            onSent={() => { setMailRechnung(null); loadUnversandt(); loadVersandt(); }}
          />
        )}
        {editingRechnung && (
          <RechnungsNrDialog
            rechnung={editingRechnung}
            accent={accent}
            onClose={() => setEditingRechnung(null)}
            onSaved={(anzeigeNr) => { updateAnzeigeNrLocal(editingRechnung.id, anzeigeNr); setEditingRechnung(null); }}
          />
        )}
      </div>
    );
  }

  // ── Tab: Klassenliste ────────────────────────────────────────────────
  if (activeTab === 'klassenliste') {
    return <KlassenlisteTab accent={accent} tabBar={tabBar} />;
  }

  // ── Tab: Buchhaltung — Schuljahr-Karten ──────────────────────────────
  if (!selectedSj) {
    return (
      <div style={{ padding: '24px 40px', maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: '#0f172a', margin: 0, letterSpacing: '-0.02em', fontFamily: "'Playfair Display', Georgia, serif" }}>Buchhaltung</h1>
          <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3 }}>Schuljahr auswählen, um die Rechnungen einzusehen.</div>
        </div>
        {tabBar}

        {schuljahre.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            Noch keine Schuljahre vorhanden. Sobald eine Rechnung erstellt wird, erscheint das Schuljahr hier.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {schuljahre.map(sj => {
              const anzahlAktiv = sj.anzahl - sj.anzahl_storniert;
              return (
                <button key={sj.schuljahr} onClick={() => setSelectedSj(sj.schuljahr)} style={{
                  background: '#fff', border: '1px solid #e8ecef', borderRadius: 12,
                  padding: '22px 22px 18px', textAlign: 'left', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', gap: 14,
                  fontFamily: 'inherit', transition: 'all .15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(15,23,42,0.07)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e8ecef'; e.currentTarget.style.boxShadow = 'none'; }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: '#eff6ff', color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="euro" size={17} stroke={1.75} />
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.01em' }}>
                      {sj.schuljahr}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 20 }}>
                    <div>
                      <div style={{ fontSize: 10.5, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Rechnungen</div>
                      <div style={{ fontSize: 20, fontWeight: 600, color: '#0f172a', marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>{anzahlAktiv}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10.5, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Umsatz</div>
                      <div style={{ fontSize: 20, fontWeight: 600, color: '#0f172a', marginTop: 2, fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap' }}>
                        {(sj.umsatz_cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid #f1f5f9', fontSize: 11.5, color: '#94a3b8' }}>
                    <span>{sj.anzahl_storniert > 0 ? `${sj.anzahl_storniert} storniert` : 'Keine Stornierungen'}</span>
                    <Icon name="arrow-right" size={14} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Tab: Buchhaltung — Detailansicht Schuljahr ───────────────────────
  return (
    <div style={{ padding: '24px 40px', maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: '#0f172a', margin: 0, letterSpacing: '-0.02em', fontFamily: "'Playfair Display', Georgia, serif" }}>Buchhaltung</h1>
        <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3 }}>Rechnungen verwalten und per E-Mail versenden.</div>
      </div>
      {tabBar}

      <button onClick={() => { setSelectedSj(null); setRechnungen([]); setFilterKlasse(''); }} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'transparent', border: 'none',
        color: '#64748b', fontSize: 12.5, cursor: 'pointer',
        fontFamily: 'inherit', padding: '4px 0', marginBottom: 16,
      }}>
        <Icon name="chevron-right" size={14} style={{ transform: 'rotate(180deg)' }} />
        <span>Zurück zur Übersicht</span>
      </button>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: klassen.length > 0 ? 16 : 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
          Schuljahr {selectedSj}
        </h1>
      </div>

      {klassen.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10.5, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, marginBottom: 10 }}>Klasse</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {klassen.map(k => {
              const aktiv = filterKlasse === k;
              const anzahl = rechnungen.filter(r => r.klasse === k && r.status !== 'storniert').length;
              return (
                <button key={k} onClick={() => setFilterKlasse(aktiv ? '' : k)} style={{
                  padding: '8px 16px', borderRadius: 10, border: aktiv ? ('2px solid ' + accent) : '2px solid #e2e8f0',
                  background: aktiv ? (accent + '10') : '#fff',
                  boxShadow: aktiv ? ('0 0 0 3px ' + accent + '18') : '0 1px 3px rgba(15,23,42,0.06)',
                  cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8,
                  transition: 'all 0.1s',
                }}>
                  <span style={{ fontSize: 13, fontWeight: aktiv ? 600 : 400, color: aktiv ? accent : '#0f172a' }}>{k}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 999, background: aktiv ? (accent + '25') : '#f1f5f9', color: aktiv ? accent : '#64748b' }}>{anzahl}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary-Karten */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <div style={{ background: '#fff', border: '1px solid #e8ecef', borderRadius: 10, padding: '12px 16px' }}>
          <div style={{ fontSize: 10.5, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Rechnungen</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: '#0f172a', marginTop: 4, fontFamily: 'JetBrains Mono, monospace' }}>{aktive.length}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e8ecef', borderRadius: 10, padding: '12px 16px' }}>
          <div style={{ fontSize: 10.5, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Gesamtumsatz</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: '#0f172a', marginTop: 4, fontFamily: 'JetBrains Mono, monospace' }}>
            {(gesamtCents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e8ecef', borderRadius: 10, padding: '12px 16px' }}>
          <div style={{ fontSize: 10.5, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Storniert</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: storniertAnzahl > 0 ? '#b45309' : '#94a3b8', marginTop: 4, fontFamily: 'JetBrains Mono, monospace' }}>{storniertAnzahl}</div>
        </div>
      </div>

      {/* Tabelle */}
      <div style={{ background: '#fff', border: '1px solid #e8ecef', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '148px minmax(170px, 0.82fr) 64px 86px 98px 104px 82px 260px', gap: 6, padding: '10px 14px', borderBottom: '1px solid #f1f5f9', background: '#fbfcfd', fontSize: 10.5, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          <div>Rechnungs-Nr.</div>
          <div>Schüler</div>
          <div style={{ textAlign: 'center' }}>Klasse</div>
          <div>Datum</div>
          <div style={{ textAlign: 'right' }}>Brutto</div>
          <div style={{ textAlign: 'right' }}>Zu zahlen</div>
          <div>Status</div>
          <div />
        </div>
        {loading ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Lade...</div>
        ) : rechnungenGefiltert.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            {rechnungen.length === 0 ? 'Noch keine Rechnungen für dieses Schuljahr.' : 'Keine Rechnungen für die gewählte Klasse.'}
          </div>
        ) : rechnungenGefiltert.map((r, i) => (
          <div key={r.id} onClick={() => window.openProtectedDocument(window.api.rechnung.pdf(r.id), false)} style={{
            display: 'grid', gridTemplateColumns: '148px minmax(170px, 0.82fr) 64px 86px 98px 104px 82px 260px', gap: 6,
            padding: '11px 14px', alignItems: 'center',
            borderTop: i === 0 ? 'none' : '1px solid #f8fafc',
            opacity: r.status === 'storniert' ? 0.4 : 1,
            cursor: 'pointer',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ fontSize: 11.5, fontFamily: 'JetBrains Mono, monospace', color: '#475569' }}>{r.anzeige_nr || r.id}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a', letterSpacing: '-0.005em' }}>{r.schueler_name}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace', marginTop: 1 }}>{r.schueler_id}</div>
            </div>
            <Badge tone="slate">{r.klasse}</Badge>
            <div style={{ fontSize: 11.5, color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
              {new Date(r.datum).toLocaleDateString('de-DE')}
            </div>
            <div style={{ textAlign: 'right', fontSize: 12.5, color: r.verrechnet_cents > 0 ? '#94a3b8' : '#0f172a', fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums', textDecoration: r.verrechnet_cents > 0 ? 'line-through' : 'none' }}>
              {(r.summe_cents / 100).toFixed(2).replace('.', ',')} €
            </div>
            <div style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 600, color: '#0f172a', fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums' }}>
              {(r.zu_zahlen_cents / 100).toFixed(2).replace('.', ',')} €
            </div>
            <div>
              {r.status === 'storniert' ? (
                <Badge tone="red">Storniert</Badge>
              ) : r.status === 'archiviert' ? (
                <Badge tone="slate">Archiviert</Badge>
              ) : r.mail_versandt_am ? (
                <Badge tone="green">Versandt</Badge>
              ) : (
                <Badge tone="yellow">Erstellt</Badge>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
              <button
                title="Rechnung öffnen"
                onClick={e => {
                  e.stopPropagation();
                  window.openProtectedDocument(window.api.rechnung.pdf(r.id), false);
                }}
                style={{ background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.color = '#0f172a'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
              >
                <Icon name="invoice" size={13} />
              </button>
              <button
                title="PDF herunterladen"
                onClick={async e => {
                  e.stopPropagation();
                  try {
                    await window.downloadProtectedDocument(window.api.rechnung.pdf(r.id), `${r.id}.pdf`);
                  } catch (err) {
                    window.showToast('error', err.message || 'PDF konnte nicht heruntergeladen werden.');
                  }
                }}
                style={{ background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.color = '#0f172a'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
              >
                <Icon name="download" size={13} />
              </button>
              <button
                title="Rechnung per E-Mail senden"
                disabled={r.status === 'storniert' || r.status === 'archiviert'}
                onClick={e => { e.stopPropagation(); setMailRechnung(r); }}
                style={{
                  background: 'transparent',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  padding: '4px 6px',
                  cursor: (r.status === 'storniert' || r.status === 'archiviert') ? 'not-allowed' : 'pointer',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  opacity: (r.status === 'storniert' || r.status === 'archiviert') ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (r.status === 'storniert' || r.status === 'archiviert') return;
                  e.currentTarget.style.borderColor = '#94a3b8';
                  e.currentTarget.style.color = '#0f172a';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.color = '#64748b';
                }}
              >
                <Icon name="mail" size={13} />
              </button>
              <button
                title="Rechnungsnummer bearbeiten"
                onClick={e => { e.stopPropagation(); setEditingRechnung(r); }}
                style={{ background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.color = '#0f172a'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
              >
                <Icon name="edit" size={13} />
              </button>
              {r.status !== 'storniert' && (
                confirmStornoId === r.id ? (
                  <>
                    <button
                      onClick={e => { e.stopPropagation(); stornoRechnung(r); setConfirmStornoId(null); }}
                      style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: '#b91c1c', fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit' }}
                    >Ja</button>
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmStornoId(null); }}
                      style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: '#475569', fontSize: 11.5, fontFamily: 'inherit' }}
                    >Nein</button>
                  </>
                ) : (
                  <button
                    title="Rechnung stornieren"
                    disabled={stornierend === r.id}
                    onClick={e => { e.stopPropagation(); setConfirmStornoId(r.id); }}
                    style={{ background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', opacity: stornierend === r.id ? 0.5 : 1 }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#fca5a5'; e.currentTarget.style.color = '#b91c1c'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
                  >
                    <Icon name="x" size={13} />
                  </button>
                )
              )}
              {r.status === 'archiviert' ? (
                <button
                  title="Archivierung aufheben"
                  disabled={archivierend === r.id}
                  onClick={async e => {
                    e.stopPropagation();
                    setArchivierend(r.id);
                    try {
                      await window.api.rechnung.unarchivieren(r.id);
                      window.showToast('success', `Rechnung ${r.anzeige_nr || r.id} wieder aktiv.`);
                      window.api.buchhaltung.rechnungen(selectedSj).then(res => setRechnungen(res.items || [])).catch(console.error);
                    } catch (err) {
                      window.showToast('error', err.message || 'Fehler.');
                    } finally {
                      setArchivierend(null);
                    }
                  }}
                  style={{ background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', opacity: archivierend === r.id ? 0.5 : 1 }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.color = '#0f172a'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
                >
                  <Icon name="undo" size={13} />
                </button>
              ) : r.status !== 'storniert' ? (
                <button
                  title="Rechnung archivieren"
                  disabled={archivierend === r.id}
                  onClick={async e => {
                    e.stopPropagation();
                    setArchivierend(r.id);
                    try {
                      await window.api.rechnung.archivieren(r.id);
                      window.showToast('success', `Rechnung ${r.anzeige_nr || r.id} archiviert.`);
                      loadUnversandt();
                      loadVersandt();
                      window.api.buchhaltung.rechnungen(selectedSj).then(res => setRechnungen(res.items || [])).catch(console.error);
                    } catch (err) {
                      window.showToast('error', err.message || 'Fehler beim Archivieren.');
                    } finally {
                      setArchivierend(null);
                    }
                  }}
                  style={{ background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', opacity: archivierend === r.id ? 0.5 : 1 }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.color = '#0f172a'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
                >
                  <Icon name="archive" size={13} />
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      {mailRechnung && (
        <RechnungMailDialog
          rechnung={mailRechnung}
          accent={accent}
          onClose={() => setMailRechnung(null)}
          onSent={() => {
            setMailRechnung(null);
            loadUnversandt();
            window.api.buchhaltung.rechnungen(selectedSj)
              .then(res => setRechnungen(res.items || []))
              .catch(console.error);
          }}
        />
      )}
      {editingRechnung && (
        <RechnungsNrDialog
          rechnung={editingRechnung}
          accent={accent}
          onClose={() => setEditingRechnung(null)}
          onSaved={(anzeigeNr) => { updateAnzeigeNrLocal(editingRechnung.id, anzeigeNr); setEditingRechnung(null); }}
        />
      )}
    </div>
  );
}

function ListHeader({ title, subtitle, accent, action, actionIcon = 'plus' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: '#0f172a', margin: 0, letterSpacing: '-0.02em', fontFamily: "'Playfair Display', Georgia, serif" }}>{title}</h1>
        <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3 }}>{subtitle}</div>
      </div>
      {action && <Btn kind="primary" accent={accent} icon={actionIcon}>{action}</Btn>}
    </div>
  );
}

// ---- Archiv ----
function Archiv({ accent, onOpenStudent }) {
  const [archiviert, setArchiviert] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [working, setWorking] = React.useState(false);
  const [filterSchuljahr, setFilterSchuljahr] = React.useState('');
  const [filterKlasse, setFilterKlasse] = React.useState('');
  const [search, setSearch] = React.useState('');

  const laden = () => {
    setLoading(true);
    window.api.schueler.archiv()
      .then(res => setArchiviert(res.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  React.useEffect(() => { laden(); }, []);

  React.useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') laden(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const schuljahre = [...new Set(archiviert.map(s => s.schuljahr).filter(Boolean))].sort().reverse();
  const klassenFuerSchuljahr = [...new Set(
    archiviert.filter(s => s.schuljahr === filterSchuljahr).map(s => s.klasse).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));
  const searchLower = search.trim().toLowerCase();
  const liste = archiviert.filter(s => {
    if (filterSchuljahr && s.schuljahr !== filterSchuljahr) return false;
    if (filterKlasse && s.klasse !== filterKlasse) return false;
    if (searchLower) {
      const name = `${s.nachname} ${s.vorname} ${s.vorname} ${s.nachname}`.toLowerCase();
      const id = (s.id || '').toLowerCase();
      if (!name.includes(searchLower) && !id.includes(searchLower) && !(s.klasse || '').toLowerCase().includes(searchLower)) return false;
    }
    return true;
  });
  const listContext = filterSchuljahr
    ? (filterKlasse ? `Klasse ${filterKlasse}` : 'Alle Klassen')
    : 'Alle Schuljahre';

  const handleReaktivieren = async (id, name) => {
    setWorking(true);
    try {
      await window.api.schueler.reaktivieren(id);
      window.showToast('success', name + ' reaktiviert.');
      laden();
    } catch (err) {
      window.showToast('error', err.message || 'Fehler beim Reaktivieren.');
    } finally {
      setWorking(false);
    }
  };

  const karteStyle = (aktiv) => ({
    padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: aktiv ? 600 : 400,
    border: aktiv ? ('2px solid ' + accent) : '2px solid #e2e8f0',
    background: aktiv ? (accent + '12') : '#fff',
    color: aktiv ? accent : '#0f172a',
    cursor: 'pointer', fontFamily: 'inherit',
    boxShadow: aktiv ? ('0 0 0 3px ' + accent + '20') : '0 1px 3px rgba(15,23,42,0.06)',
    display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.1s',
  });

  return (
    <div style={{ padding: '24px 40px', maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: '#0f172a', margin: 0, letterSpacing: '-0.02em', fontFamily: "'Playfair Display', Georgia, serif" }}>Schülerarchiv</h1>
          <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3 }}>Archivierte Schüler nach Schuljahr und Klasse durchsuchen.</div>
        </div>
        <div style={{ width: 280 }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Name, ID oder Klasse suchen…" />
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '48px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Lade...</div>
      ) : archiviert.length === 0 ? (
        <div style={{ padding: '48px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Noch keine archivierten Schüler.</div>
      ) : (
        <div>
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 10.5, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, marginBottom: 14 }}>Schuljahr</div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {schuljahre.map(sj => {
                const anzahl = archiviert.filter(s => s.schuljahr === sj).length;
                const aktiv = filterSchuljahr === sj;
                return (
                  <button key={sj} onClick={() => { setFilterSchuljahr(aktiv ? '' : sj); setFilterKlasse(''); }} style={{
                    padding: '18px 28px', borderRadius: 14, border: aktiv ? ('2px solid ' + accent) : '2px solid #e2e8f0',
                    background: aktiv ? (accent + '10') : '#fff',
                    boxShadow: aktiv ? ('0 0 0 4px ' + accent + '18') : '0 2px 6px rgba(15,23,42,0.07)',
                    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                    transition: 'all 0.12s', minWidth: 140,
                  }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: aktiv ? accent : '#0f172a', letterSpacing: '-0.02em', lineHeight: 1 }}>
                      {sj}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12, color: aktiv ? accent : '#64748b', fontWeight: 500 }}>
                      {anzahl} {anzahl === 1 ? 'Schüler' : 'Schüler'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {filterSchuljahr && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                <button onClick={() => { setFilterSchuljahr(''); setFilterKlasse(''); }} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontFamily: 'inherit', padding: 0 }}>
                  <Icon name="chevron-left" size={13} /> Alle Schuljahre
                </button>
                <span style={{ color: '#cbd5e1' }}>·</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a' }}>{filterSchuljahr}</span>
              </div>
              <div style={{ fontSize: 10.5, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, marginBottom: 12 }}>Klasse</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {klassenFuerSchuljahr.map(k => (
                  <button key={k} onClick={() => setFilterKlasse(k === filterKlasse ? '' : k)} style={karteStyle(filterKlasse === k)}>
                    {k}
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 999, background: filterKlasse === k ? (accent + '25') : '#f1f5f9', color: filterKlasse === k ? accent : '#64748b' }}>
                      {archiviert.filter(s => s.schuljahr === filterSchuljahr && s.klasse === k).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {liste.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                {filterKlasse && (
                  <>
                    <button onClick={() => setFilterKlasse('')} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontFamily: 'inherit', padding: 0 }}>
                      <Icon name="chevron-left" size={13} /> Klasse wechseln
                    </button>
                    <span style={{ color: '#cbd5e1' }}>·</span>
                  </>
                )}
                <span style={{ fontSize: 12.5, color: '#64748b' }}>{filterSchuljahr || 'Alle Schuljahre'}</span>
                <span style={{ color: '#cbd5e1' }}>·</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a' }}>{listContext}</span>
                <span style={{ color: '#cbd5e1' }}>·</span>
                <span style={{ fontSize: 12.5, color: '#64748b' }}>{liste.length} {liste.length === 1 ? 'Schüler' : 'Schüler'}</span>
              </div>
            <div style={{ background: '#fff', border: '1px solid #e8ecef', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: filterSchuljahr ? '36px 1fr 80px 110px 160px auto' : '36px 1fr 120px 80px 110px 160px auto', gap: 12, padding: '10px 16px', borderBottom: '1px solid #f1f5f9', background: '#fbfcfd', fontSize: 10.5, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                <div /><div>Name</div>
                {!filterSchuljahr && <div>Schuljahr</div>}
                <div>Klasse</div>
                <div style={{ textAlign: 'right' }}>Saldo</div>
                <div>Archiviert am</div><div />
              </div>
              {liste.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Keine Schüler in dieser Klasse.</div>
              ) : liste.map((s, i) => {
                const saldo = s.saldo_cents / 100;
                const name = s.nachname + ', ' + s.vorname;
                return (
                  <div key={s.id} style={{
                    display: 'grid', gridTemplateColumns: filterSchuljahr ? '36px 1fr 80px 110px 160px auto' : '36px 1fr 120px 80px 110px 160px auto', gap: 12,
                    padding: '10px 16px', alignItems: 'center',
                    borderTop: i === 0 ? 'none' : '1px solid #f8fafc',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#fbfcfd'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <Avatar name={name} size={28} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a', letterSpacing: '-0.005em' }}>{name}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>{s.id}</div>
                    </div>
                    {!filterSchuljahr && (
                      <div style={{ fontSize: 11.5, color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>{s.schuljahr}</div>
                    )}
                    <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 500 }}>Klasse {s.klasse}</div>
                    <div style={{ textAlign: 'right', fontSize: 12.5, fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums', color: saldo > 0.005 ? '#047857' : saldo < -0.005 ? '#b91c1c' : '#94a3b8', fontWeight: Math.abs(saldo) > 0.005 ? 500 : 400 }}>
                      {Math.abs(saldo) < 0.005 ? '0,00 €' : (saldo > 0 ? '+' : '') + saldo.toFixed(2).replace('.', ',') + ' €'}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
                      {new Date(s.archiviert_am).toLocaleDateString('de-DE')}
                    </div>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <Btn kind="ghost" icon="list" onClick={() => onOpenStudent && onOpenStudent(s)}>Vorgänge</Btn>
                      <Btn kind="ghost" icon="arrow-right" onClick={() => handleReaktivieren(s.id, name)} disabled={working}>Reaktivieren</Btn>
                    </div>
                  </div>
                );
              })}
            </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Klassenversetzung ----
function Klassenversetzung({ accent }) {
  const [vorschau, setVorschau] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [working, setWorking] = React.useState(false);
  const [ausgewaehlt, setAusgewaehlt] = React.useState({});
  const [zielKlasseOverride, setZielKlasseOverride] = React.useState({});

  const load = React.useCallback(() => {
    setLoading(true);
    window.api.klassenversetzung.vorschau()
      .then(data => {
        setVorschau(data);
        // Standard: nur Schüler ohne klasse_seit (Ursprüngliche) vorausgewählt.
        // Kürzlich versetzte Schüler (klasse_seit gesetzt) sind abgewählt.
        const init = {};
        data.gruppen.forEach(g => {
          init[g.klasse_von] = new Set(
            g.schueler.filter(s => s.klasse_seit === null).map(s => s.id)
          );
        });
        setAusgewaehlt(init);
        setZielKlasseOverride({});
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  const toggleSchueler = (klasse_von, schueler_id) => {
    setAusgewaehlt(prev => {
      const s = new Set(prev[klasse_von] || []);
      s.has(schueler_id) ? s.delete(schueler_id) : s.add(schueler_id);
      return { ...prev, [klasse_von]: s };
    });
  };

  const toggleUntergruppe = (klasse_von, ids) => {
    setAusgewaehlt(prev => {
      const s = new Set(prev[klasse_von] || []);
      const allChecked = ids.every(id => s.has(id));
      if (allChecked) ids.forEach(id => s.delete(id));
      else ids.forEach(id => s.add(id));
      return { ...prev, [klasse_von]: s };
    });
  };

  const toggleGruppe = (gruppe) => {
    const all = gruppe.schueler.map(s => s.id);
    const current = ausgewaehlt[gruppe.klasse_von] || new Set();
    const allChecked = all.every(id => current.has(id));
    setAusgewaehlt(prev => ({
      ...prev,
      [gruppe.klasse_von]: allChecked ? new Set() : new Set(all),
    }));
  };

  const gesamtAusgewaehlt = vorschau
    ? vorschau.gruppen.reduce((n, g) => n + (ausgewaehlt[g.klasse_von]?.size || 0), 0)
    : 0;

  const gesamtSchueler = vorschau
    ? vorschau.gruppen.reduce((n, g) => n + g.schueler.length, 0)
    : 0;

  const gruppenSortiert = React.useMemo(
    () => (vorschau?.gruppen ? [...vorschau.gruppen].sort((a, b) => compareKlasseAsc(a.klasse_von, b.klasse_von)) : []),
    [vorschau]
  );

  const toggleAlleAuswaehlen = () => {
    const next = {};
    if (gesamtAusgewaehlt === gesamtSchueler) {
      vorschau.gruppen.forEach(g => { next[g.klasse_von] = new Set(); });
    } else {
      vorschau.gruppen.forEach(g => { next[g.klasse_von] = new Set(g.schueler.map(s => s.id)); });
    }
    setAusgewaehlt(next);
  };

  const handleAusfuehren = async () => {
    if (gesamtAusgewaehlt === 0) return;

    const versetzungen = [];
    vorschau.gruppen.forEach(g => {
      const sel = ausgewaehlt[g.klasse_von] || new Set();
      g.schueler.forEach(s => {
        if (sel.has(s.id)) {
          const ziel = zielKlasseOverride[s.id] ?? s.klasse_nach;
          versetzungen.push({ schueler_id: s.id, klasse_nach: ziel });
        }
      });
    });

    const abgaenger = versetzungen.filter(v => {
      const s = vorschau.gruppen.flatMap(g => g.schueler).find(x => x.id === v.schueler_id);
      const g = vorschau.gruppen.find(gr => gr.klasse_von === s?.klasse_von);
      return g?.ist_abgangsklasse && !(zielKlasseOverride[v.schueler_id]);
    });

    window.showConfirm({
      message: `${versetzungen.length} Schüler werden jetzt versetzt.`,
      detail: abgaenger.length > 0 ? `${abgaenger.length} davon verlassen die Schule (Abgangsklasse) und werden archiviert.` : undefined,
      confirmLabel: 'Jetzt versetzen',
      onConfirm: async () => {
        setWorking(true);
        try {
          const res = await window.api.klassenversetzung.ausfuehren(versetzungen);
          window.showToast('success', `Klassenversetzung abgeschlossen: ${res.versetzt} versetzt, ${res.archiviert} archiviert.`);
          load();
        } catch (err) {
          window.showToast('error', err.message || 'Fehler bei der Versetzung.');
        } finally {
          setWorking(false);
        }
      },
    });
  };

  const naechsterTermin = vorschau?.naechster_schuljahresbeginn
    ? new Date(vorschau.naechster_schuljahresbeginn)
    : null;
  const heuteDatum = new Date();
  heuteDatum.setHours(0, 0, 0, 0);
  const tageVerbleibend = naechsterTermin
    ? Math.ceil((naechsterTermin - heuteDatum) / 86400000)
    : null;
  const isTerminHeute = tageVerbleibend === 0;
  const isTerminAbgelaufen = tageVerbleibend !== null && tageVerbleibend < 0;
  const sperre = vorschau?.versetzung_sperre_aktiv ?? true;
  const gesperrt = sperre && tageVerbleibend !== null && tageVerbleibend > 0;

  const COL = '36px 36px 1fr 120px 130px 110px 160px';

  const SchuelerZeile = ({ s, klasse_von, rowIndex }) => {
    const sel = ausgewaehlt[klasse_von] || new Set();
    const isChecked = sel.has(s.id);
    const ziel = zielKlasseOverride[s.id] ?? s.klasse_nach;
    const saldo = s.saldo_cents / 100;
    return (
      <div style={{
        display: 'grid', gridTemplateColumns: COL, gap: 10,
        padding: '9px 16px', alignItems: 'center',
        borderTop: rowIndex === 0 ? 'none' : '1px solid #f8fafc',
        background: isChecked ? 'transparent' : '#fbfcfd',
        opacity: isChecked ? 1 : 0.45,
      }}>
        <input type="checkbox" checked={isChecked}
          onChange={() => toggleSchueler(klasse_von, s.id)}
          style={{ width: 14, height: 14, cursor: 'pointer', accentColor: accent }} />
        <Avatar name={s.vorname + ' ' + s.nachname} size={26} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a', letterSpacing: '-0.005em' }}>
            {s.nachname}, {s.vorname}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>{s.id}</div>
        </div>
        <Badge tone="slate">{s.klasse_von}</Badge>
        <input value={ziel} disabled={!isChecked}
          onChange={e => setZielKlasseOverride(prev => ({ ...prev, [s.id]: e.target.value }))}
          style={{
            padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 6,
            fontSize: 12.5, fontFamily: 'inherit', color: '#0f172a',
            background: isChecked ? '#fff' : '#f8fafc',
            width: '100%', boxSizing: 'border-box',
            cursor: isChecked ? 'text' : 'not-allowed',
          }} />
        <div style={{ textAlign: 'right', fontSize: 12.5, fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums', color: saldo > 0.005 ? '#047857' : saldo < -0.005 ? '#b91c1c' : '#94a3b8', fontWeight: Math.abs(saldo) > 0.005 ? 500 : 400 }}>
          {Math.abs(saldo) < 0.005 ? '0,00 €' : `${saldo > 0 ? '+' : ''}${saldo.toFixed(2).replace('.', ',')} €`}
        </div>
        <div>
          {s.aktive_buecher > 0
            ? <Badge tone="amber">{s.aktive_buecher} offen</Badge>
            : <Badge tone="green">Keine</Badge>}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '24px 40px', maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: '#0f172a', margin: 0, letterSpacing: '-0.02em', fontFamily: "'Playfair Display', Georgia, serif" }}>Klassenversetzung</h1>
          <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3 }}>
            Schüler für das neue Schuljahr in die nächste Klasse versetzen.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {vorschau?.letzte_versetzung_am && (
            <span style={{ fontSize: 12, color: '#94a3b8' }}>
              Letzte Versetzung: {new Date(vorschau.letzte_versetzung_am).toLocaleDateString('de-DE')}
            </span>
          )}
          {!loading && vorschau && gesamtSchueler > 0 && (
            <Btn kind="secondary" onClick={toggleAlleAuswaehlen}>
              {gesamtAusgewaehlt === gesamtSchueler ? 'Alle abwählen' : 'Alle auswählen'}
            </Btn>
          )}
          <Btn kind="primary" accent={accent} icon="arrow-right"
            disabled={gesamtAusgewaehlt === 0 || working || loading || gesperrt}
            onClick={handleAusfuehren}>
            {working ? 'Wird versetzt…' : gesperrt ? 'Gesperrt bis Schuljahresbeginn' : `${gesamtAusgewaehlt} Schüler versetzen`}
          </Btn>
        </div>
      </div>

      {tageVerbleibend !== null && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 16px', borderRadius: 10, marginBottom: 20,
          background: isTerminHeute ? '#ecfdf5' : isTerminAbgelaufen ? '#fef2f2' : '#eff6ff',
          border: `1px solid ${isTerminHeute ? '#6ee7b7' : isTerminAbgelaufen ? '#fecaca' : '#bfdbfe'}`,
        }}>
          <span style={{ color: isTerminHeute ? '#047857' : isTerminAbgelaufen ? '#b91c1c' : accent }}>
            <Icon name="calendar" size={15} />
          </span>
          <span style={{ fontSize: 13, color: '#0f172a', flex: 1 }}>
            {isTerminHeute
              ? <><strong>Heute</strong> ist der erste Tag des neuen Schuljahres — jetzt ist der richtige Zeitpunkt zur Versetzung.</>
              : isTerminAbgelaufen
              ? <>Der Schuljahresbeginn war vor <strong>{Math.abs(tageVerbleibend)} Tagen</strong>. Die Versetzung steht noch aus.</>
              : <>Noch <strong>{tageVerbleibend} {tageVerbleibend === 1 ? 'Tag' : 'Tage'}</strong> bis zum Schuljahresbeginn am {naechsterTermin.toLocaleDateString('de-DE')}.</>
            }
            {gesperrt && (
              <span style={{ marginLeft: 10, fontSize: 12, color: '#b91c1c' }}>
                · Versetzung gesperrt — in den Einstellungen deaktivierbar.
              </span>
            )}
          </span>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Lade Klassendaten…</div>
      ) : !vorschau || vorschau.gruppen.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
          Keine aktiven Schüler gefunden.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {gruppenSortiert.map(gruppe => {
            const sel = ausgewaehlt[gruppe.klasse_von] || new Set();
            const allChecked = gruppe.schueler.length > 0 && gruppe.schueler.every(s => sel.has(s.id));
            const someChecked = gruppe.schueler.some(s => sel.has(s.id));

            // Untergruppen nach klasse_seit bilden: null = ursprünglich, sonst Datum
            const ugMap = {};
            gruppe.schueler.forEach(s => {
              const key = s.klasse_seit ?? '__original__';
              if (!ugMap[key]) ugMap[key] = [];
              ugMap[key].push(s);
            });
            // Sortierung: Ursprüngliche zuerst, dann nach Datum aufsteigend
            const ugKeys = Object.keys(ugMap).sort((a, b) => {
              if (a === '__original__') return -1;
              if (b === '__original__') return 1;
              return a.localeCompare(b);
            });
            const hatMehrereUntergruppen = ugKeys.length > 1;

            return (
              <div key={gruppe.klasse_von} style={{ background: '#fff', border: '1px solid #e8ecef', borderRadius: 10, overflow: 'hidden' }}>
                {/* Gruppen-Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#fbfcfd', borderBottom: '1px solid #f1f5f9' }}>
                  <input type="checkbox" checked={allChecked}
                    ref={el => { if (el) el.indeterminate = !allChecked && someChecked; }}
                    onChange={() => toggleGruppe(gruppe)}
                    style={{ width: 15, height: 15, cursor: 'pointer', accentColor: accent }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                    <Badge tone="slate">Klasse {gruppe.klasse_von}</Badge>
                    <span style={{ color: '#94a3b8' }}><Icon name="arrow-right" size={13} /></span>
                    <Badge tone={gruppe.ist_abgangsklasse ? 'amber' : 'blue'}>Klasse {gruppe.klasse_nach}</Badge>
                    {gruppe.ist_abgangsklasse && (
                      <span style={{ fontSize: 11.5, color: '#b45309' }}>· Abgangsklasse — Schüler werden archiviert</span>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{sel.size} / {gruppe.schueler.length} ausgewählt</span>
                </div>

                {/* Spalten-Header */}
                <div style={{ display: 'grid', gridTemplateColumns: COL, gap: 10, padding: '8px 16px', borderBottom: '1px solid #f8fafc', fontSize: 10.5, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  <div /><div /><div>Name</div><div>Von</div><div>Nach</div>
                  <div style={{ textAlign: 'right' }}>Saldo</div><div>Bücher</div>
                </div>

                {ugKeys.map(ugKey => {
                  const ugSchueler = ugMap[ugKey];
                  const ugIds = ugSchueler.map(s => s.id);
                  const ugAllChecked = ugIds.every(id => sel.has(id));
                  const ugSomeChecked = ugIds.some(id => sel.has(id));
                  const istKuerzlichVersetzt = ugKey !== '__original__';

                  return (
                    <React.Fragment key={ugKey}>
                      {/* Untergruppen-Header — nur anzeigen wenn mehrere Untergruppen */}
                      {hatMehrereUntergruppen && (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '6px 16px 6px 48px',
                          background: istKuerzlichVersetzt ? '#fffbeb' : '#f8fafc',
                          borderTop: '1px solid #f1f5f9',
                        }}>
                          <input type="checkbox" checked={ugAllChecked}
                            ref={el => { if (el) el.indeterminate = !ugAllChecked && ugSomeChecked; }}
                            onChange={() => toggleUntergruppe(gruppe.klasse_von, ugIds)}
                            style={{ width: 13, height: 13, cursor: 'pointer', accentColor: accent }} />
                          <span style={{ fontSize: 11.5, fontWeight: 500, color: istKuerzlichVersetzt ? '#b45309' : '#475569' }}>
                            {istKuerzlichVersetzt
                              ? `Versetzt am ${new Date(ugKey).toLocaleDateString('de-DE')} — noch nicht weiterversetzen`
                              : 'Ursprüngliche Schüler dieser Klasse'}
                          </span>
                          <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4 }}>
                            ({ugIds.filter(id => sel.has(id)).length} / {ugIds.length} ausgewählt)
                          </span>
                        </div>
                      )}
                      {ugSchueler.map((s, i) => (
                        <SchuelerZeile key={s.id} s={s} klasse_von={gruppe.klasse_von} rowIndex={i} />
                      ))}
                    </React.Fragment>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { Rueckgabe, SchuelerListe, Buchhaltung, Archiv, Klassenversetzung, RechnungMailDialog, Modal, ConfirmDialog });
