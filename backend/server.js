const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const { initDb } = require("./db"); // <-- A verzióból

async function start() {
  const dataDir = path.join(__dirname, "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const db = await initDb(console); // <- itt nyit és migrál

  const app = express();
  app.use(cors());
  app.use(bodyParser.json());

  // DB elérhetővé tétele a controllereknek:
  app.use((req, _res, next) => {
    req.db = db;
    next();
  });

  const playersRoutes = require("./routes/players");
  const matchesRoutes = require("./routes/matches");
  const matchParticipantsRoutes = require("./routes/matchParticipants");
  const teamsRoutes = require("./routes/teams");

  app.use("/matches", teamsRoutes);
  app.use("/matches", matchParticipantsRoutes);
  app.use("/players", playersRoutes);
  app.use("/matches", matchesRoutes);

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

start().catch(err => {
  console.error("Startup error:", err);
  process.exit(1);
});
