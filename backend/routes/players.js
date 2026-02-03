const router = require("express").Router();
const ctrl = require("../controllers/playersController");
const { asyncHandler } = require("../utils/http");

router.get("/", asyncHandler(ctrl.list));
router.post("/", asyncHandler(ctrl.create));
router.patch("/:id", asyncHandler(ctrl.update));
router.delete("/:id", asyncHandler(ctrl.remove));

module.exports = router;
