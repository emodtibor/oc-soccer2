const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const { initDb } = require("./db"); // <-- A verzióból
const {
  ALLOWED_EMAIL,
  attachAuth,
  buildGoogleAuthUrl,
  clearSession,
  clearSessionCookie,
  consumeOAuthState,
  createSession,
  exchangeCodeForIdToken,
  getDefaultRedirectUri,
  requireWriteAuth,
  setSessionCookie,
  verifyGoogleIdToken,
} = require("./utils/auth");

async function start() {
  const dataDir = path.join(__dirname, "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const db = await initDb(console); // <- itt nyit és migrál

  const app = express();
    app.use(cors({ origin: true, credentials: true }));
  app.use(bodyParser.json());
  app.use(attachAuth);

  app.get("/auth/me", (req, res) => {
    res.json({
      isAuthenticated: req.auth.isAuthenticated,
      user: req.auth.user,
      allowedEmail: ALLOWED_EMAIL,
      redirectUri: getDefaultRedirectUri(req),
    });
  });

  app.get("/auth/google/start", (req, res) => {
    try {
      const requestedReturnTo = req.query?.returnTo;
      const returnTo = typeof requestedReturnTo === "string" && requestedReturnTo.trim()
        ? requestedReturnTo
        : "/";
      const authUrl = buildGoogleAuthUrl(req, returnTo);
      return res.redirect(authUrl);
    } catch (err) {
      console.error(err);
      return res.status(500).send(err.message || "Sikertelen Google bejelentkezés indítás.");
    }
  });

  app.get("/auth/google/callback", async (req, res) => {
    try {
      const code = req.query?.code;
      const state = req.query?.state;
      if (!code || !state) {
        return res.status(400).send("Hiányzó OAuth paraméterek.");
      }
      const stateRecord = consumeOAuthState(state);
      if (!stateRecord) {
        return res.status(400).send("Lejárt vagy érvénytelen OAuth state.");
      }
      const idToken = await exchangeCodeForIdToken(req, code);
      const user = await verifyGoogleIdToken(idToken);
      const sessionId = createSession(user);
      setSessionCookie(res, sessionId);
      return res.redirect(stateRecord.returnTo || "/");
    } catch (err) {
      console.error(err);
      return res.status(403).send(err.message || "Sikertelen bejelentkezés.");
    }
  });

  app.post("/auth/logout", (req, res) => {
    if (req.auth.sessionId) clearSession(req.auth.sessionId);
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.use(requireWriteAuth);

  // DB elérhetővé tétele a controllereknek:
  app.use((req, _res, next) => {
    req.db = db;
    next();
  });

  const playersRoutes = require("./routes/players");
  const matchesRoutes = require("./routes/matches");
  const matchParticipantsRoutes = require("./routes/matchParticipants");
  const teamsRoutes = require("./routes/teams");
  const matchGamesRoutes = require("./routes/matchGames");

  app.use("/matches", teamsRoutes);
  app.use("/matches", matchParticipantsRoutes);
  app.use("/players", playersRoutes);
  app.use("/matches", matchesRoutes);
  app.use("/", matchGamesRoutes);

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

start().catch(err => {
  console.error("Startup error:", err);
  process.exit(1);
});
