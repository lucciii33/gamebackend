const {
  buildSuspectSystemPrompt,
  interrogate,
  _setClientForTests,
} = require("../services/detectiveService");

const caseData = {
  id: "case-test",
  title: "Caso de prueba",
  setting: {
    location: "Mansión",
    date: "Viernes",
    context: "Cena privada.",
  },
  victim: {
    name: "Víctima",
    age: 50,
    occupation: "Empresaria",
    causeOfDeath: "Veneno",
    timeOfDeath: "22:00",
    discoveredBy: "Mayordomo",
  },
  clues: [
    { id: "known", title: "Pista conocida", description: "El sospechoso sabe esto." },
    { id: "other", title: "Pista ajena", description: "Otro sospechoso sabe esto." },
  ],
  suspects: [
    {
      id: "ana",
      name: "Ana",
      displayRole: "Socia",
      age: 40,
      shortBio: "Seria.",
      publicAlibi: "Estaba en la biblioteca.",
      secretBackstory: "Oculta una deuda.",
      personalityPrompt: "Hablas con frialdad.",
      guilty: false,
      knowsAbout: [
        {
          clueId: "known",
          topic: "La deuda",
          triggerKeywords: ["deuda"],
          revealStrategy: "Revela solo si preguntan por deuda.",
        },
      ],
      hidesAbout: [],
    },
    {
      id: "bruno",
      name: "Bruno",
      displayRole: "Hermano",
      publicAlibi: "Estaba fuera.",
    },
  ],
};

afterEach(() => {
  _setClientForTests(null);
});

describe("detectiveService grounding", () => {
  it("construye un prompt con fuente de verdad y límites de invención", () => {
    const prompt = buildSuspectSystemPrompt(caseData, caseData.suspects[0], {
      discoveredClueIds: [],
    });

    expect(prompt).toContain("FUENTE DE VERDAD DEL CASO");
    expect(prompt).toContain("Prohibido crear nuevos sospechosos");
    expect(prompt).toContain("PISTAS QUE ESTE SOSPECHOSO PUEDE REVELAR");
    expect(prompt).toContain("known: Pista conocida");
    expect(prompt).not.toContain("other: Pista ajena — Otro sospechoso sabe esto.\n\n===========================================\nTEMAS QUE DEBES");
  });

  it("filtra clueIds inventados o no conocidos por el sospechoso", async () => {
    _setClientForTests({
      messages: {
        create: jest.fn().mockResolvedValue({
          content: [
            { type: "text", text: "Sé algo de esa deuda." },
            {
              type: "tool_use",
              name: "registrar_pistas_reveladas",
              input: { clueIds: ["known", "other", "fake"] },
            },
          ],
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
      },
    });

    const result = await interrogate({
      caseData,
      suspect: caseData.suspects[0],
      sessionState: { discoveredClueIds: [] },
      history: [],
      userMessage: "Háblame de la deuda.",
    });

    expect(result.text).toBe("Sé algo de esa deuda.");
    expect(result.revealedClueIds).toEqual(["known"]);
  });
});
