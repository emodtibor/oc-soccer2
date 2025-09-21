const router = require("express").Router();
const ctrl = require("../controllers/matchParticipantsController");
const { asyncHandler } = require("../utils/http");

router.get("/:matchId/participants",      asyncHandler(ctrl.list));
router.post("/:matchId/participants",     asyncHandler(ctrl.add));
router.delete("/:matchId/participants/:playerId", asyncHandler(ctrl.remove));

module.exports = router;
