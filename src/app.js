import { DEFAULT_POLICY, evolvePolicy, routePrompt } from "./policy.js";

const STORAGE = "astra-qroute-v1";
const state = loadState();
const $ = (id) => document.getElementById(id);

function loadState() {
  try { return JSON.parse(localStorage.getItem(STORAGE)) || seedState(); }
  catch { return seedState(); }
}

function seedState() {
  return { episodes: [], policy: DEFAULT_POLICY, cycles: 0, learning: false, lastCycle: null };
}

function saveState() {
  localStorage.setItem(STORAGE, JSON.stringify(state));
  render();
}

function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  setTimeout(() => $("toast").classList.remove("show"), 2400);
}

function recordEpisode(prompt, route, outcome = "active") {
  state.episodes.push({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    prompt,
    selectedRoute: route.id,
    expectedRoute: route.id,
    outcome
  });
  state.episodes = state.episodes.slice(-500);
  saveState();
}

function render() {
  $("episode-count").textContent = `${state.episodes.length} record${state.episodes.length === 1 ? "" : "s"}`;
  $("policy-version").textContent = `v${state.policy.version}`;
  $("cycle-count").textContent = state.cycles;
  $("last-cycle").textContent = state.lastCycle ? new Date(state.lastCycle).toLocaleTimeString() : "Never";
  $("learning-toggle").checked = state.learning;
  $("policy-data").textContent = JSON.stringify(state.policy.weights, null, 2);
  $("episode-list").innerHTML = state.episodes.slice(-12).reverse().map((episode) =>
    `<div class="episode"><strong>${escapeHtml(episode.selectedRoute)}</strong><span>${escapeHtml(episode.prompt)}</span></div>`
  ).join("");
}

function escapeHtml(value) {
  const node = document.createElement("span");
  node.textContent = value;
  return node.innerHTML;
}

function runPrompt() {
  const prompt = $("prompt").value.trim();
  if (!prompt) return toast("Enter a command");
  const route = routePrompt(prompt, state.policy);
  $("route-result").textContent = `${route.label} (${route.id}) · confidence score ${route.score}`;
  recordEpisode(prompt, route);
  $("health-text").textContent = "ROUTING";
  setTimeout(() => $("health-text").textContent = "ONLINE", 900);
}

function validateQasm(source) {
  const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return { valid: false, message: "QASM source is empty." };
  const header = lines.find((line) => /^OPENQASM\s+\d+(\.\d+)?;?$/i.test(line));
  if (!header) return { valid: false, message: "Missing OPENQASM version declaration." };
  return { valid: true, message: `${lines.length} lines parsed · ${lines.filter((line) => /^qreg\s+/i.test(line)).length} quantum register declaration(s)` };
}

const SAMPLE_QASM = "OPENQASM 2.0;\ninclude \"qelib1.inc\";\nqreg q[2];\ncreg c[2];\nh q[0];\ncx q[0], q[1];\nmeasure q -> c;";
$("sample").addEventListener("click", () => { $("qasm").value = SAMPLE_QASM; });
$("validate-qasm").addEventListener("click", () => {
  const result = validateQasm($("qasm").value);
  $("qasm-result").textContent = result.valid ? `VALID · ${result.message}` : `INVALID · ${result.message}`;
});
$("paste-qasm").addEventListener("click", async () => {
  try { $("qasm").value = await navigator.clipboard.readText(); toast("QASM pasted"); }
  catch { toast("Clipboard permission denied"); }
});
$("run").addEventListener("click", runPrompt);
$("prompt").addEventListener("keydown", (event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") runPrompt(); });

$("ask-puter").addEventListener("click", async () => {
  const prompt = $("prompt").value.trim();
  if (!prompt) return toast("Enter a task for Argon");
  const gateway = localStorage.getItem("astra-argon-gateway") || $("argon-gateway").value.trim() || "/api/argon";
  const tool = $("argon-tool").value;
  const argumentsByTool = {
    argon_delegate: { task: prompt },
    argon_compress: { content: prompt },
    argon_code: { instruction: prompt },
    argon_reason: { problem: prompt },
    argon_research: { query: prompt }
  };
  $("argon-gateway").value = gateway;
  localStorage.setItem("astra-argon-gateway", gateway);
  $("puter-response").textContent = "Argon is working...";
  $("puter-state").textContent = "Running";
  try {
    const response = await fetch(gateway, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool, arguments: argumentsByTool[tool] })
    });
    const data = await response.json().catch(() => ({ error: "Invalid gateway response" }));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    $("puter-response").textContent = typeof data.text === "string" ? data.text : JSON.stringify(data, null, 2);
    $("puter-state").textContent = "Connected";
    recordEpisode(prompt, { id: "puter" }, "argon-response");
  } catch (error) {
    $("puter-response").textContent = error.message;
    $("puter-state").textContent = "Unavailable";
    toast("Argon request failed");
  }
});

$("export-episodes").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), episodes: state.episodes }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = `astra-episodes-${Date.now()}.json`; link.click();
  URL.revokeObjectURL(url);
});
$("import-episodes").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    const episodes = Array.isArray(payload) ? payload : payload.episodes;
    if (!Array.isArray(episodes)) throw new Error("Expected an episodes array");
    state.episodes = [...episodes, ...state.episodes].slice(-500);
    saveState(); toast("Episodes imported");
  } catch (error) { toast(error.message); }
  event.target.value = "";
});

$("learning-toggle").addEventListener("change", (event) => {
  state.learning = event.target.checked;
  saveState(); toast(state.learning ? "Learning loop active" : "Learning loop paused");
});

setInterval(() => {
  if (!state.learning || state.episodes.length < 5) return;
  const candidate = evolvePolicy(state.policy, state.episodes);
  state.policy = candidate;
  state.cycles += 1;
  state.lastCycle = new Date().toISOString();
  saveState();
}, 60_000);

render();
$("health-text").textContent = "ONLINE";
