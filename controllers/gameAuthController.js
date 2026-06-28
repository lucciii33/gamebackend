const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const asyncHandler = require("express-async-handler");
const User = require("../model/userModel");
const {
  validatePasswordStrength,
  hashPassword,
} = require("../services/passwordPolicy");

function gameToken(userId) {
  return jwt.sign(
    { id: userId, scope: "game" },
    process.env.JWT_SECRET_NODE,
    { expiresIn: "30d" },
  );
}

function publicUser(user) {
  return {
    _id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    token: gameToken(user._id),
  };
}

const registerGameUser = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  const normalizedEmail = email ? email.toLowerCase().trim() : "";
  const cleanFirstName = (firstName || "").trim();
  const cleanLastName = (lastName || cleanFirstName || "Detective").trim();

  if (!cleanFirstName || !normalizedEmail || !password) {
    res.status(400);
    throw new Error("Nombre, email y password son requeridos.");
  }
  if (!normalizedEmail.includes("@") || !normalizedEmail.includes(".")) {
    res.status(400);
    throw new Error("Email inválido.");
  }

  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    res.status(400);
    throw new Error(passwordError);
  }

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    res.status(400);
    throw new Error("Ya existe una cuenta con ese email. Usa Login.");
  }

  const hashedPassword = await hashPassword(password);
  const user = await User.create({
    firstName: cleanFirstName,
    lastName: cleanLastName,
    email: normalizedEmail,
    password: hashedPassword,
    terms: true,
    passwordHistory: [{ hash: hashedPassword, changedAt: new Date() }],
    passwordChangedAt: new Date(),
  });

  res.status(201).json(publicUser(user));
});

const loginGameUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = email ? email.toLowerCase().trim() : "";
  if (!normalizedEmail || !password) {
    res.status(400);
    throw new Error("Email y password son requeridos.");
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (!user || !user.password) {
    res.status(400);
    throw new Error("Email o password inválido.");
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    res.status(400);
    throw new Error("Email o password inválido.");
  }

  res.json(publicUser(user));
});

module.exports = {
  registerGameUser,
  loginGameUser,
};
