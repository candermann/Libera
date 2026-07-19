// Sidebar / Topbar layout shells

// ── Offene Vorgänge (Buchausgabe/-rückgabe Entwürfe) ──────────────────────
const VORGANG_DRAFT_KEY = 'bibliomat_vorgang_entwuerfe';
const VORGANG_FLOW_LABELS = {
  buchausgabe: 'Ausgabe',
  buchruckgabe: 'Rückgabe',
  'ausgabe-rueckgabe': 'Ausgabe/Rückgabe',
};

function _ladeVorgangEntwuerfe() {
  try {
    const raw = sessionStorage.getItem(VORGANG_DRAFT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_e) {
    return {};
  }
}

function _schreibeVorgangEntwuerfe(all) {
  try {
    sessionStorage.setItem(VORGANG_DRAFT_KEY, JSON.stringify(all));
  } catch (_e) {
    // sessionStorage voll oder deaktiviert - Entwurf wird dann einfach nicht gesichert
  }
  window.dispatchEvent(new Event('vorgang-entwurf-updated'));
}

window.vorgangEntwuerfe = {
  _key(flow, schuelerId) { return flow + ':' + schuelerId; },
  list() {
    return Object.values(_ladeVorgangEntwuerfe()).sort((a, b) => b.updated_at - a.updated_at);
  },
  get(flow, schuelerId) {
    return _ladeVorgangEntwuerfe()[this._key(flow, schuelerId)] || null;
  },
  save(flow, schueler, state) {
    const all = _ladeVorgangEntwuerfe();
    all[this._key(flow, schueler.id)] = {
      flow,
      schueler: { id: schueler.id, vorname: schueler.vorname, nachname: schueler.nachname, klasse: schueler.klasse },
      updated_at: Date.now(),
      state,
    };
    _schreibeVorgangEntwuerfe(all);
  },
  remove(flow, schuelerId) {
    const all = _ladeVorgangEntwuerfe();
    const key = this._key(flow, schuelerId);
    if (all[key]) {
      delete all[key];
      _schreibeVorgangEntwuerfe(all);
    }
  },
};

function vorgangZeitLabel(ts) {
  const diffMin = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (diffMin < 1) return 'gerade eben';
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  const diffStd = Math.round(diffMin / 60);
  if (diffStd < 24) return `vor ${diffStd} Std.`;
  return `vor ${Math.round(diffStd / 24)} Tg.`;
}

function OffeneVorgaengeListe({ entwuerfe, onSelect }) {
  if (!entwuerfe || entwuerfe.length === 0) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#b45309', marginBottom: 6 }}>
        Offene Vorgänge
      </div>
      <div style={{ background: '#fff7ed', border: '1px solid #fde8c9', borderRadius: 10, overflow: 'hidden' }}>
        {entwuerfe.map((entwurf, i) => (
          <div key={entwurf.schueler.id} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            borderTop: i === 0 ? 'none' : '1px solid #fde8c9',
          }}>
            <button
              onClick={() => onSelect(entwurf.schueler)}
              style={{
                flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', background: 'transparent', border: 'none',
                cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
              }}
            >
              <Avatar name={entwurf.schueler.vorname + ' ' + entwurf.schueler.nachname} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a', letterSpacing: '-0.005em' }}>
                  {entwurf.schueler.nachname}, {entwurf.schueler.vorname}
                </div>
                <div style={{ fontSize: 11, color: '#b45309', marginTop: 1 }}>
                  Fortsetzen · {vorgangZeitLabel(entwurf.updated_at)}
                </div>
              </div>
              <Icon name="arrow-right" size={14} style={{ color: '#b45309', flexShrink: 0 }} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); window.vorgangEntwuerfe.remove(entwurf.flow, entwurf.schueler.id); }}
              title="Entwurf verwerfen"
              style={{ background: 'transparent', border: 'none', color: '#b45309', cursor: 'pointer', padding: '8px 10px', display: 'flex' }}
            >
              <Icon name="x" size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const NAV_ITEMS = [
  { id: 'start', label: 'Start', icon: 'home' },
  { id: 'ausgabe-rueckgabe', label: 'Ausgabe & Rückgabe', icon: 'refresh-cw' },
  { id: 'buchausgabe', label: 'Buchausgabe', icon: 'cart' },
  { id: 'buchruckgabe', label: 'Buchrückgabe', icon: 'return' },
  { id: 'schueler', label: 'Schüler', icon: 'users' },
  { id: 'buecher', label: 'Bücher', icon: 'book' },
  { id: 'lernmaterial', label: 'Lernmaterial', icon: 'package' },
  { id: 'buchhaltung', label: 'Buchhaltung', icon: 'euro' },
  { id: 'klassenversetzung', label: 'Klassenversetzung', icon: 'arrow-right' },
  { id: 'schuelerarchiv', label: 'Schülerarchiv', icon: 'archive' },
  { id: 'einstellungen', label: 'Einstellungen', icon: 'settings' },
];

function useSchuljahr() {
  const [sj, setSj] = React.useState(null);
  React.useEffect(() => {
    window.api.einstellungen.get().then(e => {
      const raw = e.schuljahr_aktuell;
      if (!raw) return;
      const parts = raw.split('/');
      const startYear = parts[0].trim();
      const endYear = (parts[1] || '').trim();
      setSj({
        label: startYear + ' / ' + endYear,
        short: startYear + '/' + endYear.slice(-2),
        startDate: '01. Aug. ' + startYear,
      });
    }).catch(console.error);
  }, []);
  return sj;
}

function getUserLabel(username) {
  const value = String(username || '').trim();
  return value || 'Benutzer';
}

function getUserInitials(username) {
  const parts = String(username || '')
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (parts.length === 0) return 'BE';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return parts.slice(0, 2).map(part => part[0]).join('').toUpperCase();
}

function useVorgangEntwuerfe() {
  const [entwuerfe, setEntwuerfe] = React.useState([]);
  React.useEffect(() => {
    const refresh = () => setEntwuerfe(window.vorgangEntwuerfe.list());
    refresh();
    window.addEventListener('vorgang-entwurf-updated', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('vorgang-entwurf-updated', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  return entwuerfe;
}

function Sidebar({ current, onNav, accent, currentUser }) {
  const sjFromApi = useSchuljahr();
  const now = new Date();
  const y = now.getFullYear();
  const fallbackYear = now.getMonth() < 7 ? y - 1 : y;
  const sjFallback = { label: fallbackYear + ' / ' + (fallbackYear + 1), short: fallbackYear + '/' + String(fallbackYear + 1).slice(-2), startDate: '01. Aug. ' + fallbackYear };
  const sj = sjFromApi || sjFallback;
  const userLabel = getUserLabel(currentUser);
  const userInitials = getUserInitials(currentUser);
  const handleLogout = async () => {
    try {
      await window.api.auth.logout();
    } catch (_error) {
      // Keep the UI logout path working even if the network request fails.
    } finally {
      window.dispatchEvent(new Event('unauthorized'));
    }
  };
  return (
    <aside style={{
      width: 220, flexShrink: 0,
      background: 'linear-gradient(175deg, #eef3ff 0%, #f8fafc 55%)',
      borderRight: '1px solid #e8ecef',
      display: 'flex', flexDirection: 'column',
      padding: '16px 12px',
    }}>
      <div style={{ padding: '4px 8px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: '#fff', color: accent,
          border: '1px solid #dbe3ea',
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
        }}>
          <img src="/logo.svg" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z"/><path d="M4 17a3 3 0 0 1 3-3h11"/></svg>'; }} />
        </div>
        <div style={{ fontSize: 20, fontWeight: 600, color: '#0f172a', fontFamily: "'Playfair Display', Georgia, serif", letterSpacing: '-0.01em', lineHeight: 1 }}>Bibliomat</div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {NAV_ITEMS.map(item => {
          const active = current === item.id;
          return (
            <button key={item.id} onClick={() => onNav(item.id)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 10px', borderRadius: 7,
              background: active ? accent : 'transparent',
              border: '1px solid transparent',
              boxShadow: active ? '0 2px 6px rgba(15,23,42,0.12)' : 'none',
              color: active ? '#fff' : '#475569',
              fontSize: 13, fontWeight: active ? 500 : 450,
              cursor: 'pointer', textAlign: 'left',
              fontFamily: 'inherit',
              letterSpacing: '-0.005em',
              transition: 'background .12s, color .12s',
            }}>
              <span style={{ color: active ? '#fff' : '#94a3b8', display: 'flex' }}>
                <Icon name={item.icon} size={16} stroke={1.75} />
              </span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge ? (
                <span style={{
                  fontSize: 10.5, fontWeight: 600,
                  padding: '1px 6px', borderRadius: 999,
                  background: active ? '#fef2f2' : '#fef2f2',
                  color: '#b91c1c',
                }}>{item.badge}</span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div style={{ marginTop: 'auto', padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{
          padding: 10, borderRadius: 8,
          background: '#fff', border: '1px solid #e8ecef',
        }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em', color: '#94a3b8', textTransform: 'uppercase' }}>
            Schuljahr
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a', marginTop: 3, letterSpacing: '-0.005em' }}>
            {sj.label}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
            seit {sj.startDate}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 4px' }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: '#f1f5f9', color: '#475569',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10.5, fontWeight: 600,
          }}>{userInitials}</div>
          <div style={{ fontSize: 12, color: '#475569', flex: 1 }}>{userLabel}</div>
          <button onClick={handleLogout} style={{ display: 'flex', background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: 0 }} title="Abmelden">
            <Icon name="log-out" size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function Topbar({ current, onNav, accent, currentUser }) {
  const sjFromApi = useSchuljahr();
  const now = new Date();
  const y = now.getFullYear();
  const fallbackYear = now.getMonth() < 7 ? y - 1 : y;
  const sjFallback = { label: fallbackYear + ' / ' + (fallbackYear + 1), short: fallbackYear + '/' + String(fallbackYear + 1).slice(-2), startDate: '01. Aug. ' + fallbackYear };
  const sj = sjFromApi || sjFallback;
  const userInitials = getUserInitials(currentUser);
  const handleLogout = async () => {
    try {
      await window.api.auth.logout();
    } catch (_error) {
      // Keep the UI logout path working even if the network request fails.
    } finally {
      window.dispatchEvent(new Event('unauthorized'));
    }
  };
  return (
    <header style={{
      height: 52, flexShrink: 0,
      background: '#fff', borderBottom: '1px solid #e8ecef',
      display: 'flex', alignItems: 'center', padding: '0 20px',
      gap: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: '#fff', color: accent,
          border: '1px solid #dbe3ea',
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
        }}>
          <img src="/logo.svg" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z"/><path d="M4 17a3 3 0 0 1 3-3h11"/></svg>'; }} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#0f172a', fontFamily: "'Playfair Display', Georgia, serif", letterSpacing: '-0.01em', lineHeight: 1 }}>Bibliomat</div>
      </div>
      <nav style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {NAV_ITEMS.map(item => {
          const active = current === item.id;
          return (
            <button key={item.id} onClick={() => onNav(item.id)} style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '6px 11px', borderRadius: 7,
              background: active ? '#f1f5f9' : 'transparent',
              border: 'none',
              color: active ? '#0f172a' : '#64748b',
              fontSize: 13, fontWeight: active ? 500 : 450,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}>
              <Icon name={item.icon} size={14} />
              {item.label}
              {item.badge ? (
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  padding: '0 5px', borderRadius: 999,
                  background: '#fef2f2', color: '#b91c1c',
                  marginLeft: 1,
                }}>{item.badge}</span>
              ) : null}
            </button>
          );
        })}
      </nav>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>Schuljahr {sj.short}</div>
        <div style={{
          width: 26, height: 26, borderRadius: '50%',
          background: '#f1f5f9', color: '#475569',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 600,
        }}>{userInitials}</div>
        <button onClick={handleLogout} style={{ display: 'flex', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }} title="Abmelden">
          <Icon name="log-out" size={14} />
        </button>
      </div>
    </header>
  );
}

window.Sidebar = Sidebar;
window.Topbar = Topbar;
window.NAV_ITEMS = NAV_ITEMS;
