const router = require("express").Router();
const ctrl = require("../controllers/matchesController");
const { asyncHandler } = require("../utils/http");

console.log('generateTeams type:', typeof ctrl.list);
router.get("/", asyncHandler(ctrl.list));
console.log('generateTeams type:', typeof ctrl.create);
router.post("/", asyncHandler(ctrl.create));
console.log('generateTeams type:', typeof ctrl.remove);
router.delete("/:id", asyncHandler(ctrl.remove));

console.log('generateTeams type:', typeof ctrl.participants);
router.get("/:id/participants", asyncHandler(ctrl.participants));
console.log('generateTeams type:', typeof ctrl.setParticipants);
router.post("/:id/participants", asyncHandler(ctrl.setParticipants));
console.log('generateTeams type:', typeof ctrl.getTeams);
router.get("/:id/teams", asyncHandler(ctrl.getTeams));
console.log('generateTeams type:', typeof ctrl.generateTeams);
router.post("/:id/generate-teams", asyncHandler(ctrl.generateTeams));

module.exports = router;
