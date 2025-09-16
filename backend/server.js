const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const { runMigrations } = require("./db/migrations");

const db = new sqlite3.Database("./data/db.sqlite");

// migrációk lefuttatása induláskor
runMigrations(db)
  .then(() => {
    console.log("Migrations OK");

    const app = express();
    app.use(cors());
    app.use(bodyParser.json());

    // --- API route-ok ide (players, matches, stb.) ---
    // pl. app.get("/players", ...)

    const PORT = 3000;
    app.listen(PORT, () =>
      console.log(`Server running on port ${PORT}`)
    );
  })
  .catch((err) => {
    console.error("Migration error:", err);
    process.exit(1);
  });
