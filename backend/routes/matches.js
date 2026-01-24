const router = require("express").Router();
const ctrl = require("../controllers/matchesController");
const { asyncHandler } = require("../utils/http");

console.log('list type:', typeof ctrl.list);
router.get("/", asyncHandler(ctrl.list));
console.log('create type:', typeof ctrl.create);
router.post("/", asyncHandler(ctrl.create));
console.log('remove type:', typeof ctrl.remove);
router.delete("/:id", asyncHandler(ctrl.remove));

console.log('participants type:', typeof ctrl.participants);
router.get("/:id/participants", asyncHandler(ctrl.participants));
console.log('setParticipants type:', typeof ctrl.setParticipants);
router.post("/:id/participants", asyncHandler(ctrl.setParticipants));
console.log('getTeams type:', typeof ctrl.getTeams);
router.get("/:id/teams", asyncHandler(ctrl.getTeams));
console.log('generateTeams type:', typeof ctrl.generateTeams);
router.post("/:id/generate-teams", asyncHandler(ctrl.generateTeams));

module.exports = router;
