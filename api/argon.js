const ALLOWED_TOOLS = new Set([
  "argon_delegate",
  "argon_compress",
  "argon_code",
  "argon_reason",
  "argon_research"
]);

export default async function handler(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (request.method === "OPTIONS") return response.status(204).end();
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });

  const key = process.env.ARGON_KEY;
  if (!key) return response.status(503).json({ error: "ARGON_KEY is not configured" });

  let payload;
  try { payload = typeof request.body === "string" ? JSON.parse(request.body) : request.body; }
  catch { return response.status(400).json({ error: "Invalid JSON" }); }

  if (!ALLOWED_TOOLS.has(payload?.tool)) return response.status(400).json({ error: "Unsupported Argon tool" });
  if (!payload.arguments || typeof payload.arguments !== "object") {
    return response.status(400).json({ error: "arguments must be an object" });
  }

  const upstream = await fetch("https://argon-mcp-live.puter.work/v1/run", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const text = await upstream.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { text }; }

  if (!upstream.ok) return response.status(upstream.status).json({ error: body.error || body.text || "Argon request failed" });
  return response.status(200).json(body);
}
