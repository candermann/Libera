// Shared icons and small UI primitives

const Icon = ({ name, size = 16, stroke = 1.75 }) => {
  const s = size;
  const props = { width: s, height: s, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case 'home': return <svg {...props}><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>;
    case 'cart': return <svg {...props}><circle cx="9" cy="20" r="1.2"/><circle cx="18" cy="20" r="1.2"/><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.4a2 2 0 0 0 2-1.5L21 8H6"/></svg>;
    case 'return': return <svg {...props}><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 5 5v6"/></svg>;
    case 'refresh-cw': return <svg {...props}><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>;
    case 'users': return <svg {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    case 'book': return <svg {...props}><path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z"/><path d="M4 17a3 3 0 0 1 3-3h11"/></svg>;
    case 'alert': return <svg {...props}><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/></svg>;
    case 'search': return <svg {...props}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>;
    case 'plus': return <svg {...props}><path d="M12 5v14M5 12h14"/></svg>;
    case 'check': return <svg {...props}><path d="m5 12 5 5L20 7"/></svg>;
    case 'x': return <svg {...props}><path d="M18 6 6 18M6 6l12 12"/></svg>;
    case 'arrow-right': return <svg {...props}><path d="M5 12h14M13 5l7 7-7 7"/></svg>;
    case 'arrow-left': return <svg {...props}><path d="M19 12H5M11 5l-7 7 7 7"/></svg>;
    case 'chevron-right': return <svg {...props}><path d="m9 6 6 6-6 6"/></svg>;
    case 'chevron-down': return <svg {...props}><path d="m6 9 6 6 6-6"/></svg>;
    case 'invoice': return <svg {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h8M8 9h2"/></svg>;
    case 'printer': return <svg {...props}><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>;
    case 'trash': return <svg {...props}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>;
    case 'edit': return <svg {...props}><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>;
    case 'filter': return <svg {...props}><path d="M3 5h18M6 12h12M10 19h4"/></svg>;
    case 'download': return <svg {...props}><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>;
    case 'mail': return <svg {...props}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>;
    case 'log-out': return <svg {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
    case 'euro': return <svg {...props}><path d="M18 7a6 6 0 1 0 0 10"/><path d="M3 11h10M3 15h10"/></svg>;
    case 'calendar': return <svg {...props}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>;
    case 'circle': return <svg {...props}><circle cx="12" cy="12" r="9"/></svg>;
    case 'list': return <svg {...props}><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r=".5"/><circle cx="4" cy="12" r=".5"/><circle cx="4" cy="18" r=".5"/></svg>;
    case 'settings': return <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>;
    case 'sparkle': return <svg {...props}><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6 7.7 7.7M16.3 16.3l2.1 2.1M5.6 18.4 7.7 16.3M16.3 7.7l2.1-2.1"/></svg>;
    case 'archive': return <svg {...props}><rect x="2" y="4" width="20" height="5" rx="1.5"/><path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/><path d="M10 13h4"/></svg>;
    case 'package': return <svg {...props}><path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/></svg>;
    case 'bell': return <svg {...props}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>;
    case 'check-circle': return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="m9 12 2 2 4-4"/></svg>;
    case 'trash-2': return <svg {...props}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>;
    case 'folder': return <svg {...props}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>;
    case 'calculator': return <svg {...props}><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="11" x2="11" y2="11"/><line x1="13" y1="11" x2="16" y2="11"/><line x1="8" y1="13" x2="11" y2="13"/><line x1="13" y1="13" x2="16" y2="13"/><line x1="8" y1="15" x2="11" y2="15"/><line x1="13" y1="15" x2="16" y2="15"/><line x1="8" y1="17" x2="11" y2="17"/><line x1="13" y1="17" x2="16" y2="17"/></svg>;
    case 'ruler': return <svg {...props}><path d="M21.3 8.7 8.7 21.3c-1 1-2.5 1-3.4 0l-2.6-2.6c-1-1-1-2.5 0-3.4L15.3 2.7c1-1 2.5-1 3.4 0l2.6 2.6c1 1 1 2.5 0 3.4z"/><path d="m7.5 10.5 2 2m1-5 2 2m1-5 2 2m-8 8 2 2"/></svg>;
    case 'compass': return <svg {...props}><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>;
    case 'pen': return <svg {...props}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>;
    default: return null;
  }
};

const Avatar = ({ name, size = 32 }) => {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();
  // Stable color hash
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `oklch(0.92 0.04 ${hue})`,
      color: `oklch(0.40 0.08 ${hue})`,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 600, flexShrink: 0,
    }}>{initials}</div>
  );
};

const Badge = ({ tone = 'slate', children, dot = false }) => {
  const tones = {
    slate:  { bg: '#f1f5f9', fg: '#475569', dot: '#94a3b8' },
    blue:   { bg: '#eff6ff', fg: '#1d4ed8', dot: '#3b82f6' },
    green:  { bg: '#ecfdf5', fg: '#047857', dot: '#10b981' },
    amber:  { bg: '#fffbeb', fg: '#b45309', dot: '#f59e0b' },
    red:    { bg: '#fef2f2', fg: '#b91c1c', dot: '#ef4444' },
    violet: { bg: '#f5f3ff', fg: '#6d28d9', dot: '#8b5cf6' },
  };
  const t = tones[tone] || tones.slate;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '2px 8px', borderRadius: 999, background: t.bg, color: t.fg,
      fontSize: 11.5, fontWeight: 500, whiteSpace: 'nowrap',
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.dot }}/>}
      {children}
    </span>
  );
};

const Btn = ({ kind = 'secondary', children, icon, onClick, full, density = 'regular', accent = '#2563eb', disabled }) => {
  const padY = density === 'compact' ? 5 : (density === 'comfy' ? 9 : 7);
  const styles = {
    primary: { background: accent, color: '#fff', border: `1px solid ${accent}` },
    secondary: { background: '#fff', color: '#0f172a', border: '1px solid #e2e8f0' },
    ghost: { background: 'transparent', color: '#475569', border: '1px solid transparent' },
    danger: { background: '#fff', color: '#b91c1c', border: '1px solid #fecaca' },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...styles[kind],
      padding: `${padY}px 12px`,
      borderRadius: 7,
      fontSize: 13, fontWeight: 500,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      cursor: disabled ? 'not-allowed' : 'pointer',
      width: full ? '100%' : 'auto',
      opacity: disabled ? 0.5 : 1,
      transition: 'all .12s',
      fontFamily: 'inherit',
      letterSpacing: '-0.005em',
    }}>
      {icon && <Icon name={icon} size={14}/>}
      {children}
    </button>
  );
};

const Card = ({ children, padding = 16, style = {} }) => (
  <div style={{
    background: '#fff',
    border: '1px solid #e8ecef',
    borderRadius: 10,
    padding,
    ...style,
  }}>{children}</div>
);

const SearchInput = ({ value, onChange, placeholder = 'Suchen…', autoFocus, kbd }) => (
  <div style={{ position: 'relative' }}>
    <div style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex' }}>
      <Icon name="search" size={15}/>
    </div>
    <input
      autoFocus={autoFocus}
      value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%', padding: '8px 12px 8px 34px',
        border: '1px solid #e2e8f0', borderRadius: 8,
        background: '#fff',
        fontSize: 13.5, fontFamily: 'inherit', outline: 'none',
        color: '#0f172a',
      }}
    />
    {kbd && <kbd style={{
      position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
      fontSize: 10.5, color: '#94a3b8', background: '#f8fafc', border: '1px solid #e2e8f0',
      padding: '2px 6px', borderRadius: 4, fontFamily: 'inherit',
    }}>{kbd}</kbd>}
  </div>
);

const Money = ({ value, mono = true }) => {
  const formatted = (value || 0).toFixed(2).replace('.', ',') + ' €';
  return <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: mono ? 'JetBrains Mono, ui-monospace, monospace' : 'inherit' }}>{formatted}</span>;
};

const _toastListeners = [];

window.showToast = function(type, message, duration = 3500) {
  const id = Date.now() + Math.random();
  _toastListeners.forEach(fn => fn({ id, type, message, duration }));
};

function ToastItem({ toast, onRemove }) {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onRemove, 250);
    }, toast.duration);
    return () => clearTimeout(t);
  }, []);

  const colors = {
    success: { bg: '#f0fdf4', border: '#bbf7d0', icon: '#16a34a', text: '#15803d' },
    error:   { bg: '#fef2f2', border: '#fecaca', icon: '#dc2626', text: '#b91c1c' },
    info:    { bg: '#eff6ff', border: '#bfdbfe', icon: '#2563eb', text: '#1d4ed8' },
  };
  const c = colors[toast.type] || colors.info;
  const iconName = toast.type === 'success' ? 'check' : toast.type === 'error' ? 'alert' : 'circle';

  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10,
      padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 4px 16px rgba(15,23,42,0.10)',
      minWidth: 220, maxWidth: 360, fontSize: 13, color: c.text, fontWeight: 500,
      transform: visible ? 'translateY(0)' : 'translateY(12px)',
      opacity: visible ? 1 : 0,
      transition: 'transform 0.22s ease, opacity 0.22s ease',
      pointerEvents: 'all',
    }}>
      <span style={{ color: c.icon, flexShrink: 0, display: 'flex' }}>
        <Icon name={iconName} size={15} />
      </span>
      {toast.message}
    </div>
  );
}

function ToastContainer() {
  const [toasts, setToasts] = React.useState([]);

  React.useEffect(() => {
    const handler = (toast) => setToasts(prev => [...prev, toast]);
    _toastListeners.push(handler);
    return () => {
      const idx = _toastListeners.indexOf(handler);
      if (idx > -1) _toastListeners.splice(idx, 1);
    };
  }, []);

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8,
      pointerEvents: 'none',
    }}>
      {toasts.map(toast => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onRemove={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
        />
      ))}
    </div>
  );
}

const _confirmListeners = [];

window.showConfirm = function({ message, detail, confirmLabel = 'Bestätigen', cancelLabel = 'Abbrechen', danger = false, onConfirm, onCancel }) {
  _confirmListeners.forEach(fn => fn({ message, detail, confirmLabel, cancelLabel, danger, onConfirm, onCancel }));
};

function GlobalConfirmDialog() {
  const [state, setState] = React.useState(null);

  React.useEffect(() => {
    const handler = (opts) => setState(opts);
    _confirmListeners.push(handler);
    return () => {
      const idx = _confirmListeners.indexOf(handler);
      if (idx > -1) _confirmListeners.splice(idx, 1);
    };
  }, []);

  if (!state) return null;

  const handleConfirm = () => { const cb = state.onConfirm; setState(null); cb?.(); };
  const handleCancel  = () => { const cb = state.onCancel;  setState(null); cb?.(); };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={handleCancel}>
      <div style={{ background: '#fff', borderRadius: 14, padding: '24px 28px', maxWidth: 420, width: '90%', boxShadow: '0 20px 60px rgba(15,23,42,0.18)' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginBottom: state.detail ? 8 : 24, lineHeight: 1.4 }}>{state.message}</div>
        {state.detail && <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24, lineHeight: 1.6 }}>{state.detail}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={handleCancel} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
            {state.cancelLabel}
          </button>
          <button onClick={handleConfirm} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: state.danger ? '#b91c1c' : '#0f172a', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Icon, Avatar, Badge, Btn, Card, SearchInput, Money, ToastContainer, GlobalConfirmDialog });
