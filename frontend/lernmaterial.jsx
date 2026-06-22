// Lernmaterial-Verwaltung (Anlegen, Bearbeiten, Löschen, Kategorien verwalten)

function KategorieCreateDialog({ accent, kategorien, onClose, onSave }) {
  const [name, setName] = React.useState('');
  const trimmed = name.trim();
  const isDuplicate = kategorien.some(k => k.toLowerCase() === trimmed.toLowerCase());
  const valid = trimmed.length > 0 && !isDuplicate;
  const fieldStyle = { width: '100%', padding: '8px 11px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13.5, fontFamily: 'inherit', color: '#0f172a', background: '#fff', outline: 'none' };
  return (
    <Modal onClose={onClose} width={400}>
      <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.01em' }}>Kategorie anlegen</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Neue Kategorie zur Auswahlliste hinzufügen.</div>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', padding: 4 }}><Icon name="x" size={18} /></button>
      </div>
      <div style={{ padding: '18px 22px' }}>
        <label style={{ fontSize: 11.5, color: '#475569', fontWeight: 500, marginBottom: 5, display: 'block' }}>Kategoriename</label>
        <input autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && valid && onSave(trimmed)} placeholder="z.B. Geodreieck" style={fieldStyle} />
        {isDuplicate && <div style={{ fontSize: 11.5, color: '#ef4444', marginTop: 6 }}>Diese Kategorie existiert bereits.</div>}
      </div>
      <div style={{ padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#fbfcfd', borderRadius: '0 0 12px 12px' }}>
        <Btn kind="ghost" onClick={onClose}>Abbrechen</Btn>
        <Btn kind="primary" accent={accent} icon="check" disabled={!valid} onClick={() => onSave(trimmed)}>Kategorie anlegen</Btn>
      </div>
    </Modal>
  );
}

function KategorieEditDialog({ accent, kategorie, kategorien, onClose, onSave }) {
  const [name, setName] = React.useState(kategorie);
  const trimmed = name.trim();
  const isDuplicate = trimmed !== kategorie && kategorien.some(k => k.toLowerCase() === trimmed.toLowerCase());
  const valid = trimmed.length > 0 && !isDuplicate && trimmed !== kategorie;
  const fieldStyle = { width: '100%', padding: '8px 11px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13.5, fontFamily: 'inherit', color: '#0f172a', background: '#fff', outline: 'none' };
  return (
    <Modal onClose={onClose} width={400}>
      <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.01em' }}>Kategorie umbenennen</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Alle Artikel in „{kategorie}" werden aktualisiert.</div>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', padding: 4 }}><Icon name="x" size={18} /></button>
      </div>
      <div style={{ padding: '18px 22px' }}>
        <label style={{ fontSize: 11.5, color: '#475569', fontWeight: 500, marginBottom: 5, display: 'block' }}>Neuer Name</label>
        <input autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && valid && onSave(trimmed)} placeholder={kategorie} style={fieldStyle} />
        {isDuplicate && <div style={{ fontSize: 11.5, color: '#ef4444', marginTop: 6 }}>Diese Kategorie existiert bereits.</div>}
      </div>
      <div style={{ padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#fbfcfd', borderRadius: '0 0 12px 12px' }}>
        <Btn kind="ghost" onClick={onClose}>Abbrechen</Btn>
        <Btn kind="primary" accent={accent} icon="check" disabled={!valid} onClick={() => onSave(trimmed)}>Umbenennen</Btn>
      </div>
    </Modal>
  );
}

function LernmaterialCsvImportDialog({ accent, onClose, onImported }) {
  const [importing, setImporting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [fileName, setFileName] = React.useState('');
  const fileInputRef = React.useRef(null);

  async function importFile(file) {
    if (!file) return;
    setImporting(true);
    setError('');
    setFileName(file.name || '');
    try {
      const res = await window.api.lernmaterial.importCsv(file);
      window.showToast('success', res.imported + ' Artikel importiert.');
      if (res.skipped > 0) window.showToast('info', res.skipped + ' Zeilen wurden übersprungen.');
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
          <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.01em' }}>Lernmaterial per CSV importieren</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Neue Kategorien werden automatisch übernommen.</div>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', padding: 4 }}>
          <Icon name="x" size={18} />
        </button>
      </div>

      <div style={{ padding: '16px 22px', display: 'grid', gap: 14 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={e => { const file = e.target.files && e.target.files[0]; if (file) importFile(file); }}
          style={{ display: 'none' }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Btn kind="secondary" icon="download" onClick={() => fileInputRef.current && fileInputRef.current.click()} disabled={importing}>
            {importing ? 'Import läuft...' : 'CSV auswählen'}
          </Btn>
          <span style={{ fontSize: 12, color: '#64748b' }}>{fileName || 'Noch keine Datei ausgewählt'}</span>
        </div>

        {error ? (
          <div style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontSize: 12.5 }}>
            {error}
          </div>
        ) : null}

        <div style={{ border: '1px solid #e8ecef', borderRadius: 10, background: '#fbfcfd', padding: 12 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>Erwartete Spalten</div>
          <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.7 }}>
            Pflicht: <strong>name</strong>, <strong>kategorie</strong>, <strong>preis</strong><br />
            Optional: bestand
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#fbfcfd', borderRadius: '0 0 12px 12px' }}>
        <Btn kind="ghost" onClick={onClose}>Schließen</Btn>
      </div>
    </Modal>
  );
}

function LernmaterialCreateDialog({ accent, kategorien, onClose, onSave }) {
  const [name, setName] = React.useState('');
  const [kategorie, setKategorie] = React.useState(kategorien[0] || '');
  const [preis, setPreis] = React.useState('');
  const [bestand, setBestand] = React.useState('');
  const valid = name.trim() && kategorie && preis;
  const fieldStyle = { width: '100%', padding: '8px 11px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13.5, fontFamily: 'inherit', color: '#0f172a', background: '#fff', outline: 'none' };
  const labelStyle = { fontSize: 11.5, color: '#475569', fontWeight: 500, marginBottom: 5, display: 'block' };
  return (
    <Modal onClose={onClose} width={480}>
      <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.01em' }}>Lernmaterial anlegen</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Neues Material in den Bestand aufnehmen.</div>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', padding: 4 }}><Icon name="x" size={18} /></button>
      </div>
      <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={labelStyle}>Bezeichnung</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="z.B. Hausaufgabenhefter A5" style={fieldStyle} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>Kategorie</label>
            <select value={kategorie} onChange={e => setKategorie(e.target.value)} style={fieldStyle}>
              {kategorien.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Preis (EUR)</label>
            <input type="number" step="0.01" value={preis} onChange={e => setPreis(e.target.value)} placeholder="2.50" style={{ ...fieldStyle, fontFamily: 'JetBrains Mono, monospace' }} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Anfangsbestand</label>
          <input type="number" value={bestand} onChange={e => setBestand(e.target.value)} placeholder="100" style={{ ...fieldStyle, fontFamily: 'JetBrains Mono, monospace' }} />
        </div>
      </div>
      <div style={{ padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#fbfcfd', borderRadius: '0 0 12px 12px' }}>
        <Btn kind="ghost" onClick={onClose}>Abbrechen</Btn>
        <Btn kind="primary" accent={accent} icon="check" disabled={!valid} onClick={() => onSave({ name, kategorie, preis, bestand })}>Anlegen</Btn>
      </div>
    </Modal>
  );
}

function LernmaterialEditDialog({ accent, item, kategorien, onClose, onSave }) {
  const [name, setName] = React.useState(item.name || '');
  const [kategorie, setKategorie] = React.useState(item.kategorie || (kategorien[0] || ''));
  const [preis, setPreis] = React.useState(item.preis_cents ? (item.preis_cents / 100).toFixed(2) : '');
  const [bestand, setBestand] = React.useState(item.bestand_gesamt != null ? String(item.bestand_gesamt) : '');
  const valid = name.trim() && kategorie && preis;
  const fieldStyle = { width: '100%', padding: '8px 11px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13.5, fontFamily: 'inherit', color: '#0f172a', background: '#fff', outline: 'none' };
  const labelStyle = { fontSize: 11.5, color: '#475569', fontWeight: 500, marginBottom: 5, display: 'block' };
  return (
    <Modal onClose={onClose} width={480}>
      <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.01em' }}>Lernmaterial bearbeiten</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{item.id}</div>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', padding: 4 }}><Icon name="x" size={18} /></button>
      </div>
      <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={labelStyle}>Bezeichnung</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} style={fieldStyle} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>Kategorie</label>
            <select value={kategorie} onChange={e => setKategorie(e.target.value)} style={fieldStyle}>
              {kategorien.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Preis (EUR)</label>
            <input type="number" step="0.01" value={preis} onChange={e => setPreis(e.target.value)} style={{ ...fieldStyle, fontFamily: 'JetBrains Mono, monospace' }} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Bestand gesamt</label>
          <input type="number" value={bestand} onChange={e => setBestand(e.target.value)} style={{ ...fieldStyle, fontFamily: 'JetBrains Mono, monospace' }} />
        </div>
      </div>
      <div style={{ padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#fbfcfd', borderRadius: '0 0 12px 12px' }}>
        <Btn kind="ghost" onClick={onClose}>Abbrechen</Btn>
        <Btn kind="primary" accent={accent} icon="check" disabled={!valid} onClick={() => onSave({ name, kategorie, preis, bestand })}>Speichern</Btn>
      </div>
    </Modal>
  );
}

window.LernmaterialListe = function LernmaterialListe({ accent }) {
  const konstantKategorien = (window.CONSTANTS && window.CONSTANTS.LERNMATERIAL_KATEGORIEN) || [];
  const [items, setItems] = React.useState([]);
  const [total, setTotal] = React.useState(0);
  const [query, setQuery] = React.useState('');
  const [showCreate, setShowCreate] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState(null);
  const [confirmDelete, setConfirmDelete] = React.useState(null);
  const [selectedKategorie, setSelectedKategorie] = React.useState(null);

  const [extraKategorien, setExtraKategorien] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('bibliomat_extra_lm_kategorien') || '[]'); } catch (e) { return []; }
  });
  const [deletedKategorien, setDeletedKategorien] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('bibliomat_deleted_lm_kategorien') || '[]'); } catch (e) { return []; }
  });
  const [showKategorieCreate, setShowKategorieCreate] = React.useState(false);
  const [editingKategorie, setEditingKategorie] = React.useState(null);
  const [showCsvImport, setShowCsvImport] = React.useState(false);

  function fetchAll() {
    window.api.lernmaterial.list({ limit: 500 }).then(res => {
      setItems(res.items || []);
      setTotal(res.total || 0);
    }).catch(err => { console.error(err); setItems([]); setTotal(0); });
  }

  React.useEffect(() => { fetchAll(); }, []);

  const kategorien = React.useMemo(() => {
    const fromItems = items.map(i => i.kategorie).filter(Boolean);
    const hiddenKategorien = new Set(deletedKategorien);
    const merged = Array.from(new Set(
      konstantKategorien.filter(k => !hiddenKategorien.has(k))
        .concat(extraKategorien.filter(k => !hiddenKategorien.has(k)))
        .concat(fromItems)
    ));
    const filtered = merged;
    filtered.sort((a, b) => a.localeCompare(b, 'de'));
    return filtered;
  }, [items, extraKategorien, deletedKategorien]);

  const kategorieItems = React.useMemo(() => {
    if (!selectedKategorie) return [];
    return items.filter(i => i.kategorie === selectedKategorie)
      .filter(i => !query || i.name.toLowerCase().includes(query.toLowerCase()) || i.id.toLowerCase().includes(query.toLowerCase()));
  }, [items, selectedKategorie, query]);

  const KATEGORIE_FARBEN = { 'Hefter': 210, 'Taschenrechner': 160, 'Formelsammlung': 280, 'Lineal': 40, 'Zirkel': 20, 'Tintenkiller': 330, 'Sonstiges': 0 };
  const KATEGORIE_ICONS = { 'Hefter': 'folder', 'Taschenrechner': 'calculator', 'Formelsammlung': 'book', 'Lineal': 'ruler', 'Zirkel': 'compass', 'Tintenkiller': 'pen', 'Sonstiges': 'package' };
  const kategorieHue = kat => KATEGORIE_FARBEN[kat] != null ? KATEGORIE_FARBEN[kat] : (kat.charCodeAt(0) * 7) % 360;
  const kategorieIcon = kat => KATEGORIE_ICONS[kat] || 'package';

  function addItem(data) {
    window.api.lernmaterial.create({
      name: data.name, kategorie: data.kategorie,
      preis_cents: Math.round(parseFloat(data.preis) * 100),
      bestand_gesamt: parseInt(data.bestand, 10) || 0,
    }).then(() => { setShowCreate(false); fetchAll(); window.showToast('success', `„${data.name}" wurde angelegt.`); })
      .catch(err => window.showToast('error', err.message || 'Fehler beim Anlegen.'));
  }

  function saveItem(id, data) {
    window.api.lernmaterial.update(id, {
      name: data.name, kategorie: data.kategorie,
      preis_cents: Math.round(parseFloat(data.preis) * 100),
      bestand_gesamt: parseInt(data.bestand, 10) || 0,
    }).then(() => { setEditingItem(null); fetchAll(); window.showToast('success', `„${data.name}" wurde aktualisiert.`); })
      .catch(err => window.showToast('error', err.message || 'Fehler beim Speichern.'));
  }

  function removeItem(id) {
    const name = confirmDelete ? confirmDelete.name : 'Material';
    window.api.lernmaterial.remove(id).then(() => { setConfirmDelete(null); fetchAll(); window.showToast('success', `„${name}" wurde entfernt.`); })
      .catch(err => window.showToast('error', err.message || 'Fehler beim Entfernen.'));
  }

  function addKategorie(name) {
    const updated = extraKategorien.concat([name]);
    setExtraKategorien(updated);
    try { localStorage.setItem('bibliomat_extra_lm_kategorien', JSON.stringify(updated)); } catch (e) {}
    const updatedDeleted = deletedKategorien.filter(k => k !== name);
    setDeletedKategorien(updatedDeleted);
    try { localStorage.setItem('bibliomat_deleted_lm_kategorien', JSON.stringify(updatedDeleted)); } catch (e) {}
    setShowKategorieCreate(false);
    window.showToast('success', `Kategorie „${name}" wurde angelegt.`);
  }

  async function renameKategorie(alt, neu) {
    try {
      const res = await window.api.lernmaterial.renameKategorie(alt, neu);
      const updatedExtra = extraKategorien.map(k => k === alt ? neu : k);
      setExtraKategorien(updatedExtra);
      try { localStorage.setItem('bibliomat_extra_lm_kategorien', JSON.stringify(updatedExtra)); } catch (e) {}
      if (selectedKategorie === alt) setSelectedKategorie(neu);
      setEditingKategorie(null);
      fetchAll();
      window.showToast('success', `„${alt}" wurde in „${neu}" umbenannt (${res.aktualisiert} Artikel aktualisiert).`);
    } catch (err) {
      window.showToast('error', err.message || 'Fehler beim Umbenennen.');
    }
  }

  function deleteKategorie(kat) {
    const count = items.filter(i => i.kategorie === kat).length;
    if (count > 0) {
      window.showToast('error', `Kategorie „${kat}" hat noch ${count} Artikel. Bitte erst Artikel umhängen oder entfernen.`);
      return;
    }
    const updatedExtra = extraKategorien.filter(k => k !== kat);
    setExtraKategorien(updatedExtra);
    try { localStorage.setItem('bibliomat_extra_lm_kategorien', JSON.stringify(updatedExtra)); } catch (e) {}
    const updatedDeleted = deletedKategorien.concat([kat]);
    setDeletedKategorien(updatedDeleted);
    try { localStorage.setItem('bibliomat_deleted_lm_kategorien', JSON.stringify(updatedDeleted)); } catch (e) {}
    window.showToast('success', `Kategorie „${kat}" wurde entfernt.`);
  }

  const ItemRow = ({ item, index }) => {
    const hue = kategorieHue(item.kategorie);
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 100px 120px 64px', gap: 12, padding: '12px 16px', alignItems: 'center', borderTop: index === 0 ? 'none' : '1px solid #f8fafc' }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: `oklch(0.94 0.04 ${hue})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: `oklch(0.40 0.10 ${hue})` }}>
          <Icon name={kategorieIcon(item.kategorie)} size={16} stroke={1.75} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a', letterSpacing: '-0.005em' }}>{item.name}</div>
          <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace', marginTop: 1 }}>{item.id}</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 13, fontFamily: 'JetBrains Mono, monospace', color: '#0f172a' }}>
          {(item.preis_cents / 100).toFixed(2).replace('.', ',')} €
        </div>
        <div style={{ textAlign: 'right', fontSize: 13, fontFamily: 'JetBrains Mono, monospace', color: '#0f172a' }}>
          {item.bestand_frei}<span style={{ color: '#94a3b8' }}>/{item.bestand_gesamt}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
          <button onClick={() => setEditingItem(item)} title="Bearbeiten" style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: 4 }}>
            <Icon name="edit" size={14} />
          </button>
          <button onClick={() => setConfirmDelete(item)} title="Entfernen" style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: 4 }}>
            <Icon name="trash" size={14} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '24px 40px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: '#0f172a', margin: 0, letterSpacing: '-0.02em', fontFamily: "'Playfair Display', Georgia, serif" }}>Lernmaterial</h1>
          <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3 }}>{total} Artikel im Bestand</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!selectedKategorie && (
            <Btn kind="secondary" accent={accent} icon="plus" onClick={() => setShowKategorieCreate(true)}>Kategorie anlegen</Btn>
          )}
          <Btn kind="secondary" accent={accent} icon="download" onClick={() => setShowCsvImport(true)}>CSV importieren</Btn>
          <Btn kind="primary" accent={accent} icon="plus" onClick={() => setShowCreate(true)}>Material anlegen</Btn>
        </div>
      </div>

      {!selectedKategorie ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 10 }}>
          {kategorien.map(kat => {
            const hue = kategorieHue(kat);
            const count = items.filter(i => i.kategorie === kat).length;
            return (
              <div key={kat} style={{ position: 'relative' }}
                onMouseEnter={e => { const btns = e.currentTarget.querySelector('.kat-actions'); if (btns) btns.style.opacity = '1'; }}
                onMouseLeave={e => { const btns = e.currentTarget.querySelector('.kat-actions'); if (btns) btns.style.opacity = '0'; }}
              >
                <button onClick={() => { setSelectedKategorie(kat); setQuery(''); }} style={{
                  width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  padding: '14px 14px 12px', background: '#fff',
                  border: '1px solid #e8ecef', borderRadius: 12,
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                  opacity: count === 0 ? 0.4 : 1,
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 8, marginBottom: 10,
                    background: `oklch(0.94 0.04 ${hue})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: `oklch(0.40 0.10 ${hue})`,
                    border: '1px solid rgba(0,0,0,.06)',
                  }}>
                    <Icon name={kategorieIcon(kat)} size={17} stroke={1.75} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', lineHeight: 1.3 }}>{kat}</div>
                  <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 3 }}>{count} Artikel</div>
                </button>
                <div className="kat-actions" style={{
                  position: 'absolute', top: 6, right: 6,
                  display: 'flex', gap: 2, opacity: 0,
                  transition: 'opacity 0.15s',
                }}>
                  <button onClick={e => { e.stopPropagation(); setEditingKategorie(kat); }} title="Umbenennen" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, color: '#64748b', cursor: 'pointer', padding: '3px 5px', display: 'flex' }}>
                    <Icon name="edit" size={12} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); deleteKategorie(kat); }} title="Entfernen" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, color: '#ef4444', cursor: 'pointer', padding: '3px 5px', display: 'flex' }}>
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
            <button onClick={() => { setSelectedKategorie(null); setQuery(''); }} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
              color: '#475569', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
              padding: '6px 12px', fontWeight: 500,
            }}>
              <Icon name="chevron-left" size={14} /> Zurück
            </button>
            <span style={{ fontSize: 13, color: '#94a3b8' }}>Lernmaterial</span>
            <span style={{ color: '#cbd5e1' }}>·</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{selectedKategorie}</span>
          </div>

          <div style={{ marginBottom: 14 }}>
            <SearchInput value={query} onChange={setQuery} placeholder={`Suchen in ${selectedKategorie} …`} />
          </div>

          <div style={{ background: '#fff', border: '1px solid #e8ecef', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 100px 120px 64px', gap: 12, padding: '10px 16px', borderBottom: '1px solid #f1f5f9', background: '#fbfcfd', fontSize: 10.5, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              <div></div><div>Bezeichnung</div><div style={{ textAlign: 'right' }}>Preis</div><div style={{ textAlign: 'right' }}>Bestand</div><div></div>
            </div>
            {kategorieItems.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                {query ? 'Keine passenden Artikel gefunden.' : 'Noch kein Material in dieser Kategorie.'}
              </div>
            ) : kategorieItems.map((item, i) => <ItemRow key={item.id} item={item} index={i} />)}
          </div>
        </>
      )}

      {showCsvImport && <LernmaterialCsvImportDialog accent={accent} onClose={() => setShowCsvImport(false)} onImported={() => { setShowCsvImport(false); fetchAll(); }} />}
      {showCreate && <LernmaterialCreateDialog accent={accent} kategorien={kategorien} onClose={() => setShowCreate(false)} onSave={addItem} />}
      {editingItem && <LernmaterialEditDialog accent={accent} item={editingItem} kategorien={kategorien} onClose={() => setEditingItem(null)} onSave={data => saveItem(editingItem.id, data)} />}
      {showKategorieCreate && <KategorieCreateDialog accent={accent} kategorien={kategorien} onClose={() => setShowKategorieCreate(false)} onSave={addKategorie} />}
      {editingKategorie && <KategorieEditDialog accent={accent} kategorie={editingKategorie} kategorien={kategorien} onClose={() => setEditingKategorie(null)} onSave={neu => renameKategorie(editingKategorie, neu)} />}
      {confirmDelete && (
        <ConfirmDialog
          title="Lernmaterial entfernen?"
          body={<span>Möchten Sie <strong>{confirmDelete.name}</strong> ({confirmDelete.id}) wirklich entfernen?</span>}
          confirmLabel="Endgültig entfernen"
          accent={accent}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => removeItem(confirmDelete.id)}
        />
      )}
    </div>
  );
};
