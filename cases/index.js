const fs = require("fs");
const path = require("path");
const { assertValidCase } = require("./validateCase");

const CASES_DIR = __dirname;

function loadCases() {
  const files = fs.readdirSync(CASES_DIR).filter((f) => f.endsWith(".json"));
  const cases = {};
  for (const file of files) {
    const raw = fs.readFileSync(path.join(CASES_DIR, file), "utf8");
    const parsed = JSON.parse(raw);
    // Garantía de solvencia: un caso injusto/incoherente NO arranca el server.
    assertValidCase(parsed);
    cases[parsed.id] = parsed;
  }
  return cases;
}

const cases = loadCases();

function listCases() {
  return Object.values(cases).map((c) => ({
    id: c.id,
    title: c.title,
    language: c.language,
    difficulty: c.difficulty,
    synopsis: c.synopsis,
    setting: c.setting,
    victim: { name: c.victim.name, occupation: c.victim.occupation },
    suspectsCount: c.suspects.length,
  }));
}

function getCase(id) {
  return cases[id] || null;
}

function getPublicCaseView(id) {
  const c = getCase(id);
  if (!c) return null;
  return {
    id: c.id,
    title: c.title,
    language: c.language,
    difficulty: c.difficulty,
    synopsis: c.synopsis,
    setting: c.setting,
    victim: c.victim,
    suspects: c.suspects.map((s) => ({
      id: s.id,
      name: s.name,
      displayRole: s.displayRole,
      age: s.age,
      shortBio: s.shortBio,
      publicAlibi: s.publicAlibi,
    })),
    scenes: c.scenes.map((sc) => ({
      id: sc.id,
      name: sc.name,
      shortDescription: sc.shortDescription,
    })),
  };
}

module.exports = { listCases, getCase, getPublicCaseView };
