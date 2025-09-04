// server.js
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// In-memory adatbázis (később sqlite/mongo helyett)
let players = [];
let matches = [];

// --- PLAYERS ---
app.get("/players", (req, res) => {
  res.json(players);
});

app.post("/players", (req, res) => {
  const { name, skill } = req.body;
  players.push({ id: Date.now(), name, skill });
  res.json({ success: true });
});

// --- MATCHES ---
app.get("/matches", (req, res) => {
  res.json(matches);
});

app.post("/matches", (req, res) => {
  const { date, location } = req.body;
  const newMatch = { id: Date.now(), date, location };
  matches.push(newMatch);
  res.json(newMatch);
});

app.delete("/matches/:id", (req, res) => {
  const { id } = req.params;
  matches = matches.filter(m => m.id != id);
  res.json({ success: true });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
