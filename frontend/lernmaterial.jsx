// Lernmaterial-Verwaltung (Anlegen, Bearbeiten, Löschen)

function LernmaterialCreateDialog({ accent, onClose, onSave }) {
  const kategorien = (window.CONSTANTS && window.CONSTANTS.LERNMATERIAL_KATEGORIEN) || [];
  const [name, setName] = React.useState('');
  const [kategorie, setKategorie] = React.useState(kategorien[0] || '');
  const [preis, setPreis] = React.useState('');
  const [bestand, setBestand] = React.useState('');
  const valid = name.trim() && kategorie && preis;

  const fieldStyle = {
    width: '100%', padding: '8px 11px',
    border: '1px solid #e2e8f0', borderRadius: 7,
    fontSize: 13.5, fontFamily: 'inherit', color: '#0f172a',
    background: '#fff', outline: 'none',
  };
  const labelStyle = { fontSize: 11.5, color: '#475569', fontWeight: 500, marginBottom: 5, display: 'block' };

  return (
    <Modal onClose={onClose} width={480}>
      <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.01em' }}>Lernmaterial anlegen</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Neues Material in den Bestand aufnehmen.</div>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', padding: 4 }}>
          <Icon name="x" size={18} />
        </button>
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
        <Btn kind="primary" accent={accent} icon="check" disabled={!valid} onClick={() => onSave({ name, kategorie, preis, bestand })}>
          Anlegen
        </Btn>
      </div>
    </Modal>
  );
}

function LernmaterialEditDialog({ accent, item, onClose, onSave }) {
  const kategorien = (window.CONSTANTS && window.CONSTANTS.LERNMATERIAL_KATEGORIEN) || [];
  const [name, setName] = React.useState(item.name || '');
  const [kategorie, setKategorie] = React.useState(item.kategorie || (kategorien[0] || ''));
  const [preis, setPreis] = React.useState(item.preis_cents ? (item.preis_cents / 100).toFixed(2) : '');
  const [bestand, setBestand] = React.useState(item.bestand_gesamt != null ? String(item.bestand_gesamt) : '');
  const valid = name.trim() && kategorie && preis;

  const fieldStyle = {
    width: '100%', padding: '8px 11px',
    border: '1px solid #e2e8f0', borderRadius: 7,
    fontSize: 13.5, fontFamily: 'inherit', color: '#0f172a',
    background: '#fff', outline: 'none',
  };
  const labelStyle = { fontSize: 11.5, color: '#475569', fontWeight: 500, marginBottom: 5, display: 'block' };

  return (
    <Modal onClose={onClose} width={480}>
      <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.01em' }}>Lernmaterial bearbeiten</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{item.id}</div>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', padding: 4 }}>
          <Icon name="x" size={18} />
        </button>
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
        <Btn kind="primary" accent={accent} icon="check" disabled={!valid} onClick={() => onSave({ name, kategorie, preis, bestand })}>
          Speichern
        </Btn>
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

  function fetchAll() {
    window.api.lernmaterial.list({}).then(res => {
      setItems(res.items || []);
      setTotal(res.total || 0);
    }).catch(err => { console.error(err); setItems([]); setTotal(0); });
  }

  React.useEffect(() => { fetchAll(); }, []);

  const kategorien = React.useMemo(() => {
    const fromItems = items.map(i => i.kategorie).filter(Boolean);
    const merged = Array.from(new Set(konstantKategorien.concat(fromItems)));
    merged.sort((a, b) => a.localeCompare(b, 'de'));
    return merged;
  }, [items]);

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
        <Btn kind="primary" accent={accent} icon="plus" onClick={() => setShowCreate(true)}>Material anlegen</Btn>
      </div>

      {!selectedKategorie ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 10 }}>
          {kategorien.map(kat => {
            const hue = kategorieHue(kat);
            const count = items.filter(i => i.kategorie === kat).length;
            return (
              <button key={kat} onClick={() => { setSelectedKategorie(kat); setQuery(''); }} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
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

      {showCreate && <LernmaterialCreateDialog accent={accent} onClose={() => setShowCreate(false)} onSave={addItem} />}
      {editingItem && <LernmaterialEditDialog accent={accent} item={editingItem} onClose={() => setEditingItem(null)} onSave={data => saveItem(editingItem.id, data)} />}
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
