const express = require("express");
const router = express.Router();
const {
  registerGameUser,
  loginGameUser,
} = require("../controllers/gameAuthController");
const { authLimiter } = require("../middleware/rateLimiters");

router.post("/register", authLimiter, registerGameUser);
router.post("/login", authLimiter, loginGameUser);

module.exports = router;
