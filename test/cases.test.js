const fs = require("fs");
const path = require("path");
const { validateCase } = require("../cases/validateCase");

const CASES_DIR = path.join(__dirname, "..", "cases");

function loadRawCases() {
  return fs
    .readdirSync(CASES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(CASES_DIR, f), "utf8")));
}

describe("Solvencia de los casos reales", () => {
  const cases = loadRawCases();

  it("hay al menos un caso", () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  it.each(cases.map((c) => [c.id, c]))(
    "el caso '%s' es válido y resoluble",
    (_id, caseData) => {
      const { valid, errors } = validateCase(caseData);
      if (!valid) throw new Error(errors.join("\n"));
      expect(valid).toBe(true);
    },
  );
});

describe("El validador detecta casos injustos", () => {
  const base = () => ({
    id: "t",
    title: "t",
    killerId: "a",
    suspects: [
      { id: "a", guilty: true, knowsAbout: [] },
      { id: "b", guilty: false },
    ],
    scenes: [{ id: "s1", objects: [{ id: "o1", revealsClueId: "c1" }] }],
    clues: [{ id: "c1" }],
    solution: { keyClues: ["c1"] },
  });

  it("acepta un caso bien formado", () => {
    expect(validateCase(base()).valid).toBe(true);
  });

  it("rechaza una keyClue que no se puede descubrir", () => {
    const c = base();
    c.clues.push({ id: "c2" });
    c.solution.keyClues.push("c2");
    expect(validateCase(c).valid).toBe(false);
  });

  it("rechaza killerId que no es sospechoso", () => {
    const c = base();
    c.killerId = "zzz";
    expect(validateCase(c).valid).toBe(false);
  });

  it("rechaza si no hay exactamente un culpable", () => {
    const c = base();
    c.suspects[1].guilty = true;
    expect(validateCase(c).valid).toBe(false);
  });

  it("rechaza minKeyClues mayor que el número de keyClues", () => {
    const c = base();
    c.winRequirements = { minKeyClues: 5 };
    expect(validateCase(c).valid).toBe(false);
  });
});
