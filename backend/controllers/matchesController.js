const db = require("../db");
const { generateTeamsFor } = require("../services/teamGenerator");

exports.list = (req,res)=>{
  db.all("SELECT * FROM matches ORDER BY date DESC", (err, rows)=>{
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

exports.create = (req,res)=>{
  const { date, location } = req.body || {};
  if (!date || !location) return res.status(400).json({ error: "date és location kötelező" });
  db.run("INSERT INTO matches (date, location) VALUES (?,?)", [date,location], function(err){
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, date, location });
  });
};

exports.remove = (req,res)=>{
  const id = parseInt(req.params.id,10);
  db.serialize(()=>{
    db.run("DELETE FROM match_participants WHERE match_id = ?", [id]);
    db.run("DELETE FROM match_team_members WHERE team_id IN (SELECT id FROM match_teams WHERE match_id = ?)", [id]);
    db.run("DELETE FROM match_teams WHERE match_id = ?", [id]);
    db.run("DELETE FROM matches WHERE id = ?", [id], function(err){
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: this.changes > 0 });
    });
  });
};

exports.participants = (req,res)=>{
  const matchId = parseInt(req.params.id,10);
  const sql = `SELECT p.id, p.name, p.skill, p.is_goalie
               FROM match_participants mp JOIN players p ON p.id=mp.player_id
               WHERE mp.match_id=? ORDER BY p.name`;
  db.all(sql, [matchId], (err, rows)=>{
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r=>({ id:r.id, name:r.name, skill:r.skill, isGoalie: !!r.is_goalie })));
  });
};

exports.setParticipants = (req,res)=>{
  const matchId = parseInt(req.params.id,10);
  const { playerIds } = req.body || {};
  if (!Array.isArray(playerIds)) return res.status(400).json({ error: "playerIds tömb kell" });

  db.serialize(()=>{
    db.run("DELETE FROM match_participants WHERE match_id = ?", [matchId], (err)=>{
      if (err) return res.status(500).json({ error: err.message });
      const ins = db.prepare("INSERT INTO match_participants (match_id, player_id) VALUES (?,?)");
      playerIds.forEach(pid => ins.run([matchId, pid]));
      ins.finalize(err2=>{
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ success:true, count: playerIds.length });
      });
    });
  });
};

exports.getTeams = (req,res)=>{
  const matchId = parseInt(req.params.id,10);
  const sqlTeams = `SELECT id, team_index FROM match_teams WHERE match_id=? ORDER BY team_index`;
  db.all(sqlTeams,[matchId],(err,teams)=>{
    if (err) return res.status(500).json({ error: err.message });
    if (!teams.length) return res.json([]);
    const ids = teams.map(t=>t.id);
    const ph = ids.map(()=>"?").join(",");
    const sqlMembers = `SELECT mtm.team_id, p.id, p.name, p.skill, p.is_goalie
                        FROM match_team_members mtm JOIN players p ON p.id=mtm.player_id
                        WHERE mtm.team_id IN (${ph}) ORDER BY p.skill DESC, p.name`;
    db.all(sqlMembers, ids, (err2, rows)=>{
      if (err2) return res.status(500).json({ error: err2.message });
      const byTeam = {}; teams.forEach(t=>byTeam[t.id]=[]);
      rows.forEach(r=>byTeam[r.team_id].push({ id:r.id, name:r.name, skill:r.skill, isGoalie: !!r.is_goalie }));
      res.json(teams.map(t=>({
        teamIndex: t.team_index,
        players: byTeam[t.id],
        totalSkill: byTeam[t.id].reduce((s,p)=>s+p.skill,0)
      })));
    });
  });
};

exports.generateTeams = (req,res)=>{
  const matchId = parseInt(req.params.id,10);
  const q = `SELECT p.id, p.name, p.skill, p.is_goalie
             FROM match_participants mp JOIN players p ON p.id=mp.player_id
             WHERE mp.match_id=?`;
  db.all(q,[matchId],(err,players)=>{
    if (err) return res.status(500).json({ error: err.message });
    const { teams, error } = generateTeamsFor(players);
    if (error) return res.status(400).json({ error });

    // persist
    db.serialize(()=>{
      db.run("DELETE FROM match_team_members WHERE team_id IN (SELECT id FROM match_teams WHERE match_id = ?)", [matchId]);
      db.run("DELETE FROM match_teams WHERE match_id = ?", [matchId], (err2)=>{
        if (err2) return res.status(500).json({ error: err2.message });

        const insTeam = db.prepare("INSERT INTO match_teams (match_id, team_index) VALUES (?,?)");
        const insMember = db.prepare("INSERT INTO match_team_members (team_id, player_id) VALUES (?,?)");
        const out = [];

        teams.forEach((t, idx)=>{
          insTeam.run([matchId, idx], function(){
            const teamId = this.lastID;
            t.members.forEach(m=>insMember.run([teamId, m.id]));
            out.push({
              teamIndex: idx,
              players: t.members.map(m=>({ id:m.id, name:m.name, skill:m.skill, isGoalie: !!m.is_goalie })),
              totalSkill: t.sum
            });
          });
        });

        insTeam.finalize(()=>insMember.finalize(()=>res.json(out.sort((a,b)=>a.teamIndex-b.teamIndex))));
      });
    });
  });
};
