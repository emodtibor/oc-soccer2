const router = require("express").Router();
const ctrl = require("../controllers/matchesController");
const { asyncHandler } = require("../utils/http");

router.get("/", asyncHandler(ctrl.list));
router.post("/", asyncHandler(ctrl.create));
router.patch("/:id", asyncHandler(ctrl.update));
router.post("/:id/save-teams", asyncHandler(ctrl.saveTeams));
router.delete("/:id", asyncHandler(ctrl.remove));
//
// router.get("/:id/participants", asyncHandler(ctrl.participants));
// router.post("/:id/participants", asyncHandler(ctrl.setParticipants));
// router.get("/:id/teams", asyncHandler(ctrl.getTeams));
router.post("/:id/generate-teams", asyncHandler(ctrl.generateTeams));

module.exports = router;
