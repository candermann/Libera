var { useState } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#2563eb",
  "density": "regular"
}/*EDITMODE-END*/;

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const initialRoute = (() => {
    const id = (window.location.hash || '').replace(/^#/, '');
    return window.NAV_ITEMS?.some(item => item.id === id) ? id : 'start';
  })();
  const [current, setCurrent] = useState(initialRoute);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [navContext, setNavContext] = useState(null);
  const [navKey, setNavKey] = useState(0);
  const [t, setTweak] = window.useTweaks ? window.useTweaks(TWEAK_DEFAULTS) : [TWEAK_DEFAULTS, () => {}];

  React.useEffect(() => {
    const handleUnauthorized = () => {
      setIsAuthenticated(false);
      setCurrentUser(null);
    };
    window.addEventListener('unauthorized', handleUnauthorized);
    return () => window.removeEventListener('unauthorized', handleUnauthorized);
  }, []);

  const refreshSession = React.useCallback(async () => {
    const session = await window.api.auth.me();
    setCurrentUser(session?.username || null);
    setIsAuthenticated(true);
    return session;
  }, []);

  React.useEffect(() => {
    let alive = true;
    refreshSession()
      .then(() => {
        if (!alive) return;
      })
      .catch(() => {
        if (!alive) return;
        setIsAuthenticated(false);
        setCurrentUser(null);
      })
      .finally(() => {
        if (!alive) return;
        setAuthLoading(false);
      });
    return () => { alive = false; };
  }, [refreshSession]);

  React.useEffect(() => {
    const initialState = history.state && history.state.app === 'bibliomat'
      ? history.state
      : { app: 'bibliomat', current, selectedStudent: null, navContext: null };
    history.replaceState(initialState, '', `#${initialState.current || current}`);

    const handlePopState = (event) => {
      const state = event.state;
      if (!state || state.app !== 'bibliomat') {
        const id = (window.location.hash || '').replace(/^#/, '');
        setCurrent(window.NAV_ITEMS?.some(item => item.id === id) ? id : 'start');
        setSelectedStudent(null);
        setNavContext(null);
        return;
      }

      setCurrent(state.current || 'start');
      setSelectedStudent(state.selectedStudent || null);
      setNavContext(state.navContext || null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  React.useEffect(() => {
    const labels = {
      home: 'Übersicht',
      buchausgabe: 'Buchausgabe',
      buchruckgabe: 'Buchrückgabe',
      'ausgabe-rueckgabe': 'Ausgabe & Rückgabe',
      schueler: 'Schüler',
      buecher: 'Bücher',
      lernmaterial: 'Lernmaterial',
      buchhaltung: 'Buchhaltung',
      klassenversetzung: 'Klassenversetzung',
      schuelerarchiv: 'Schülerarchiv',
      profil: 'Einstellungen',
      einstellungen: 'Einstellungen',
    };
    document.title = `Bibliomat – ${labels[current] || current}`;
  }, [current]);

  if (authLoading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#64748b', fontFamily: 'inherit' }}>Sitzung wird geladen…</div>;
  }

  if (!isAuthenticated) {
    return <window.Login onLogin={() => refreshSession()} accent={t.accent} />;
  }

  const commitRoute = (id, student = null, context = null, replace = false) => {
    setCurrent(id);
    setSelectedStudent(student);
    setNavContext(context);

    const state = { app: 'bibliomat', current: id, selectedStudent: student, navContext: context };
    const url = student ? `#${id}/detail/${encodeURIComponent(student.id || '')}` : `#${id}`;
    if (replace) {
      history.replaceState(state, '', url);
    } else {
      history.pushState(state, '', url);
    }
  };

  const handleNav = (id, context = null) => {
    setNavKey(k => k + 1);
    commitRoute(id, null, context);
  };

  const handleOpenStudent = (student) => {
    commitRoute('schueler', student, null);
  };

  let content;
  if (selectedStudent) {
    content = <window.SchuelerDetail schueler={selectedStudent} accent={t.accent} onBack={() => commitRoute('schueler', null, null)} onNav={handleNav} />;
  } else {
    switch (current) {
      case 'start': content = <window.Home onNav={handleNav} onOpenStudent={handleOpenStudent} accent={t.accent} density={t.density} />; break;
      case 'buchausgabe': content = <window.Verkauf accent={t.accent} density={t.density} onDone={() => handleNav('start')} preselectedStudent={navContext} />; break;
      case 'buchruckgabe': content = <window.Rueckgabe accent={t.accent} onDone={() => handleNav('start')} preselectedStudent={navContext} />; break;
      case 'ausgabe-rueckgabe': content = <window.KombiniertFlow accent={t.accent} density={t.density} onDone={() => handleNav('start')} preselectedStudent={navContext} />; break;
      case 'schueler': content = <window.SchuelerListe accent={t.accent} onOpenStudent={handleOpenStudent} />; break;
      case 'buecher': content = <window.BuecherListe accent={t.accent} />; break;
      case 'lernmaterial': content = <window.LernmaterialListe accent={t.accent} />; break;
      case 'buchhaltung': content = <window.Buchhaltung accent={t.accent} onNav={handleNav} />; break;
      case 'klassenversetzung': content = <window.Klassenversetzung accent={t.accent} />; break;
      case 'schuelerarchiv': content = <window.Archiv accent={t.accent} onOpenStudent={handleOpenStudent} />; break;
      case 'profil':
      case 'einstellungen': content = <window.Profil accent={t.accent} />; break;
      default: content = <window.Home onNav={handleNav} accent={t.accent} />; break;
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <window.Sidebar current={selectedStudent ? null : current} onNav={handleNav} accent={t.accent} currentUser={currentUser} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div key={navKey} style={{ flex: 1, overflowY: 'auto' }}>
          <window.ErrorBoundary key={current + '_' + navKey}>
            {content}
          </window.ErrorBoundary>
        </div>
      </div>
      
      {window.TweaksPanel && (
        <window.TweaksPanel>
          <window.TweakSection label="Theme" />
          <window.TweakColor label="Accent" value={t.accent} onChange={(v) => setTweak('accent', v)} />
          <window.TweakRadio label="Density" value={t.density} options={['compact', 'regular', 'comfy']} onChange={(v) => setTweak('density', v)} />
        </window.TweaksPanel>
      )}
      <window.ToastContainer />
      <window.GlobalConfirmDialog />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
