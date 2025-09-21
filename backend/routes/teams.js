const router = require("express").Router();
const ctrl = require("../controllers/teamsController");
const { asyncHandler } = require("../utils/http");

// Csapatok a meccsen
router.get("/:matchId/teams",                 asyncHandler(ctrl.list));
router.post("/:matchId/teams",                asyncHandler(ctrl.create));
router.delete("/:matchId/teams/:teamId",      asyncHandler(ctrl.remove));

// Tagkezelés
router.post("/:matchId/teams/:teamId/members",                      asyncHandler(ctrl.addMember));
router.delete("/:matchId/teams/:teamId/members/:playerId",          asyncHandler(ctrl.removeMember));

module.exports = router;
