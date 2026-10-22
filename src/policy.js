export const DEFAULT_POLICY = Object.freeze({
  version: 1,
  weights: Object.freeze({
    keyword: 2.4,
    signal: 1.8,
    latency: 1.0,
    success: 2.0
  }),
  limits: Object.freeze({
    keyword: { min: 1.0, max: 4.0 },
    signal: { min: 0.5, max: 3.5 },
    latency: { min: 0.2, max: 2.0 },
    success: { min: 0.5, max: 3.5 }
  })
});

export const ROUTES = Object.freeze([
  Object.freeze({ id: "qasm", label: "QASM", keywords: ["qasm", "quantum", "circuit", "qubit", "gate", "bra-ket"], signals: ["execute", "simulate"] }),
  Object.freeze({ id: "export", label: "Episode export", keywords: ["episode", "export", "json", "history", "record"], signals: ["save", "download"] }),
  Object.freeze({ id: "puter", label: "Puter", keywords: ["puter", "cloud", "ai", "model", "chat"], signals: ["ask", "generate"] }),
  Object.freeze({ id: "assist", label: "Assistant", keywords: ["help", "explain", "route", "astrea", "astra"], signals: ["guide", "show"] })
]);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function normalizePolicy(policy) {
  const source = policy?.weights ? policy : DEFAULT_POLICY;
  const weights = {};
  for (const name of Object.keys(DEFAULT_POLICY.weights)) {
    const { min, max } = DEFAULT_POLICY.limits[name];
    weights[name] = clamp(Number(source.weights[name]) || DEFAULT_POLICY.weights[name], min, max);
  }
  return { version: Number(policy?.version) || 1, weights };
}

function containsAny(text, terms) {
  return terms.filter((term) => text.includes(term)).length;
}

export function scoreRoute(route, prompt, policy = DEFAULT_POLICY) {
  const weights = normalizePolicy(policy).weights;
  const text = String(prompt || "").trim().toLowerCase();
  const keywordMatches = containsAny(text, route.keywords);
  const signalMatches = containsAny(text, route.signals);
  const score = keywordMatches * weights.keyword
    + signalMatches * weights.signal;
  return { id: route.id, label: route.label, score };
}

export function routePrompt(prompt, policy = DEFAULT_POLICY) {
  const candidates = ROUTES.map((route) => scoreRoute(route, prompt, policy));
  candidates.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
  const best = candidates[0];
  if (best.score === 0) return { id: "assist", label: "Assistant", score: 0, candidates };
  return { ...best, candidates };
}

export function evolvePolicy(policy, episodes) {
  const current = normalizePolicy(policy);
  const next = { ...current.weights };
  let counted = 0;

  for (const episode of Array.isArray(episodes) ? episodes.slice(-100) : []) {
    const expected = episode?.expectedRoute;
    if (!ROUTES.some((route) => route.id === expected)) continue;
    const candidates = ROUTES.map((route) => scoreRoute(route, episode.prompt, current));
    const actual = candidates.sort((a, b) => b.score - a.score)[0]?.id;
    if (actual !== expected) {
      const route = ROUTES.find((item) => item.id === expected);
      const text = String(episode.prompt || "").toLowerCase();
      if (containsAny(text, route.keywords)) next.keyword += 0.02;
      if (containsAny(text, route.signals)) next.signal += 0.02;
      counted += 1;
    }
  }

  for (const name of Object.keys(next)) {
    const { min, max } = DEFAULT_POLICY.limits[name];
    next[name] = clamp(next[name], min, max);
  }
  return normalizePolicy({ version: current.version + 1, weights: next });
}
