function splitTargets(n, k){
  const base = Math.floor(n / k), rem = n % k;
  return Array.from({length:k}, (_,i)=> base + (i<rem?1:0));
}

exports.generateTeamsFor = (players = []) => {
  if (!players.length) return { error: "Nincs résztvevő." };
  if (players.length > 17) return { error: "Max 17 résztvevő." };

  const teamCount = (players.length === 17) ? 3 : 2;
  const targets = splitTargets(players.length, teamCount);

  const goaliesAll = players.filter(p => p.is_goalie);
  const fielders = players.filter(p => !p.is_goalie);

  // Csapat célok
  const teams = targets.map(t => ({ members: [], sum: 0, hasGoalie: false, target: t }));

  // 1) "Elsődleges" kapusok: legfeljebb 1/csapat (kiválasztjuk a top N-t)
  const primaryGoalies = goaliesAll.slice().sort((a,b)=>b.skill-a.skill).slice(0, teamCount);

  // Rakjuk le őket külön csapatokba (körbeforgással, célméretet figyelve)
  primaryGoalies.forEach((g, idx) => {
    // preferáljuk azokat a csapatokat, ahol még nincs kapus és van hely
    let targetIdx = teams
      .map((t,i)=>({i,free:t.target - t.members.length, hasGoalie:t.hasGoalie}))
      .filter(x => x.free > 0 && !teams[x.i].hasGoalie)[0]?.i;

    if (targetIdx == null) {
      // fallback: az idx szerinti csapat vagy az első, ahol van hely
      targetIdx = (idx % teamCount);
      if (teams[targetIdx].members.length >= teams[targetIdx].target) {
        targetIdx = teams.map((t,i)=>({i,free:t.target-t.members.length})).find(x=>x.free>0)?.i ?? targetIdx;
      }
    }

    teams[targetIdx].members.push(g);
    teams[targetIdx].sum += g.skill;
    teams[targetIdx].hasGoalie = true;
  });

  // 2) Extra kapusok MEZŐNYKÉNT (ne növeljék a kapus-számot a csapatokban)
  const extraGoaliesAsField = goaliesAll.slice(teamCount).map(g => ({ ...g, is_goalie: 0 }));

  // 3) Maradék játékosok kiosztása skill szerinti greedy kiegyenlítéssel
  const rest = [...extraGoaliesAsField, ...fielders].sort((a,b)=>b.skill-a.skill);

  for (const p of rest) {
    // Kandidátok: ahol van hely
    let candidates = teams
      .map((t,i)=>({i, sum:t.sum, free:t.target - t.members.length, hasGoalie: t.hasGoalie}))
      .filter(x => x.free > 0);

    // Ha a játékos (még) kapus, preferáljuk a kapus nélküli csapatokat
    if (p.is_goalie) {
      const withoutGoalie = candidates.filter(c => !teams[c.i].hasGoalie);
      if (withoutGoalie.length) candidates = withoutGoalie;
    }

    // Legkisebb össz-skill + legnagyobb szabad hely előny
    candidates.sort((a,b)=> (a.sum - b.sum) || (b.free - a.free));
    if (!candidates.length) break;

    const tIdx = candidates[0].i;
    teams[tIdx].members.push(p);
    teams[tIdx].sum += p.skill;
    if (p.is_goalie) teams[tIdx].hasGoalie = true;
  }

  return { teams };
};
