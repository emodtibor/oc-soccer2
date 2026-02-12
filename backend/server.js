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
  exchangeCodeForIdToken,
  createSession,
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
    });
  });

  app.post("/auth/google", async (req, res) => {
    try {
      const idToken = req.body?.idToken;
      if (!idToken) {
        return res.status(400).json({ error: "Hiányzó idToken." });
      }
      const user = await verifyGoogleIdToken(idToken);
      const sessionId = createSession(user);
      setSessionCookie(res, sessionId);
      return res.json({ ok: true, user });
    } catch (err) {
      console.error(err);
      return res.status(403).json({ error: err.message || "Sikertelen bejelentkezés." });
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
