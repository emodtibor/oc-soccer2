# Google OAuth beállítás (Portainer + GitHub-safe)

Az alkalmazás Google loginhoz az alábbi env változókat használja:

- `GOOGLE_CLIENT_ID` (kötelező)
- `GOOGLE_CLIENT_SECRET` (kötelező)
- `GOOGLE_REDIRECT_URI` (opcionális, de erősen ajánlott)
- `GOOGLE_AUTH_BASE_PATH` (opcionális, alapértelmezés: `/api`)

## Miért nem kerülnek secret-ek a GitHub repository-ba?

A `docker-compose.portainer.tpl.yml` csak változóhivatkozásokat tartalmaz.
A valódi értékeket a Portainer stack környezetében vagy a szerveren lévő
`/srv/oc-soccer/backend/.env` fájlban kell megadni.

## 1) Google Console

1. Google Cloud Console → APIs & Services → Credentials.
2. Hozz létre egy **OAuth 2.0 Client ID**-t, típusa: **Web application**.
3. `Authorized redirect URI` érték legyen pontosan ugyanaz, mint a backend callback URL.
   Példa:
   - `https://<domain>/api/auth/google/callback`

## 2) Szerver oldali .env fájl

Hozd létre a cél szerveren:

`/srv/oc-soccer/backend/.env`

Tartalma (példa):

```env
GOOGLE_CLIENT_ID=xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxx
GOOGLE_REDIRECT_URI=https://<domain>/api/auth/google/callback
GOOGLE_AUTH_BASE_PATH=/api
```

> A `.env` fájl NE kerüljön a repository-ba.

## 3) Hibák értelmezése

- `invalid_client`: a client ID / secret páros hibás vagy nem ugyanahhoz a Web OAuth klienshez tartozik.
- `redirect_uri_mismatch`: a Google Console-ban beállított callback URI és a backend által használt URI nem egyezik.

A backend `GET /auth/me` válasza tartalmazza a backend által számolt redirect URI-t (`redirectUri`),
így könnyen ellenőrizhető, hogy melyik URL-t kell pontosan felvenni a Google Console-ban.
