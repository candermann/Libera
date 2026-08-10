function Profil({ accent }) {
  const [currentUser, setCurrentUser] = React.useState(null);
  const [isAdmin, setIsAdmin] = React.useState(false);

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [activeTab, setActiveTab] = React.useState('schule');

  const [benutzerList, setBenutzerList] = React.useState([]);
  const [benutzerLoading, setBenutzerLoading] = React.useState(false);
  const [neuerBenutzername, setNeuerBenutzername] = React.useState('');
  const [neuesPasswort, setNeuesPasswort] = React.useState('');
  const [neueRolleAdmin, setNeueRolleAdmin] = React.useState(false);
  const [benutzerError, setBenutzerError] = React.useState(null);
  const [rolleChanging, setRolleChanging] = React.useState({});
  const [passwordChanging, setPasswordChanging] = React.useState({});
  const [pwInputs, setPwInputs] = React.useState({});
  const [adminPasswort, setAdminPasswort] = React.useState('');
  const [form, setForm] = React.useState({
    schule_name: '',
    schule_strasse: '',
    schule_plz: '',
    schule_ort: '',
    schule_telefon: '',
    schule_email: '',
    schulleiter_name: '',
    schule_iban: '',
    schule_bic: '',
    schule_bank: '',
    schuljahr_aktuell: '',
    schuljahr_naechster_beginn: '',
    versetzung_sperre_aktiv: 'true',
    mail_auth_method: 'smtp',
    mail_smtp_host: '',
    mail_smtp_port: '587',
    mail_smtp_username: '',
    mail_smtp_password: '',
    mail_smtp_password_set: 'false',
    mail_smtp_use_starttls: 'true',
    mail_smtp_use_ssl: 'false',
    mail_oauth2_tenant_id: '',
    mail_oauth2_client_id: '',
    mail_oauth2_client_secret: '',
    mail_oauth2_client_secret_set: 'false',
    mail_from_email: '',
    mail_from_name: '',
    mail_reply_to: '',
    mail_subject_template: '',
    mail_body_template: '',
    mail_signature_text: '',
    mail_signature_html: '',
  });

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    window.api.einstellungen.get()
      .then((data) => {
        if (!alive) return;
        setForm((prev) => ({
          ...prev,
          ...pickProfileFields(data || {}),
        }));
      })
      .catch((err) => {
        if (!alive) return;
        setError(err.message || 'Einstellungen konnten nicht geladen werden.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    window.api.auth.me()
      .then((session) => {
        if (!alive) return;
        setCurrentUser(session?.username || null);
        setIsAdmin(Boolean(session?.ist_admin));
      })
      .catch(() => {
        if (!alive) return;
        setCurrentUser(null);
        setIsAdmin(false);
      });

    return () => { alive = false; };
  }, []);

  React.useEffect(() => {
    if (activeTab !== 'konten' || !isAdmin) return;
    setBenutzerLoading(true);
    window.api.admin.benutzer.list()
      .then(setBenutzerList)
      .catch(e => setBenutzerError(e.message))
      .finally(() => setBenutzerLoading(false));
  }, [activeTab, isAdmin]);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = sanitizeForm(form);
      await window.api.einstellungen.update(payload);
      setSavedAt(new Date());
    } catch (err) {
      setError(err.message || 'Speichern fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 40, color: '#64748b' }}>Lade Einstellungen...</div>;
  }

  const fieldStyle = {
    width: '100%',
    padding: '9px 11px',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    background: '#fff',
    color: '#0f172a',
    fontSize: 13.5,
    fontFamily: 'inherit',
    outline: 'none',
  };
  const labelStyle = {
    fontSize: 11.5,
    color: '#475569',
    fontWeight: 500,
    marginBottom: 5,
    display: 'block',
  };
  const textAreaStyle = {
    ...fieldStyle,
    minHeight: 96,
    resize: 'vertical',
    lineHeight: 1.45,
    whiteSpace: 'pre-wrap',
  };
  const hintStyle = {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 3,
  };

  const TABS = [
    { id: 'schule', label: 'Schule' },
    { id: 'bank',   label: 'Bankdaten' },
    { id: 'email',  label: 'E-Mail-Konfiguration' },
    ...(isAdmin ? [{ id: 'konten', label: 'Konten' }, { id: 'system', label: 'System' }] : []),
    { id: 'info',   label: 'Info' },
  ];

  return (
    <div style={{ padding: '24px 40px', maxWidth: 760, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: '#0f172a', margin: 0, letterSpacing: '-0.02em', fontFamily: "'Playfair Display', Georgia, serif" }}>Einstellungen</h1>
          <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3 }}>
            Schuldaten, Bankverbindung und E-Mail-Versand konfigurieren.
          </div>
        </div>
        <Btn kind="primary" accent={accent} icon="check" onClick={save} disabled={saving || !isAdmin} title={!isAdmin ? 'Nur Administratoren können diese Einstellungen ändern.' : undefined}>
          {saving ? 'Speichern...' : 'Speichern'}
        </Btn>
      </div>

      {!isAdmin && (
        <div style={{
          marginBottom: 14, padding: '10px 12px',
          background: '#fffbeb', border: '1px solid #fde68a',
          color: '#92400e', borderRadius: 8, fontSize: 12.5,
        }}>
          Nur Administratoren können diese Einstellungen ändern. Du kannst sie hier einsehen, aber nicht speichern.
        </div>
      )}

      {/* Meldungen */}
      {error && (
        <div style={{
          marginBottom: 14, padding: '10px 12px',
          background: '#fef2f2', border: '1px solid #fecaca',
          color: '#b91c1c', borderRadius: 8, fontSize: 12.5,
        }}>
          {error}
        </div>
      )}
      {savedAt && (
        <div style={{
          marginBottom: 14, padding: '10px 12px',
          background: '#ecfdf5', border: '1px solid #a7f3d0',
          color: '#047857', borderRadius: 8, fontSize: 12.5,
        }}>
          Gespeichert um {savedAt.toLocaleTimeString('de-DE')} Uhr.
        </div>
      )}

      {/* Tab-Leiste */}
      <div style={{
        display: 'flex', gap: 2,
        borderBottom: '2px solid #e2e8f0',
        marginBottom: 20,
      }}>
        {TABS.map((tab) => {
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
                transition: 'color 0.15s',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab: Schule */}
      {activeTab === 'schule' && (
        <div style={{ display: 'grid', gap: 14 }}>
          <Card padding={20}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a', marginBottom: 14 }}>Schulinformationen</div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={labelStyle}>Schulname</label>
                <input value={form.schule_name} onChange={(e) => setField('schule_name', e.target.value)} style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>Straße und Hausnummer</label>
                <input value={form.schule_strasse} onChange={(e) => setField('schule_strasse', e.target.value)} style={fieldStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>PLZ</label>
                  <input value={form.schule_plz} onChange={(e) => setField('schule_plz', e.target.value)} style={fieldStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Ort</label>
                  <input value={form.schule_ort} onChange={(e) => setField('schule_ort', e.target.value)} style={fieldStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Telefon</label>
                  <input value={form.schule_telefon} onChange={(e) => setField('schule_telefon', e.target.value)} style={fieldStyle} />
                </div>
                <div>
                  <label style={labelStyle}>E-Mail</label>
                  <input value={form.schule_email} onChange={(e) => setField('schule_email', e.target.value)} style={fieldStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Schulleiter / Geschäftsführer</label>
                <input
                  value={form.schulleiter_name}
                  onChange={(e) => setField('schulleiter_name', e.target.value)}
                  placeholder="z.B. Dr. Max Mustermann"
                  style={fieldStyle}
                />
                <div style={hintStyle}>Wird automatisch in Rechnung- und Gutschrift-PDFs verwendet.</div>
              </div>
            </div>
          </Card>

          <Card padding={20}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a', marginBottom: 14 }}>Schuljahr</div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={labelStyle}>Aktuelles Schuljahr</label>
                <input
                  value={form.schuljahr_aktuell}
                  onChange={(e) => setField('schuljahr_aktuell', e.target.value)}
                  placeholder="z.B. 2026/2027"
                  style={fieldStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Nächster Schuljahresbeginn</label>
                <input
                  type="date"
                  value={form.schuljahr_naechster_beginn}
                  onChange={(e) => setField('schuljahr_naechster_beginn', e.target.value)}
                  style={fieldStyle}
                />
                {(() => {
                  if (!form.schuljahr_naechster_beginn) return null;
                  const heute = new Date(); heute.setHours(0, 0, 0, 0);
                  const termin = new Date(form.schuljahr_naechster_beginn);
                  const tage = Math.ceil((termin - heute) / 86400000);
                  let text, farbe;
                  const sperreAktiv = form.versetzung_sperre_aktiv === 'true';
                  if (tage === 0)       { text = 'Heute — erster Tag des neuen Schuljahres.'; farbe = '#047857'; }
                  else if (tage < 0)   { text = `Vor ${Math.abs(tage)} ${Math.abs(tage) === 1 ? 'Tag' : 'Tagen'} begonnen.`; farbe = '#b91c1c'; }
                  else if (sperreAktiv){ text = `Noch ${tage} ${tage === 1 ? 'Tag' : 'Tage'} bis zum Schuljahresbeginn — Klassenversetzung gesperrt.`; farbe = '#b45309'; }
                  else                 { text = `Noch ${tage} ${tage === 1 ? 'Tag' : 'Tage'} bis zum Schuljahresbeginn.`; farbe = '#2563eb'; }
                  return <div style={{ fontSize: 11.5, color: farbe, marginTop: 5, fontWeight: 500 }}>{text}</div>;
                })()}
                <div style={hintStyle}>
                  Steuert den Countdown auf dem Start-Screen und die Versetzungssperre.
                </div>
              </div>
              <div>
                <label style={labelStyle}>Klassenversetzung — Zeitsperre</label>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8,
                  background: '#fff', cursor: 'pointer', userSelect: 'none',
                }}>
                  <input
                    type="checkbox"
                    checked={form.versetzung_sperre_aktiv === 'true'}
                    onChange={(e) => setField('versetzung_sperre_aktiv', e.target.checked ? 'true' : 'false')}
                    style={{ width: 15, height: 15, accentColor: '#2563eb', cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 500 }}>Nur ab Schuljahresbeginn erlauben</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                      Versetzungen sind gesperrt, solange das Datum noch in der Zukunft liegt.
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Tab: Bankdaten */}
      {activeTab === 'bank' && (
        <Card padding={20}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a', marginBottom: 14 }}>Bankverbindung</div>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <label style={labelStyle}>Bank</label>
              <input value={form.schule_bank} onChange={(e) => setField('schule_bank', e.target.value)} style={fieldStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: 10 }}>
              <div>
                <label style={labelStyle}>IBAN</label>
                <input value={form.schule_iban} onChange={(e) => setField('schule_iban', e.target.value)} style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>BIC</label>
                <input value={form.schule_bic} onChange={(e) => setField('schule_bic', e.target.value)} style={fieldStyle} />
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Tab: Info */}
      {activeTab === 'info' && (
        <div style={{ display: 'grid', gap: 14 }}>
          <Card padding={20}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>App-Informationen</div>
            <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 16 }}>Details zur installierten Anwendung.</div>
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontSize: 12, color: '#475569', fontWeight: 500, minWidth: 140 }}>Name</span>
                <span style={{ fontSize: 13.5, color: '#0f172a' }}>Bibliomat</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontSize: 12, color: '#475569', fontWeight: 500, minWidth: 140 }}>Version</span>
                <span style={{ fontSize: 13.5, color: '#0f172a' }}>1.1.1c</span>
              </div>
            </div>
          </Card>

          <Card padding={20}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>Entwickler</div>
            <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 16 }}>Entwickelt und betreut von BP Mediawork GmbH.</div>
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontSize: 12, color: '#475569', fontWeight: 500, minWidth: 140 }}>Unternehmen</span>
                <span style={{ fontSize: 13.5, color: '#0f172a' }}>BP Mediawork GmbH</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontSize: 12, color: '#475569', fontWeight: 500, minWidth: 140 }}>E-Mail</span>
                <a href="mailto:buero@bpmediawork.de" style={{ fontSize: 13.5, color: '#2563eb', textDecoration: 'none' }}>buero@bpmediawork.de</a>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontSize: 12, color: '#475569', fontWeight: 500, minWidth: 140 }}>Website</span>
                <span style={{ fontSize: 13.5, color: '#0f172a' }}>www.bpmediawork.de</span>
              </div>
            </div>
          </Card>

          <Card padding={20}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>Support</div>
            <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 16 }}>Bei Fragen oder Problemen wenden Sie sich direkt an den Support.</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 12, color: '#475569', fontWeight: 500, minWidth: 140 }}>Support E-Mail</span>
              <a href="mailto:kiscouts@bpmediawork.de" style={{ fontSize: 13.5, color: '#2563eb', textDecoration: 'none' }}>kiscouts@bpmediawork.de</a>
            </div>
          </Card>
        </div>
      )}

      {/* Tab: Konten */}
      {activeTab === 'konten' && isAdmin && (
        <div style={{ display: 'grid', gap: 14 }}>
          {benutzerError && (
            <div style={{
              padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca',
              color: '#b91c1c', borderRadius: 8, fontSize: 12.5,
            }}>
              {benutzerError}
            </div>
          )}

          {/* Benutzer verwalten */}
          <Card padding={20}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a', marginBottom: 14 }}>Benutzer verwalten</div>
            {benutzerLoading ? (
              <div style={{ color: '#64748b', fontSize: 13 }}>Lade Benutzer...</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ textAlign: 'left', padding: '6px 0', color: '#475569', fontWeight: 500, fontSize: 12 }}>Benutzername</th>
                    <th style={{ textAlign: 'left', padding: '6px 0', color: '#475569', fontWeight: 500, fontSize: 12 }}>Rolle</th>
                    <th style={{ textAlign: 'right', padding: '6px 0', color: '#475569', fontWeight: 500, fontSize: 12 }}>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {benutzerList.map((b) => (
                      <React.Fragment key={b.benutzername}>
                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 0', color: '#0f172a' }}>{b.benutzername}</td>
                          <td style={{ padding: '10px 0' }}>
                            <span style={{
                              padding: '3px 8px', fontSize: 11.5, fontWeight: 600, borderRadius: 999,
                              ...(b.rolle === 'admin'
                                ? { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }
                                : { background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }),
                            }}>
                              {b.rolle === 'admin' ? 'Admin' : 'Standard'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 0', textAlign: 'right', display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                            <button
                              disabled={rolleChanging[b.benutzername]}
                              onClick={() => {
                                const neueRolle = b.rolle === 'admin' ? 'standard' : 'admin';
                                setRolleChanging(prev => ({ ...prev, [b.benutzername]: true }));
                                window.api.admin.benutzer.setRolle(b.benutzername, neueRolle)
                                  .then((updated) => {
                                    setBenutzerList(prev => prev.map(x => x.benutzername === b.benutzername ? { ...x, rolle: updated.rolle } : x));
                                  })
                                  .catch(e => setBenutzerError(e.message))
                                  .finally(() => setRolleChanging(prev => ({ ...prev, [b.benutzername]: false })));
                              }}
                              style={{
                                padding: '5px 10px', fontSize: 12, border: '1px solid #e2e8f0',
                                borderRadius: 6, background: '#f8fafc', cursor: 'pointer', color: '#475569',
                              }}
                            >
                              {b.rolle === 'admin' ? 'Admin-Rechte entziehen' : 'Zum Admin machen'}
                            </button>
                            <button
                              onClick={() => {
                                setPasswordChanging(prev => ({ ...prev, [b.benutzername]: !prev[b.benutzername] }));
                                setPwInputs(prev => ({ ...prev, [b.benutzername]: '' }));
                              }}
                              style={{
                                padding: '5px 10px', fontSize: 12, border: '1px solid #e2e8f0',
                                borderRadius: 6, background: '#f8fafc', cursor: 'pointer', color: '#475569',
                              }}
                            >
                              Passwort ändern
                            </button>
                            <button
                              onClick={() => {
                                if (!window.confirm(`Benutzer "${b.benutzername}" wirklich löschen?`)) return;
                                window.api.admin.benutzer.remove(b.benutzername)
                                  .then(() => setBenutzerList(prev => prev.filter(x => x.benutzername !== b.benutzername)))
                                  .catch(e => setBenutzerError(e.message));
                              }}
                              style={{
                                padding: '5px 10px', fontSize: 12, border: '1px solid #fecaca',
                                borderRadius: 6, background: '#fef2f2', cursor: 'pointer', color: '#b91c1c',
                              }}
                            >
                              Löschen
                            </button>
                          </td>
                        </tr>
                        {passwordChanging[b.benutzername] && (
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td colSpan={3} style={{ padding: '8px 0 12px 0' }}>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <input
                                  type="password"
                                  placeholder="Neues Passwort"
                                  value={pwInputs[b.benutzername] || ''}
                                  onChange={e => setPwInputs(prev => ({ ...prev, [b.benutzername]: e.target.value }))}
                                  style={{ ...fieldStyle, maxWidth: 260 }}
                                />
                                <button
                                  onClick={() => {
                                    const pw = pwInputs[b.benutzername] || '';
                                    if (!pw) return;
                                    window.api.admin.benutzer.changePasswort(b.benutzername, pw)
                                      .then(() => {
                                        setPasswordChanging(prev => ({ ...prev, [b.benutzername]: false }));
                                        setPwInputs(prev => ({ ...prev, [b.benutzername]: '' }));
                                      })
                                      .catch(e => setBenutzerError(e.message));
                                  }}
                                  style={{
                                    padding: '5px 12px', fontSize: 12, border: '1px solid #a7f3d0',
                                    borderRadius: 6, background: '#ecfdf5', cursor: 'pointer', color: '#047857',
                                  }}
                                >
                                  Speichern
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                  ))}
                  {benutzerList.length === 0 && (
                    <tr>
                      <td colSpan={3} style={{ padding: '10px 0', color: '#94a3b8', fontSize: 13 }}>Keine Benutzer vorhanden.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </Card>

          {/* Neuen Benutzer anlegen */}
          <Card padding={20}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a', marginBottom: 14 }}>Neuen Benutzer anlegen</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'flex-end' }}>
              <div>
                <label style={labelStyle}>Benutzername</label>
                <input
                  value={neuerBenutzername}
                  onChange={e => setNeuerBenutzername(e.target.value)}
                  placeholder="z.B. lehrer"
                  style={fieldStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Passwort</label>
                <input
                  type="password"
                  value={neuesPasswort}
                  onChange={e => setNeuesPasswort(e.target.value)}
                  placeholder="Passwort"
                  style={fieldStyle}
                />
              </div>
              <button
                onClick={() => {
                  if (!neuerBenutzername || !neuesPasswort) return;
                  setBenutzerError(null);
                  window.api.admin.benutzer.create({
                    benutzername: neuerBenutzername,
                    passwort: neuesPasswort,
                    rolle: neueRolleAdmin ? 'admin' : 'standard',
                  })
                    .then(neu => {
                      setBenutzerList(prev => [...prev, neu]);
                      setNeuerBenutzername('');
                      setNeuesPasswort('');
                      setNeueRolleAdmin(false);
                    })
                    .catch(e => setBenutzerError(e.message));
                }}
                style={{
                  padding: '9px 16px', fontSize: 13, fontWeight: 500,
                  border: '1px solid #bfdbfe', borderRadius: 8,
                  background: '#eff6ff', cursor: 'pointer', color: '#1d4ed8',
                  whiteSpace: 'nowrap',
                }}
              >
                Anlegen
              </button>
            </div>
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                id="neue-rolle-admin"
                checked={neueRolleAdmin}
                onChange={e => setNeueRolleAdmin(e.target.checked)}
              />
              <label htmlFor="neue-rolle-admin" style={{ fontSize: 12.5, color: '#475569', cursor: 'pointer' }}>
                Admin-Rechte geben (Benutzerverwaltung, Backup/Restore)
              </label>
            </div>
          </Card>

          {/* Admin-Passwort ändern */}
          <Card padding={20}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a', marginBottom: 14 }}>Admin-Passwort ändern</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'flex-end' }}>
              <div>
                <label style={labelStyle}>Neues Admin-Passwort</label>
                <input
                  type="password"
                  value={adminPasswort}
                  onChange={e => setAdminPasswort(e.target.value)}
                  placeholder="Neues Passwort"
                  style={fieldStyle}
                />
              </div>
              <button
                onClick={() => {
                  if (!adminPasswort) return;
                  setBenutzerError(null);
                  window.api.admin.changeAdminPasswort(adminPasswort)
                    .then(() => setAdminPasswort(''))
                    .catch(e => setBenutzerError(e.message));
                }}
                style={{
                  padding: '9px 16px', fontSize: 13, fontWeight: 500,
                  border: '1px solid #a7f3d0', borderRadius: 8,
                  background: '#ecfdf5', cursor: 'pointer', color: '#047857',
                  whiteSpace: 'nowrap',
                }}
              >
                Speichern
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Tab: System */}
      {activeTab === 'system' && isAdmin && (
        <div style={{ display: 'grid', gap: 14 }}>
          {/* Backup */}
          <Card padding={20}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>Datenbank-Backup</div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>
              Lädt die aktuelle SQLite-Datenbank als Backup-Datei herunter.
            </div>
            <button
              onClick={async () => {
                try {
                  const res = await fetch(window.api.admin.backup.url(), {
                    credentials: 'include',
                  });
                  if (!res.ok) throw new Error('HTTP ' + res.status);
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `bibliomat-backup-${new Date().toISOString().slice(0, 10)}.db`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch (e) {
                  alert('Backup fehlgeschlagen: ' + e.message);
                }
              }}
              style={{
                padding: '9px 16px', fontSize: 13, fontWeight: 500,
                border: '1px solid #bfdbfe', borderRadius: 8,
                background: '#eff6ff', cursor: 'pointer', color: '#1d4ed8',
                fontFamily: 'inherit',
              }}
            >
              Datenbank sichern
            </button>
          </Card>

          {/* Restore */}
          <Card padding={20}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>Datenbank wiederherstellen</div>
            <div style={{
              marginBottom: 14, padding: '10px 12px',
              background: '#fffbeb', border: '1px solid #fde68a',
              color: '#92400e', borderRadius: 8, fontSize: 12.5,
            }}>
              Achtung: Die bestehende Datenbank wird unwiderruflich überschrieben. Nur eine gültige SQLite-Datei wird akzeptiert.
            </div>
            <label style={{
              display: 'inline-block',
              padding: '9px 16px', fontSize: 13, fontWeight: 500,
              border: '1px solid #fecaca', borderRadius: 8,
              background: '#fef2f2', cursor: 'pointer', color: '#b91c1c',
            }}>
              Datenbank wiederherstellen
              <input
                type="file"
                accept=".db,application/octet-stream"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files && e.target.files[0];
                  if (!file) return;
                  if (!window.confirm('Achtung: Die bestehende Datenbank wird überschrieben. Fortfahren?')) {
                    e.target.value = '';
                    return;
                  }
                  window.api.admin.backup.restore(file)
                    .then(() => alert('Datenbank erfolgreich wiederhergestellt. Bitte Seite neu laden.'))
                    .catch(err => alert('Fehler beim Wiederherstellen: ' + err.message))
                    .finally(() => { e.target.value = ''; });
                }}
              />
            </label>
          </Card>
        </div>
      )}

      {/* Tab: E-Mail & Versand */}
      {activeTab === 'email' && (
        <div style={{ display: 'grid', gap: 14 }}>
          <Card padding={20}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>Mailserver-Zugangsdaten</div>
            <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 14 }}>
              Ausgehender Mailserver für den Rechnungsversand aus der Buchhaltung.
            </div>

            {/* Auth-Methode */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Authentifizierungsprotokoll</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  { value: 'smtp', label: 'Benutzername / Passwort (SMTP)' },
                  { value: 'oauth2', label: 'OAuth2 (Microsoft / Office 365)' },
                ].map(opt => (
                  <label key={opt.value} style={{
                    display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', cursor: 'pointer',
                    border: '1px solid ' + (form.mail_auth_method === opt.value ? '#2563eb' : '#e2e8f0'),
                    borderRadius: 8, background: form.mail_auth_method === opt.value ? '#eff6ff' : '#fff',
                    fontSize: 12.5, color: '#0f172a',
                  }}>
                    <input type="radio" name="mail_auth_method" value={opt.value}
                      checked={form.mail_auth_method === opt.value}
                      onChange={() => setField('mail_auth_method', opt.value)}
                      style={{ accentColor: '#2563eb' }} />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Host + Port — immer sichtbar */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={labelStyle}>SMTP Host</label>
                <input value={form.mail_smtp_host} onChange={(e) => setField('mail_smtp_host', e.target.value)}
                  placeholder={form.mail_auth_method === 'oauth2' ? 'smtp.office365.com' : 'z.B. smtp.office365.com'} style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>SMTP Port</label>
                <input value={form.mail_smtp_port} onChange={(e) => setField('mail_smtp_port', e.target.value)} placeholder="587" style={fieldStyle} />
              </div>
            </div>

            {/* SMTP: Benutzername + Passwort + Flags */}
            {form.mail_auth_method !== 'oauth2' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={labelStyle}>Benutzername</label>
                    <input value={form.mail_smtp_username} onChange={(e) => setField('mail_smtp_username', e.target.value)} style={fieldStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Passwort</label>
                    <input type="password" value={form.mail_smtp_password} onChange={(e) => setField('mail_smtp_password', e.target.value)}
                      placeholder={form.mail_smtp_password_set === 'true' ? 'Gespeichert – leer lassen, um beizubehalten' : ''} style={fieldStyle} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.mail_smtp_use_starttls === 'true'}
                      onChange={(e) => setField('mail_smtp_use_starttls', e.target.checked ? 'true' : 'false')}
                      style={{ width: 15, height: 15, accentColor: '#2563eb', cursor: 'pointer' }} />
                    <span style={{ fontSize: 12.5, color: '#0f172a' }}>STARTTLS nutzen</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.mail_smtp_use_ssl === 'true'}
                      onChange={(e) => setField('mail_smtp_use_ssl', e.target.checked ? 'true' : 'false')}
                      style={{ width: 15, height: 15, accentColor: '#2563eb', cursor: 'pointer' }} />
                    <span style={{ fontSize: 12.5, color: '#0f172a' }}>SSL direkt nutzen</span>
                  </label>
                </div>
              </>
            )}

            {/* OAuth2: Tenant-ID, Client-ID, Client-Secret */}
            {form.mail_auth_method === 'oauth2' && (
              <>
                <div style={{ padding: '10px 12px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, fontSize: 12, color: '#0369a1', marginBottom: 10 }}>
                  Für Microsoft Office 365 / Exchange Online: App-Registrierung im Azure-Portal erforderlich. SMTP-Host: <strong>smtp.office365.com</strong>, Port: <strong>587</strong>.
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={labelStyle}>Benutzername (SMTP AUTH – E-Mail-Adresse des Absenders)</label>
                  <input value={form.mail_smtp_username} onChange={(e) => setField('mail_smtp_username', e.target.value)}
                    placeholder="sekretariat@schule.de" style={fieldStyle} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={labelStyle}>Tenant-ID (Azure AD)</label>
                    <input value={form.mail_oauth2_tenant_id} onChange={(e) => setField('mail_oauth2_tenant_id', e.target.value)}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" style={fieldStyle} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>Client-ID (App-Registrierung)</label>
                    <input value={form.mail_oauth2_client_id} onChange={(e) => setField('mail_oauth2_client_id', e.target.value)}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" style={fieldStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Client-Secret</label>
                    <input type="password" value={form.mail_oauth2_client_secret} onChange={(e) => setField('mail_oauth2_client_secret', e.target.value)}
                      placeholder={form.mail_oauth2_client_secret_set === 'true' ? 'Gespeichert – leer lassen, um beizubehalten' : ''} style={fieldStyle} />
                  </div>
                </div>
              </>
            )}
          </Card>

          <Card padding={20}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a', marginBottom: 14 }}>Absender & Templates</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Absender E-Mail</label>
                <input value={form.mail_from_email} onChange={(e) => setField('mail_from_email', e.target.value)} placeholder="sekretariat@schule.de" style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>Absender Name</label>
                <input value={form.mail_from_name} onChange={(e) => setField('mail_from_name', e.target.value)} placeholder="Schulsekretariat" style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>Reply-To</label>
                <input value={form.mail_reply_to} onChange={(e) => setField('mail_reply_to', e.target.value)} placeholder="optional" style={fieldStyle} />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>Betreff-Template</label>
              <input value={form.mail_subject_template} onChange={(e) => setField('mail_subject_template', e.target.value)} style={fieldStyle} />
            </div>
            <div style={{ marginTop: 10 }}>
              <label style={labelStyle}>Text-Template</label>
              <textarea value={form.mail_body_template} onChange={(e) => setField('mail_body_template', e.target.value)} style={textAreaStyle} />
            </div>
            <div style={{ marginTop: 8, fontSize: 11.5, color: '#64748b', lineHeight: 1.6 }}>
              Verfügbare Platzhalter:{' '}
              <code>{'{{ schueler.name }}'}</code>, <code>{'{{ schueler.vorname }}'}</code>, <code>{'{{ schueler.nachname }}'}</code>,{' '}
              <code>{'{{ schueler.klasse }}'}</code>, <code>{'{{ rechnung.anzeige_nr }}'}</code>, <code>{'{{ rechnung.id }}'}</code>, <code>{'{{ rechnung.datum }}'}</code>,{' '}
              <code>{'{{ rechnung.summe_eur }}'}</code>, <code>{'{{ rechnung.zu_zahlen_eur }}'}</code>, <code>{'{{ schule.name }}'}</code>.
            </div>
          </Card>

          <Card padding={20}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>E-Mail-Signatur</div>
            <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 14 }}>
              Wird automatisch unter jede versendete E-Mail gesetzt. Logo-Datei: <code>backend/app/static/logo.jpeg</code> (einfach dort ablegen, kein Neustart nötig).
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Klartext-Signatur (für E-Mail-Clients ohne HTML)</label>
              <textarea value={form.mail_signature_text} onChange={(e) => setField('mail_signature_text', e.target.value)} style={{ ...textAreaStyle, minHeight: 90, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }} />
            </div>
            <div>
              <label style={labelStyle}>HTML-Signatur (mit Logo, für HTML-E-Mail-Clients)</label>
              <textarea value={form.mail_signature_html} onChange={(e) => setField('mail_signature_html', e.target.value)} style={{ ...textAreaStyle, minHeight: 90, fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5 }} />
            </div>
            <div style={{ marginTop: 8, fontSize: 11.5, color: '#64748b' }}>
              Das Logo wird als <code>cid:school_logo_bibliomat</code> eingebettet — dieser Wert muss im HTML-Src stehen.
            </div>
          </Card>
        </div>
      )}

    </div>
  );
}

function pickProfileFields(data) {
  return {
    schule_name: data.schule_name || '',
    schule_strasse: data.schule_strasse || '',
    schule_plz: data.schule_plz || '',
    schule_ort: data.schule_ort || '',
    schule_telefon: data.schule_telefon || '',
    schule_email: data.schule_email || '',
    schulleiter_name: data.schulleiter_name || '',
    schule_iban: data.schule_iban || '',
    schule_bic: data.schule_bic || '',
    schule_bank: data.schule_bank || '',
    schuljahr_aktuell: data.schuljahr_aktuell || '',
    schuljahr_naechster_beginn: data.schuljahr_naechster_beginn || '',
    versetzung_sperre_aktiv: data.versetzung_sperre_aktiv ?? 'true',
    mail_auth_method: data.mail_auth_method || 'smtp',
    mail_smtp_host: data.mail_smtp_host || '',
    mail_smtp_port: data.mail_smtp_port || '587',
    mail_smtp_username: data.mail_smtp_username || '',
    mail_smtp_password: data.mail_smtp_password || '',
    mail_smtp_password_set: data.mail_smtp_password_set ? 'true' : 'false',
    mail_smtp_use_starttls: data.mail_smtp_use_starttls ?? 'true',
    mail_smtp_use_ssl: data.mail_smtp_use_ssl ?? 'false',
    mail_oauth2_tenant_id: data.mail_oauth2_tenant_id || '',
    mail_oauth2_client_id: data.mail_oauth2_client_id || '',
    mail_oauth2_client_secret: '',
    mail_oauth2_client_secret_set: data.mail_oauth2_client_secret_set ? 'true' : 'false',
    mail_from_email: data.mail_from_email || '',
    mail_from_name: data.mail_from_name || '',
    mail_reply_to: data.mail_reply_to || '',
    mail_subject_template: data.mail_subject_template || '',
    mail_body_template: data.mail_body_template || '',
    mail_signature_text: data.mail_signature_text || '--\nSpreestraße 2 · 16341 Panketal\nTel.   030 – 94 41 81 24\nFax.  030 – 94 41 86 96\nwww.gymnasium-panketal.de',
    mail_signature_html: data.mail_signature_html || '<table style="border-top:1px solid #e2e8f0;padding-top:12px;margin-top:20px;font-family:Arial,sans-serif;font-size:12px;color:#374151;line-height:1.7;"><tr><td style="padding-right:16px;vertical-align:top;"><img src="cid:school_logo_bibliomat" alt="Gymnasium Panketal" style="height:55px;width:auto;"></td><td style="vertical-align:top;">Spreestraße 2 · 16341 Panketal<br>Tel.&nbsp;&nbsp;030 – 94 41 81 24<br>Fax.&nbsp;&nbsp;030 – 94 41 86 96<br><a href="http://www.gymnasium-panketal.de" style="color:#374151;text-decoration:none;">www.gymnasium-panketal.de</a></td></tr></table>',
  };
}

function sanitizeForm(form) {
  const out = {};
  Object.entries(form).forEach(([key, value]) => {
    if (key === 'mail_smtp_password_set') return;
    if (key === 'mail_oauth2_client_secret_set') return;
    if (key === 'mail_smtp_password' && !(value ?? '').toString().trim()) return;
    if (key === 'mail_oauth2_client_secret' && !(value ?? '').toString().trim()) return;
    out[key] = (value ?? '').toString().trim();
  });
  return out;
}

window.Profil = Profil;
