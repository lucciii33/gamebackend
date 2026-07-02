const express = require("express");
const router = express.Router();
const { protectGame } = require("../middleware/gameAuthMiddleware");
const {
  getCases,
  getCaseById,
  getProgress,
  startSession,
  getSession,
  interrogateSuspect,
  exploreScene,
  accuse,
} = require("../controllers/gameController");

router.use(protectGame);

router.get("/cases", getCases);
router.get("/progress", getProgress);
router.get("/cases/:id", getCaseById);
router.post("/sessions", startSession);
router.get("/sessions/:id", getSession);
router.post("/sessions/:id/interrogate", interrogateSuspect);
router.post("/sessions/:id/explore", exploreScene);
router.post("/sessions/:id/accuse", accuse);

module.exports = router;
