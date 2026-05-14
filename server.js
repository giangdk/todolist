const http = require("http");
const fs = require("fs/promises");
const path = require("path");

const PORT = Number(process.env.PORT || 5173);
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data", "sessions");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

function sanitizeSessionId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 64);
}

function getSessionFile(sessionId) {
  const safeId = sanitizeSessionId(sessionId);
  if (!safeId) return null;
  return path.join(DATA_DIR, `${safeId}.json`);
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function handleApi(req, res, pathname) {
  const match = pathname.match(/^\/api\/sessions\/([^/]+)\/tasks$/);
  if (!match) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  const sessionId = sanitizeSessionId(match[1]);
  const sessionFile = getSessionFile(sessionId);
  if (!sessionFile) {
    sendJson(res, 400, { error: "Invalid session id" });
    return;
  }

  if (req.method === "GET") {
    try {
      const content = await fs.readFile(sessionFile, "utf8");
      sendJson(res, 200, JSON.parse(content));
    } catch (error) {
      if (error.code === "ENOENT") {
        sendJson(res, 404, { error: "Session not found", sessionId });
        return;
      }
      sendJson(res, 500, { error: "Could not read session" });
    }
    return;
  }

  if (req.method === "PUT") {
    try {
      const body = JSON.parse(await readRequestBody(req));
      if (!Array.isArray(body.tasks)) {
        sendJson(res, 400, { error: "tasks must be an array" });
        return;
      }

      const payload = {
        sessionId,
        tasks: body.tasks,
        updatedAt: new Date().toISOString(),
      };

      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(sessionFile, JSON.stringify(payload, null, 2));
      sendJson(res, 200, payload);
    } catch {
      sendJson(res, 400, { error: "Invalid request body" });
    }
    return;
  }

  sendJson(res, 405, { error: "Method not allowed" });
}

async function serveStatic(req, res, pathname) {
  const safePath = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(ROOT_DIR, safePath === "/" ? "index.html" : safePath);

  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    const ext = path.extname(filePath);
    const content = await fs.readFile(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    await handleApi(req, res, url.pathname);
    return;
  }

  await serveStatic(req, res, url.pathname);
});

server.listen(PORT, () => {
  console.log(`Daily todolist server running at http://localhost:${PORT}`);
});
