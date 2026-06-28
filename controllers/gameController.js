const asyncHandler = require("express-async-handler");
const GameSession = require("../model/GameSessionModel");
const { listCases, getCase, getPublicCaseView } = require("../cases");
const { interrogate, exploreObject } = require("../services/detectiveService");

const getCases = asyncHandler(async (req, res) => {
  res.json({ cases: listCases() });
});

const getCaseById = asyncHandler(async (req, res) => {
  const view = getPublicCaseView(req.params.id);
  if (!view) {
    res.status(404);
    throw new Error("Caso no encontrado");
  }
  res.json(view);
});

const startSession = asyncHandler(async (req, res) => {
  const { caseId } = req.body;
  const caseData = getCase(caseId);
  if (!caseData) {
    res.status(404);
    throw new Error("Caso no encontrado");
  }
  const session = await GameSession.create({
    caseId,
    userId: req.user?._id || null,
  });
  res.status(201).json({
    sessionId: session._id,
    case: getPublicCaseView(caseId),
    status: session.status,
    discoveredClueIds: [],
    exploredObjectIds: [],
  });
});

const getSession = asyncHandler(async (req, res) => {
  const session = await GameSession.findById(req.params.id);
  if (!session) {
    res.status(404);
    throw new Error("Sesión no encontrada");
  }
  const caseData = getCase(session.caseId);
  const interrogations = {};
  for (const [suspectId, turns] of session.interrogations.entries()) {
    interrogations[suspectId] = turns;
  }
  res.json({
    sessionId: session._id,
    case: getPublicCaseView(session.caseId),
    status: session.status,
    discoveredClueIds: session.discoveredClueIds,
    discoveredClues: caseData.clues.filter((c) => session.discoveredClueIds.includes(c.id)),
    exploredObjectIds: session.exploredObjectIds,
    interrogations,
    accusedSuspectId: session.accusedSuspectId,
  });
});

const interrogateSuspect = asyncHandler(async (req, res) => {
  const { suspectId, message } = req.body;
  if (!suspectId || !message) {
    res.status(400);
    throw new Error("suspectId y message son requeridos");
  }
  const session = await GameSession.findById(req.params.id);
  if (!session) {
    res.status(404);
    throw new Error("Sesión no encontrada");
  }
  if (session.status !== "active") {
    res.status(409);
    throw new Error("La partida ya terminó");
  }
  const caseData = getCase(session.caseId);
  const suspect = caseData.suspects.find((s) => s.id === suspectId);
  if (!suspect) {
    res.status(404);
    throw new Error("Sospechoso no encontrado");
  }

  const history = session.interrogations.get(suspectId) || [];
  const sessionState = { discoveredClueIds: session.discoveredClueIds };

  const result = await interrogate({
    caseData,
    suspect,
    sessionState,
    history: history.map((h) => ({ role: h.role, content: h.content })),
    userMessage: message,
  });

  history.push({ role: "user", content: message, revealedClueIds: [], at: new Date() });
  history.push({
    role: "assistant",
    content: result.text,
    revealedClueIds: result.revealedClueIds,
    at: new Date(),
  });
  session.interrogations.set(suspectId, history);

  const newClues = [];
  for (const id of result.revealedClueIds) {
    if (!session.discoveredClueIds.includes(id)) {
      session.discoveredClueIds.push(id);
      const clue = caseData.clues.find((c) => c.id === id);
      if (clue) newClues.push(clue);
    }
  }
  await session.save();

  res.json({
    reply: result.text,
    revealedClueIds: result.revealedClueIds,
    newClues,
    discoveredClueIds: session.discoveredClueIds,
  });
});

const exploreScene = asyncHandler(async (req, res) => {
  const { sceneId, objectId } = req.body;
  const session = await GameSession.findById(req.params.id);
  if (!session) {
    res.status(404);
    throw new Error("Sesión no encontrada");
  }
  if (session.status !== "active") {
    res.status(409);
    throw new Error("La partida ya terminó");
  }
  const caseData = getCase(session.caseId);
  const scene = caseData.scenes.find((s) => s.id === sceneId);
  if (!scene) {
    res.status(404);
    throw new Error("Escena no encontrada");
  }

  if (!objectId) {
    res.json({
      scene: {
        id: scene.id,
        name: scene.name,
        fullDescription: scene.fullDescription,
        objects: scene.objects.map((o) => ({ id: o.id, name: o.name })),
      },
    });
    return;
  }

  const object = scene.objects.find((o) => o.id === objectId);
  if (!object) {
    res.status(404);
    throw new Error("Objeto no encontrado");
  }

  const result = exploreObject({
    caseData,
    scene,
    object,
    sessionState: { discoveredClueIds: session.discoveredClueIds },
  });

  const objectKey = `${sceneId}:${objectId}`;
  if (!session.exploredObjectIds.includes(objectKey)) {
    session.exploredObjectIds.push(objectKey);
  }
  let newClue = null;
  if (result.revealedClueId && !session.discoveredClueIds.includes(result.revealedClueId)) {
    session.discoveredClueIds.push(result.revealedClueId);
    newClue = caseData.clues.find((c) => c.id === result.revealedClueId);
  }
  await session.save();

  res.json({
    object: { id: object.id, name: object.name },
    observation: result.observation,
    newClue,
    discoveredClueIds: session.discoveredClueIds,
  });
});

const accuse = asyncHandler(async (req, res) => {
  const { suspectId } = req.body;
  if (!suspectId) {
    res.status(400);
    throw new Error("suspectId requerido");
  }
  const session = await GameSession.findById(req.params.id);
  if (!session) {
    res.status(404);
    throw new Error("Sesión no encontrada");
  }
  if (session.status !== "active") {
    res.status(409);
    throw new Error("La partida ya terminó");
  }
  const caseData = getCase(session.caseId);
  const suspect = caseData.suspects.find((s) => s.id === suspectId);
  if (!suspect) {
    res.status(404);
    throw new Error("Sospechoso no encontrado");
  }

  const correct = caseData.killerId === suspectId;
  session.status = correct ? "won" : "lost";
  session.accusedSuspectId = suspectId;
  session.finishedAt = new Date();
  await session.save();

  res.json({
    correct,
    accusedSuspect: { id: suspect.id, name: suspect.name },
    killer: {
      id: caseData.killerId,
      name: caseData.suspects.find((s) => s.id === caseData.killerId).name,
    },
    solution: caseData.solution,
    status: session.status,
  });
});

module.exports = {
  getCases,
  getCaseById,
  startSession,
  getSession,
  interrogateSuspect,
  exploreScene,
  accuse,
};
