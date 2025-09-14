const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
require("./db"); // init táblák

const playersRoutes = require("./routes/players");
const matchesRoutes = require("./routes/matches");

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.use("/players", playersRoutes);
app.use("/matches", matchesRoutes);

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
