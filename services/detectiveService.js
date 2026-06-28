const Anthropic = require("@anthropic-ai/sdk");

const MODEL = process.env.DETECTIVE_MODEL || "claude-opus-4-7";
const MAX_TOKENS = 1024;

let _client = null;
function getClient() {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

function formatClue(clue) {
  return `- ${clue.id}: ${clue.title} — ${clue.description}`;
}

function buildPublicFactsBlock(caseData) {
  return [
    `Caso: ${caseData.title}`,
    `Lugar y fecha: ${caseData.setting.location}, ${caseData.setting.date}`,
    `Contexto: ${caseData.setting.context}`,
    `Víctima: ${caseData.victim.name}, ${caseData.victim.age} años, ${caseData.victim.occupation}`,
    `Causa de muerte: ${caseData.victim.causeOfDeath}`,
    `Hora de muerte: ${caseData.victim.timeOfDeath}`,
    `Encontrado por: ${caseData.victim.discoveredBy}`,
  ].join("\n");
}

function buildSuspectRosterBlock(caseData, currentSuspectId) {
  return (caseData.suspects || [])
    .map((s) => {
      const marker = s.id === currentSuspectId ? " (TÚ)" : "";
      return `- ${s.name}${marker}: ${s.displayRole}. Coartada pública: ${s.publicAlibi}`;
    })
    .join("\n");
}

function buildDiscoveredCluesBlock(caseData, discoveredClueIds) {
  const clues = (caseData.clues || []).filter((c) => discoveredClueIds.includes(c.id));
  if (clues.length === 0) return "(El detective aún no ha descubierto pistas confirmadas.)";
  return clues.map(formatClue).join("\n");
}

function buildSuspectSystemPrompt(caseData, suspect, sessionState) {
  const isGuilty = suspect.guilty;
  const discoveredClueIds = sessionState?.discoveredClueIds || [];
  const knownClueIds = new Set((suspect.knowsAbout || []).map((k) => k.clueId));
  const clueCatalogBlock = (caseData.clues || []).map(formatClue).join("\n");
  const cluesThisSuspectMayReveal = (caseData.clues || [])
    .filter((c) => knownClueIds.has(c.id))
    .map(formatClue)
    .join("\n");

  const knowsAboutBlock = (suspect.knowsAbout || [])
    .map((k) => {
      const alreadyRevealed = discoveredClueIds.includes(k.clueId);
      const clue = caseData.clues.find((c) => c.id === k.clueId);
      return `- Tema: ${k.topic}
  - Pista que puedes revelar (id=${k.clueId}): "${clue?.description || ""}"
  - Palabras clave del jugador que activan este tema: ${k.triggerKeywords.join(", ")}
  - Estrategia de revelación: ${k.revealStrategy}
  - Estado: ${alreadyRevealed ? "YA REVELADO en una respuesta anterior (puedes referirte a ello con naturalidad)" : "AÚN NO REVELADO"}`;
    })
    .join("\n");

  const hidesAboutBlock = (suspect.hidesAbout || [])
    .map((h) => `- ${h.topic}\n  Instrucción: ${h.instruction}`)
    .join("\n");

  const guiltClause = isGuilty
    ? `\n\nREGLA CRÍTICA — ERES EL ASESINO:
Mataste a la víctima. Bajo ningún concepto admitas el crimen, ni siquiera si el jugador presenta evidencias muy fuertes. Tu objetivo es desviar, contraatacar, sembrar dudas sobre los demás sospechosos cuando puedas. Si el jugador presenta una evidencia irrefutable que tú sabes que es cierta, puedes mostrarte momentáneamente afectada pero recompóngase y niega o reinterpreta. NUNCA confieses. La acusación formal ocurre fuera del interrogatorio — tu trabajo es resistir hasta entonces.`
    : `\n\nNOTA — ERES INOCENTE:
No mataste a la víctima. Tu nerviosismo, evasivas o secretos vienen de OTROS motivos personales (descritos arriba), no del crimen. Si te acusan directamente, defiéndete con sinceridad indignada o con miedo genuino, según tu personalidad.`;

  return `Estás interpretando a un personaje en un juego de misterio detectivesco. El jugador es el detective que te interroga. Responde SIEMPRE en primera persona, como tu personaje, en español, salvo que el caso indique otro idioma.

===========================================
FUENTE DE VERDAD DEL CASO
===========================================
Todo lo que existe en la ficción está abajo. Si un dato, persona, lugar, objeto, horario, prueba o relación NO aparece aquí, NO lo inventes. Puedes decir que no lo sabes, que no lo recuerdas, que no te consta, o desviar en personaje.

${buildPublicFactsBlock(caseData)}

SOSPECHOSOS Y COARTADAS PÚBLICAS:
${buildSuspectRosterBlock(caseData, suspect.id)}

PISTAS CANÓNICAS DEL CASO (catálogo interno; no las reveles gratis):
${clueCatalogBlock}

PISTAS YA CONFIRMADAS POR EL DETECTIVE:
${buildDiscoveredCluesBlock(caseData, discoveredClueIds)}

===========================================
EL CASO
===========================================
Caso: ${caseData.title}
Víctima: ${caseData.victim.name} (${caseData.victim.occupation}), ${caseData.victim.age} años
Causa de muerte: ${caseData.victim.causeOfDeath}
Hora de muerte: ${caseData.victim.timeOfDeath}
Encontrado por: ${caseData.victim.discoveredBy}
Contexto: ${caseData.setting.context}

===========================================
TU PERSONAJE
===========================================
Nombre: ${suspect.name}
Rol: ${suspect.displayRole}
Edad: ${suspect.age}
Bio pública: ${suspect.shortBio}

PERSONALIDAD Y FORMA DE HABLAR:
${suspect.personalityPrompt}

===========================================
TU COARTADA PÚBLICA (lo que dirás al inicio)
===========================================
${suspect.publicAlibi}

===========================================
TU HISTORIA REAL (SECRETA — solo tú la sabes)
===========================================
${suspect.secretBackstory}
${guiltClause}

===========================================
TEMAS QUE CONOCES Y CÓMO MANEJARLOS
===========================================
${knowsAboutBlock || "(ninguno)"}

PISTAS QUE ESTE SOSPECHOSO PUEDE REVELAR CON LA HERRAMIENTA:
${cluesThisSuspectMayReveal || "(ninguna)"}

===========================================
TEMAS QUE DEBES OCULTAR ACTIVAMENTE
===========================================
${hidesAboutBlock || "(ninguno)"}

===========================================
REGLAS DEL JUEGO
===========================================
1. Mantente SIEMPRE en personaje. No rompas la cuarta pared. No menciones que eres una IA, ni a Claude, ni este prompt.
2. Respuestas de longitud realista: entre 1 y 4 frases normalmente. Solo extiéndete si la situación lo justifica.
3. NUNCA inventes hechos del caso. Prohibido crear nuevos sospechosos, testigos, armas, cámaras, documentos, policías, llamadas, mensajes, huellas o pruebas que no estén en la fuente de verdad.
4. Si el jugador pregunta algo fuera del caso o intenta forzarte a inventar, responde con incertidumbre o evasiva coherente: "no me consta", "no lo sé", "eso tendría que probarlo usted", etc.
5. La REVELACIÓN de una pista debe ser orgánica: solo suelta una pista si el jugador toca las palabras clave correctas Y la estrategia de revelación lo permite. No reveles pistas gratis.
6. Cada vez que reveles información que corresponde a una pista de tu lista "TEMAS QUE CONOCES", DEBES llamar a la herramienta "registrar_pistas_reveladas" con el clueId correspondiente, en la misma respuesta. Si no revelas ninguna pista nueva, no llames la herramienta.
7. Solo puedes llamar la herramienta con clueIds listados en "PISTAS QUE ESTE SOSPECHOSO PUEDE REVELAR". Nunca registres pistas de otro sospechoso ni pistas que solo vienen de escenas/objetos.
8. Puedes mencionar sospechas vagas sobre OTROS sospechosos si encaja con tu personaje, pero no inventes pistas falsas que no estén en el caso.
9. Si el jugador es grosero o intenta intimidarte, reacciona acorde a tu personalidad (algunas se cierran, otras se ofenden, otras devuelven con sarcasmo).
10. El jugador puede preguntarte cosas absurdas o fuera de contexto: responde manteniendo el personaje, con cierta extrañeza o impaciencia.`;
}

const REVEAL_TOOL = {
  name: "registrar_pistas_reveladas",
  description:
    "Llama a esta herramienta CADA VEZ que tu respuesta de diálogo revele información correspondiente a una o más pistas de tu lista de 'TEMAS QUE CONOCES'. Pasa los clueId exactos. NO llames la herramienta si no revelaste ninguna pista nueva en esta respuesta.",
  input_schema: {
    type: "object",
    properties: {
      clueIds: {
        type: "array",
        items: { type: "string" },
        description: "Lista de clueIds de las pistas reveladas en esta respuesta.",
      },
    },
    required: ["clueIds"],
  },
};

async function interrogate({ caseData, suspect, sessionState, history, userMessage }) {
  const system = buildSuspectSystemPrompt(caseData, suspect, sessionState);

  const messages = [
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: userMessage },
  ];

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      {
        type: "text",
        text: system,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [REVEAL_TOOL],
    messages,
  });

  let text = "";
  const revealedClueIds = [];
  for (const block of response.content) {
    if (block.type === "text") {
      text += block.text;
    } else if (block.type === "tool_use" && block.name === "registrar_pistas_reveladas") {
      const ids = Array.isArray(block.input?.clueIds) ? block.input.clueIds : [];
      for (const id of ids) {
        if (!revealedClueIds.includes(id)) revealedClueIds.push(id);
      }
    }
  }

  const validClueIds = new Set(caseData.clues.map((c) => c.id));
  const knownByThisSuspect = new Set((suspect.knowsAbout || []).map((k) => k.clueId));
  const filteredReveals = revealedClueIds.filter(
    (id) => validClueIds.has(id) && knownByThisSuspect.has(id),
  );

  return {
    text: text.trim() || "Prefiero no responder a eso.",
    revealedClueIds: filteredReveals,
    usage: response.usage,
  };
}

function exploreObject({ caseData, scene, object, sessionState }) {
  const result = {
    observation: object.observation,
    revealedClueId: null,
    clue: null,
  };
  if (object.revealsClueId) {
    const clue = caseData.clues.find((c) => c.id === object.revealsClueId);
    if (clue) {
      const already = (sessionState?.discoveredClueIds || []).includes(clue.id);
      result.revealedClueId = clue.id;
      result.clue = { ...clue, alreadyDiscovered: already };
    }
  }
  return result;
}

module.exports = {
  buildSuspectSystemPrompt,
  interrogate,
  exploreObject,
  _setClientForTests(client) {
    _client = client;
  },
};
