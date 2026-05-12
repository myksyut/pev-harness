const path = require('path');
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT) || 3000;
const MAX_NICKNAME = 32;
const MAX_MESSAGE = 2000;

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

function isBlank(s) {
  return typeof s !== 'string' || s.trim().length === 0;
}

function safeSend(ws, payload) {
  if (ws.readyState !== ws.OPEN) return;
  try {
    ws.send(JSON.stringify(payload));
  } catch {
    // ignore: peer likely gone
  }
}

function broadcast(payload, { skip } = {}) {
  const data = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client === skip) continue;
    if (!client.joined) continue;
    if (client.readyState !== client.OPEN) continue;
    try {
      client.send(data);
    } catch {
      // ignore
    }
  }
}

wss.on('connection', (ws) => {
  ws.joined = false;
  ws.nickname = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      safeSend(ws, { type: 'error', reason: 'invalid_json' });
      return;
    }

    if (!ws.joined) {
      if (msg.type !== 'join') {
        safeSend(ws, { type: 'error', reason: 'must_join_first' });
        return;
      }
      if (isBlank(msg.nickname)) {
        safeSend(ws, { type: 'error', reason: 'empty_nickname' });
        ws.close(1008, 'empty_nickname');
        return;
      }
      ws.nickname = msg.nickname.trim().slice(0, MAX_NICKNAME);
      ws.joined = true;
      safeSend(ws, { type: 'joined', nickname: ws.nickname });
      broadcast(
        { type: 'system', text: `${ws.nickname} が参加しました`, ts: Date.now() },
        { skip: ws },
      );
      return;
    }

    if (msg.type === 'message') {
      if (isBlank(msg.text)) {
        safeSend(ws, { type: 'error', reason: 'empty_message' });
        return;
      }
      const text = msg.text.trim().slice(0, MAX_MESSAGE);
      broadcast({
        type: 'message',
        nickname: ws.nickname,
        text,
        ts: Date.now(),
      });
      return;
    }

    safeSend(ws, { type: 'error', reason: 'unknown_type' });
  });

  ws.on('close', () => {
    if (ws.joined && ws.nickname) {
      broadcast({
        type: 'system',
        text: `${ws.nickname} が退室しました`,
        ts: Date.now(),
      });
    }
  });

  ws.on('error', () => {
    // suppress: 'close' handles cleanup
  });
});

server.listen(PORT, () => {
  console.log(`chat server listening on http://localhost:${PORT}`);
});
