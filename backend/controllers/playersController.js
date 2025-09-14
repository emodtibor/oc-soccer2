const db = require("../db");

exports.list = (req, res) => {
  db.all("SELECT * FROM players ORDER BY name", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => ({ ...r, isGoalie: !!r.is_goalie })));
  });
};

exports.create = (req, res) => {
  const { name, skill, isGoalie = false } = req.body || {};
  if (!name || Number.isNaN(parseInt(skill,10)))
    return res.status(400).json({ error: "name és skill kötelező" });

  db.run(
    "INSERT INTO players (name, skill, is_goalie) VALUES (?, ?, ?)",
    [name, parseInt(skill,10), isGoalie ? 1 : 0],
    function(err){
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, name, skill: parseInt(skill,10), isGoalie: !!isGoalie });
    }
  );
};

exports.update = (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, skill, isGoalie } = req.body || {};
  db.run(
    `UPDATE players SET 
      name = COALESCE(?, name),
      skill = COALESCE(?, skill),
      is_goalie = COALESCE(?, is_goalie)
     WHERE id = ?`,
    [
      name ?? null,
      (typeof skill === "number" ? skill : null),
      (typeof isGoalie === "boolean" ? (isGoalie?1:0) : null),
      id
    ],
    function(err){
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: this.changes > 0 });
    }
  );
};
