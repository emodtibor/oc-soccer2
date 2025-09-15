/* Lightweight SQLite migrator with versioning + checksum.
 * Files: db/migrations/V####__name.sql  (e.g., V0001__init.sql)
 * Table: schema_versions(version INTEGER PRIMARY KEY, name TEXT, checksum TEXT, applied_at TEXT)
 * Guards: transactional, checksum check, no version gaps.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();

const ROOT = path.join(__dirname, '..');
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'data', 'app.sqlite');
const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR || path.join(ROOT, 'db', 'migrations');
const ALLOW_EDITED = String(process.env.ALLOW_EDITED_MIGRATIONS || 'false').toLowerCase() === 'true';

function sha256(s){return crypto.createHash('sha256').update(s,'utf8').digest('hex');}
function openDb(){
  const db = new sqlite3.Database(DB_PATH);
  db.serialize(()=>{ db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;`); });
  return db;
}
function run(db, sql, params=[]){return new Promise((res,rej)=>db.run(sql,params,function(e){e?rej(e):res(this);}));}
function all(db, sql, params=[]){return new Promise((res,rej)=>db.all(sql,params,(e,r)=>e?rej(e):res(r)));}

function parseFilename(fname){
  const m = /^V(\d{4,})__(.+)\.sql$/i.exec(fname);
  if(!m) return null;
  return {version: parseInt(m[1],10), name: m[2]};
}

async function ensureSchemaTable(db){
  await run(db, `
    CREATE TABLE IF NOT EXISTS schema_versions (
      version     INTEGER PRIMARY KEY,
      name        TEXT NOT NULL,
      checksum    TEXT NOT NULL,
      applied_at  TEXT NOT NULL
    );
  `);
}

(async () => {
  if(!fs.existsSync(MIGRATIONS_DIR)){ console.log(`No migrations dir: ${MIGRATIONS_DIR}`); process.exit(0); }
  const db = openDb();
  try{
    await ensureSchemaTable(db);

    const appliedRows = await all(db, `SELECT version, name, checksum FROM schema_versions ORDER BY version;`);
    const applied = new Map(appliedRows.map(r => [r.version, r]));

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => /^V\d+__.+\.sql$/i.test(f))
      .sort((a,b)=>parseFilename(a).version - parseFilename(b).version);

    for(const f of files){
      const meta = parseFilename(f);
      const full = path.join(MIGRATIONS_DIR, f);
      const sql = fs.readFileSync(full,'utf8');
      const sum = sha256(sql);

      if(applied.has(meta.version)){
        const prev = applied.get(meta.version);
        if(prev.checksum !== sum){
          const msg = `Checksum mismatch at ${f}.
Applied: ${prev.checksum}
Now:     ${sum}
Set ALLOW_EDITED_MIGRATIONS=true to override (NOT recommended).`;
          if(!ALLOW_EDITED) throw new Error(msg);
          console.warn('! WARNING:', msg);
        }
        console.log(`• Skipped (already applied): ${f}`);
        continue;
      }

      // version gap guard
      const highest = applied.size ? Math.max(...applied.keys()) : 0;
      if(meta.version > highest + 1 && applied.size){
        throw new Error(`Version gap: highest=${highest}, next=${meta.version}`);
      }

      console.log(`→ Applying V${String(meta.version).padStart(4,'0')}__${meta.name}`);
      await run(db, 'BEGIN;');
      try{
        await run(db, sql);
        await run(db, `INSERT INTO schema_versions(version,name,checksum,applied_at) VALUES(?,?,?,datetime('now'));`,
          [meta.version, meta.name, sum]);
        await run(db, 'COMMIT;');
        console.log(`✔ Done: ${f}`);
        applied.set(meta.version, {version:meta.version, name:meta.name, checksum:sum});
      }catch(e){
        await run(db, 'ROLLBACK;');
        throw e;
      }
    }

    console.log('All migrations up to date.');
    db.close();
  }catch(e){
    console.error(e.message);
    db.close();
    process.exit(1);
  }
})();
