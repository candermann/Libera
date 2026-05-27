var { useState } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#2563eb",
  "density": "regular"
}/*EDITMODE-END*/;

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const initialRoute = (() => {
    const id = (window.location.hash || '').replace(/^#/, '');
    return window.NAV_ITEMS?.some(item => item.id === id) ? id : 'home';
  })();
  const [current, setCurrent] = useState(initialRoute);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [navContext, setNavContext] = useState(null);
  const [t, setTweak] = window.useTweaks ? window.useTweaks(TWEAK_DEFAULTS) : [TWEAK_DEFAULTS, () => {}];

  React.useEffect(() => {
    const handleUnauthorized = () => {
      localStorage.removeItem('token');
      setSelectedStudent(null);
      setNavContext(null);
      setIsAuthenticated(false);
    };
    window.addEventListener('unauthorized', handleUnauthorized);
    return () => window.removeEventListener('unauthorized', handleUnauthorized);
  }, []);

  React.useEffect(() => {
    const initialState = history.state && history.state.app === 'bibliomat'
      ? history.state
      : { app: 'bibliomat', current, selectedStudent: null, navContext: null };
    history.replaceState(initialState, '', `#${initialState.current || current}`);

    const handlePopState = (event) => {
      const state = event.state;
      if (!state || state.app !== 'bibliomat') {
        const id = (window.location.hash || '').replace(/^#/, '');
        setCurrent(window.NAV_ITEMS?.some(item => item.id === id) ? id : 'home');
        setSelectedStudent(null);
        setNavContext(null);
        return;
      }

      setCurrent(state.current || 'home');
      setSelectedStudent(state.selectedStudent || null);
      setNavContext(state.navContext || null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (!isAuthenticated) {
    return <window.Login onLogin={() => setIsAuthenticated(true)} accent={t.accent} />;
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
      case 'home': content = <window.Home onNav={handleNav} onOpenStudent={handleOpenStudent} accent={t.accent} density={t.density} />; break;
      case 'verkauf': content = <window.Verkauf accent={t.accent} density={t.density} onDone={() => handleNav('home')} preselectedStudent={navContext} />; break;
      case 'rueckgabe': content = <window.Rueckgabe accent={t.accent} onDone={() => handleNav('home')} preselectedStudent={navContext} />; break;
      case 'kombiniert': content = <window.KombiniertFlow accent={t.accent} density={t.density} onDone={() => handleNav('home')} preselectedStudent={navContext} />; break;
      case 'schueler': content = <window.SchuelerListe accent={t.accent} onOpenStudent={handleOpenStudent} />; break;
      case 'buecher': content = <window.BuecherListe accent={t.accent} />; break;
      case 'lernmaterial': content = <window.LernmaterialListe accent={t.accent} />; break;
      case 'buchhaltung': content = <window.Buchhaltung accent={t.accent} />; break;
      case 'klassenversetzung': content = <window.Klassenversetzung accent={t.accent} />; break;
      case 'archiv': content = <window.Archiv accent={t.accent} onOpenStudent={handleOpenStudent} />; break;
      case 'profil': content = <window.Profil accent={t.accent} />; break;
      default: content = <window.Home onNav={handleNav} accent={t.accent} />; break;
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <window.Sidebar current={selectedStudent ? null : current} onNav={handleNav} accent={t.accent} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {content}
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
