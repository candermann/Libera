# Deploy

Ziel: nur internes Schulnetz.

Später erreichst du die App unter `http://bibliomat.schule.local`.

Wichtig:

- DNS: `bibliomat.schule.local -> SERVER-IP`
- keine öffentliche Portweiterleitung
- `backend/_env` enthält die Bootstrap-Werte für den Erststart
- `.env` bleibt für lokale Overrides optional und wird nicht committen

## Erster Deploy

```bash
git clone ...
cd Libera
./install-docker.sh
logout/login
./deploy.sh
```

## Update

```bash
git pull
./deploy.sh
```

## Test

```bash
curl http://127.0.0.1/api/health
```

Browser:

- `http://SERVER-IP`
- `http://bibliomat.schule.local`
