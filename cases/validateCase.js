/**
 * Validador de casos: garantiza que cada caso sea internamente consistente
 * y, sobre todo, RESOLUBLE de forma justa por el jugador.
 *
 * Un caso es "resoluble" si toda pista clave de la solución puede descubrirse
 * jugando: o bien la revela un objeto de una escena (revealsClueId), o bien
 * la conoce algún sospechoso (knowsAbout[].clueId).
 *
 * Se ejecuta al cargar los casos (falla rápido al arrancar) y como test.
 */

/** Conjunto de clueIds que el jugador PUEDE descubrir jugando. */
function discoverableClueIds(caseData) {
  const ids = new Set();
  for (const scene of caseData.scenes || []) {
    for (const obj of scene.objects || []) {
      if (obj.revealsClueId) ids.add(obj.revealsClueId);
    }
  }
  for (const suspect of caseData.suspects || []) {
    for (const k of suspect.knowsAbout || []) {
      if (k.clueId) ids.add(k.clueId);
    }
  }
  return ids;
}

/**
 * Valida un caso. Devuelve { valid, errors } sin lanzar.
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateCase(caseData) {
  const errors = [];
  const id = caseData?.id || "(sin id)";
  const push = (msg) => errors.push(`[${id}] ${msg}`);

  // --- Estructura mínima ---
  if (!caseData || typeof caseData !== "object") {
    return { valid: false, errors: ["Caso vacío o no es un objeto"] };
  }
  for (const field of ["id", "title", "killerId"]) {
    if (!caseData[field]) push(`Falta el campo obligatorio "${field}"`);
  }
  const suspects = Array.isArray(caseData.suspects) ? caseData.suspects : [];
  const scenes = Array.isArray(caseData.scenes) ? caseData.scenes : [];
  const clues = Array.isArray(caseData.clues) ? caseData.clues : [];
  if (suspects.length < 2) push("Debe haber al menos 2 sospechosos");
  if (clues.length < 1) push("Debe haber al menos 1 pista");

  // --- Ids únicos ---
  const clueIds = new Set();
  for (const c of clues) {
    if (!c.id) push("Hay una pista sin id");
    else if (clueIds.has(c.id)) push(`clueId duplicado: "${c.id}"`);
    else clueIds.add(c.id);
  }
  const suspectIds = new Set();
  for (const s of suspects) {
    if (!s.id) push("Hay un sospechoso sin id");
    else if (suspectIds.has(s.id)) push(`suspectId duplicado: "${s.id}"`);
    else suspectIds.add(s.id);
  }
  const sceneIds = new Set();
  for (const sc of scenes) {
    if (!sc.id) push("Hay una escena sin id");
    else if (sceneIds.has(sc.id)) push(`sceneId duplicado: "${sc.id}"`);
    else sceneIds.add(sc.id);
    const objIds = new Set();
    for (const o of sc.objects || []) {
      if (!o.id) push(`Escena "${sc.id}" tiene un objeto sin id`);
      else if (objIds.has(o.id)) push(`objectId duplicado en "${sc.id}": "${o.id}"`);
      else objIds.add(o.id);
      if (o.revealsClueId && !clueIds.has(o.revealsClueId)) {
        push(`Objeto "${sc.id}:${o.id}" revela clue inexistente "${o.revealsClueId}"`);
      }
    }
  }

  // --- Asesino y culpabilidad ---
  if (caseData.killerId && !suspectIds.has(caseData.killerId)) {
    push(`killerId "${caseData.killerId}" no corresponde a ningún sospechoso`);
  }
  const guilty = suspects.filter((s) => s.guilty === true);
  if (guilty.length !== 1) {
    push(`Debe haber exactamente 1 sospechoso con guilty:true (hay ${guilty.length})`);
  } else if (caseData.killerId && guilty[0].id !== caseData.killerId) {
    push(`El sospechoso guilty:true ("${guilty[0].id}") no coincide con killerId ("${caseData.killerId}")`);
  }

  // --- Referencias de knowsAbout ---
  for (const s of suspects) {
    for (const k of s.knowsAbout || []) {
      if (!k.clueId) push(`Sospechoso "${s.id}" tiene un knowsAbout sin clueId`);
      else if (!clueIds.has(k.clueId)) {
        push(`Sospechoso "${s.id}" conoce clue inexistente "${k.clueId}"`);
      }
      if (!Array.isArray(k.triggerKeywords) || k.triggerKeywords.length === 0) {
        push(`knowsAbout "${k.clueId}" de "${s.id}" no tiene triggerKeywords`);
      }
    }
  }

  // --- SOLVENCIA: toda keyClue debe existir y ser descubrible ---
  const solution = caseData.solution || {};
  const keyClues = Array.isArray(solution.keyClues) ? solution.keyClues : [];
  if (keyClues.length === 0) {
    push("solution.keyClues está vacío: el caso no define cómo se prueba la acusación");
  }
  const discoverable = discoverableClueIds(caseData);
  for (const k of keyClues) {
    if (!clueIds.has(k)) push(`keyClue "${k}" no existe en clues`);
    else if (!discoverable.has(k)) {
      push(`keyClue "${k}" NO es descubrible: ningún objeto ni sospechoso la revela (caso injusto)`);
    }
  }

  // --- Pistas huérfanas (existen pero nunca se pueden descubrir) ---
  for (const c of clues) {
    if (c.id && !discoverable.has(c.id)) {
      push(`Pista "${c.id}" no es descubrible por ningún medio (huérfana)`);
    }
  }

  // --- Umbral de victoria configurable ---
  const minKeyClues = caseData.winRequirements?.minKeyClues;
  if (minKeyClues != null) {
    if (typeof minKeyClues !== "number" || minKeyClues < 1) {
      push(`winRequirements.minKeyClues debe ser un número >= 1`);
    } else if (minKeyClues > keyClues.length) {
      push(`winRequirements.minKeyClues (${minKeyClues}) supera el número de keyClues (${keyClues.length})`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Igual que validateCase pero lanza si el caso es inválido. */
function assertValidCase(caseData) {
  const { valid, errors } = validateCase(caseData);
  if (!valid) {
    throw new Error(
      `Caso inválido "${caseData?.id || "?"}":\n  - ${errors.join("\n  - ")}`,
    );
  }
}

/** Nº mínimo de pistas clave que el jugador debe tener para poder acusar. */
function requiredKeyClues(caseData) {
  const keyClues = caseData.solution?.keyClues || [];
  const min = caseData.winRequirements?.minKeyClues;
  return typeof min === "number" ? min : keyClues.length;
}

module.exports = {
  validateCase,
  assertValidCase,
  discoverableClueIds,
  requiredKeyClues,
};
