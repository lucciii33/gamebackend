const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const User = require("../model/userModel");

const protectGame = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    res.status(401);
    throw new Error("Not authorized, no token");
  }

  const token = header.split(" ")[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET_NODE);
  if (decoded.scope !== "game") {
    res.status(401);
    throw new Error("Token inválido para el juego");
  }

  req.user = await User.findById(decoded.id).select("_id email firstName lastName");
  if (!req.user) {
    res.status(401);
    throw new Error("Not authorized");
  }

  next();
});

module.exports = { protectGame };
