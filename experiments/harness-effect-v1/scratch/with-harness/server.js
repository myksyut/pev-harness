import { createServer } from "http";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { WebSocketServer } from "ws";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const MAX_MESSAGE_LENGTH = 1000;

// in-memory state
const clients = new Map(); // ws -> { nickname }

// --- helpers ---

function isValidNickname(str) {
  return typeof str === "string" && str.trim().length > 0;
}

function isValidMessage(str) {
  return typeof str === "string" && str.trim().length > 0 && str.trim().length <= MAX_MESSAGE_LENGTH;
}

function broadcast(data) {
  const payload = JSON.stringify(data);
  for (const [ws] of clients) {
    if (ws.readyState === ws.OPEN) {
      ws.send(payload);
    }
  }
}

// --- HTTP server (static file delivery) ---

const httpServer = createServer((req, res) => {
  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    try {
      const html = readFileSync(join(__dirname, "public", "index.html"));
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    } catch {
      res.writeHead(500);
      res.end("Internal Server Error");
    }
  } else {
    res.writeHead(404);
    res.end("Not Found");
  }
});

// --- WebSocket server ---

const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws) => {
  // Not joined yet; no entry in clients map

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      // A12: invalid JSON — silent ignore
      return;
    }

    if (!msg || typeof msg.type !== "string") {
      // A12: unexpected structure — silent ignore
      return;
    }

    switch (msg.type) {
      case "join": {
        // A9: validate nickname
        if (!isValidNickname(msg.nickname)) {
          ws.send(JSON.stringify({ type: "error", text: "ニックネームが無効です。空でない文字列を入力してください。" }));
          return;
        }
        // R2: ignore duplicate join from the same socket
        if (clients.has(ws)) {
          return;
        }
        const nickname = msg.nickname.trim();
        clients.set(ws, { nickname });

        // A14 (system message): join broadcast
        broadcast({ type: "system", text: `${nickname} が参加しました` });

        // Acknowledge join to the joining client
        ws.send(JSON.stringify({ type: "joined", nickname }));
        break;
      }

      case "message": {
        // A11: must be joined
        if (!clients.has(ws)) {
          return;
        }
        // A10: validate message body
        if (!isValidMessage(msg.text)) {
          return;
        }
        const { nickname } = clients.get(ws);
        const text = msg.text.trim();
        // A5/A6: broadcast to all clients including sender
        broadcast({ type: "message", nickname, text });
        break;
      }

      default:
        // A12: unknown type — silent ignore
        break;
    }
  });

  ws.on("close", () => {
    if (clients.has(ws)) {
      const { nickname } = clients.get(ws);
      clients.delete(ws);
      // A14 (system message): leave broadcast
      broadcast({ type: "system", text: `${nickname} が退室しました` });
    }
  });

  ws.on("error", () => {
    clients.delete(ws);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Chat server listening on http://localhost:${PORT}`);
});
