var { useState } = React;

window.Login = function Login({ onLogin, accent = '#2563eb' }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await window.api.auth.login(username, password);
      localStorage.setItem('token', data.access_token);
      onLogin();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'linear-gradient(145deg, #eef3ff 0%, #e8f0ff 45%, #f0f4ff 100%)',
    }}>
      <div style={{
        background: '#fff',
        padding: '44px 40px 40px',
        borderRadius: 22,
        boxShadow: '0 24px 64px rgba(15,23,42,0.10), 0 4px 16px rgba(15,23,42,0.06)',
        width: '100%',
        maxWidth: 380,
      }}>

        {/* Branding */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 88, height: 88,
            borderRadius: 20,
            background: '#fff',
            border: '1px solid #dbe3ea',
            marginBottom: 18,
            overflow: 'hidden',
            boxShadow: '0 2px 10px rgba(15,23,42,0.09)',
          }}>
            <img
              src="/logo.svg"
              alt="Bibliomat"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.innerHTML = '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="1.5"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>'; }}
            />
          </div>
          <h1 style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 600,
            color: '#0f172a',
            fontFamily: "'Playfair Display', Georgia, serif",
            letterSpacing: '-0.01em',
            lineHeight: 1.1,
          }}>Bibliomat</h1>
          <p style={{ margin: '8px 0 0', color: '#94a3b8', fontSize: 13.5, letterSpacing: '0.01em' }}>
            Schulbuchverwaltungssoftware
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && (
            <div style={{
              padding: '10px 14px',
              background: '#fef2f2',
              color: '#991b1b',
              borderRadius: 10,
              fontSize: 13,
              border: '1px solid #fecaca',
            }}>
              {error}
            </div>
          )}

          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12.5, fontWeight: 600, color: '#475569', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
              Benutzername
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 13px',
                borderRadius: 10,
                border: '1px solid #e2e8f0',
                fontSize: 14,
                fontFamily: 'inherit',
                color: '#0f172a',
                background: '#f8fafc',
                outline: 'none',
                transition: 'border-color 0.15s, box-shadow 0.15s',
                boxSizing: 'border-box',
              }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12.5, fontWeight: 600, color: '#475569', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
              Passwort
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 13px',
                borderRadius: 10,
                border: '1px solid #e2e8f0',
                fontSize: 14,
                fontFamily: 'inherit',
                color: '#0f172a',
                background: '#f8fafc',
                outline: 'none',
                transition: 'border-color 0.15s, box-shadow 0.15s',
                boxSizing: 'border-box',
              }}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 8,
              padding: '11px',
              background: accent,
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'opacity 0.15s, transform 0.1s',
              letterSpacing: '0.01em',
            }}
            onMouseDown={e => { if (!loading) e.currentTarget.style.transform = 'scale(0.98)'; }}
            onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            {loading ? 'Wird angemeldet…' : 'Anmelden'}
          </button>
        </form>
      </div>
    </div>
  );
};
