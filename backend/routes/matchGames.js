const router = require("express").Router();
const ctrl = require("../controllers/matchGamesController");
const { asyncHandler } = require("../utils/http");

router.get("/matches/:matchId/games", asyncHandler(ctrl.listByMatch));
router.post("/matches/:matchId/games", asyncHandler(ctrl.create));
router.post("/matches/:matchId/games/auto", asyncHandler(ctrl.createAuto));
router.post("/games/:gameId/goals", asyncHandler(ctrl.addGoal));
router.delete("/games/:gameId/goals/:goalId", asyncHandler(ctrl.deleteGoal));

module.exports = router;
