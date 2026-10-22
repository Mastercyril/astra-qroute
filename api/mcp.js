const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

export default async function handler(request, response) {
  for (const [name, value] of Object.entries(CORS_HEADERS)) response.setHeader(name, value);
  if (request.method === "OPTIONS") return response.status(204).end();

  const key = process.env.ARGON_KEY;
  if (!key) return response.status(503).json({ error: "ARGON_KEY is not configured" });

  const upstreamUrl = `https://argon-mcp-live.puter.work/mcp?key=${encodeURIComponent(key)}`;
  const headers = new Headers({ Accept: request.headers.accept || "application/json, text/event-stream" });
  const contentType = request.headers["content-type"];
  if (contentType) headers.set("Content-Type", contentType);

  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : JSON.stringify(request.body || {})
  });
  for (const name of ["content-type", "cache-control", "mcp-session-id"]) {
    const value = upstream.headers.get(name);
    if (value) response.setHeader(name, value);
  }
  response.status(upstream.status).send(await upstream.text());
}
