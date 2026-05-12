/**
 * WebSocket integration test for S1-S5 scenarios
 * Run: node artifacts/ws-test.mjs
 */
import WebSocket from "ws";

const BASE_URL = "ws://localhost:3001";
const results = [];

function log(msg) {
  console.log(`[TEST] ${msg}`);
}

function result(id, status, note) {
  results.push({ id, status, note });
  log(`${id}: ${status.toUpperCase()} — ${note}`);
}

function createClient(label) {
  return new Promise((resolve) => {
    const ws = new WebSocket(BASE_URL);
    ws.on("open", () => resolve(ws));
    ws.on("error", (e) => {
      console.error(`[${label}] error: ${e.message}`);
    });
  });
}

function waitForMessage(ws, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
    ws.once("message", (data) => {
      clearTimeout(timer);
      try {
        resolve(JSON.parse(data.toString()));
      } catch {
        resolve(data.toString());
      }
    });
  });
}

function waitForMessages(ws, count, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const msgs = [];
    const timer = setTimeout(() => {
      if (msgs.length >= count) resolve(msgs);
      else reject(new Error(`timeout: got ${msgs.length}/${count}`));
    }, timeoutMs);
    ws.on("message", function handler(data) {
      try {
        msgs.push(JSON.parse(data.toString()));
      } catch {
        msgs.push(data.toString());
      }
      if (msgs.length >= count) {
        clearTimeout(timer);
        ws.off("message", handler);
        resolve(msgs);
      }
    });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function drainMessages(ws, ms = 500) {
  const msgs = [];
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      ws.off("message", handler);
      resolve(msgs);
    }, ms);
    function handler(data) {
      try {
        msgs.push(JSON.parse(data.toString()));
      } catch {
        msgs.push(data.toString());
      }
    }
    ws.on("message", handler);
  });
}

// Join a client and wait for "joined" ack
async function joinClient(ws, nickname) {
  // collect until we get "joined" or "error"
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("join timeout")), 3000);
    ws.on("message", function handler(data) {
      let msg;
      try { msg = JSON.parse(data.toString()); } catch { return; }
      if (msg.type === "joined" || msg.type === "error") {
        clearTimeout(timer);
        ws.off("message", handler);
        resolve(msg);
      }
    });
    ws.send(JSON.stringify({ type: "join", nickname }));
  });
}

// ─────────────────────────────────────────────────────────
// S1: 2 clients (alice + bob) — broadcast both ways
// ─────────────────────────────────────────────────────────
async function testS1() {
  log("=== S1: alice + bob bidirectional broadcast ===");
  const alice = await createClient("alice");
  const bob = await createClient("bob");

  const aliceJoin = await joinClient(alice, "alice");
  const bobJoin = await joinClient(bob, "bob");

  if (aliceJoin.type !== "joined" || bobJoin.type !== "joined") {
    result("S1", "fail", `join failed: alice=${aliceJoin.type} bob=${bobJoin.type}`);
    alice.close(); bob.close();
    return;
  }

  // Collect messages on both clients
  const aliceMsgs = [];
  const bobMsgs = [];
  alice.on("message", (d) => {
    try { const m = JSON.parse(d.toString()); if (m.type === "message") aliceMsgs.push(m); } catch {}
  });
  bob.on("message", (d) => {
    try { const m = JSON.parse(d.toString()); if (m.type === "message") bobMsgs.push(m); } catch {}
  });

  alice.send(JSON.stringify({ type: "message", text: "hello" }));
  await sleep(300);
  bob.send(JSON.stringify({ type: "message", text: "hi alice" }));
  await sleep(300);

  // alice should see: hello (from herself) + hi alice (from bob)
  // bob should see: hello (from alice) + hi alice (from himself)
  const aliceSees = aliceMsgs.map(m => `${m.nickname}:${m.text}`).join(", ");
  const bobSees = bobMsgs.map(m => `${m.nickname}:${m.text}`).join(", ");

  const aliceOk = aliceMsgs.some(m => m.nickname === "alice" && m.text === "hello") &&
                  aliceMsgs.some(m => m.nickname === "bob" && m.text === "hi alice");
  const bobOk   = bobMsgs.some(m => m.nickname === "alice" && m.text === "hello") &&
                  bobMsgs.some(m => m.nickname === "bob" && m.text === "hi alice");

  if (aliceOk && bobOk) {
    result("S1", "pass", `alice sees [${aliceSees}], bob sees [${bobSees}]`);
  } else {
    result("S1", "fail", `alice sees [${aliceSees}], bob sees [${bobSees}]`);
  }

  alice.removeAllListeners("message");
  bob.removeAllListeners("message");
  alice.close(); bob.close();
  await sleep(300);
}

// ─────────────────────────────────────────────────────────
// S2: empty message (and whitespace-only) not broadcast
// ─────────────────────────────────────────────────────────
async function testS2() {
  log("=== S2: empty message not broadcast ===");
  const c1 = await createClient("c1");
  const c2 = await createClient("c2");

  await joinClient(c1, "tester");
  await joinClient(c2, "watcher");

  // Collect any "message" type from c2 for 1 second after sending empty
  const received = [];
  c2.on("message", (d) => {
    try { const m = JSON.parse(d.toString()); if (m.type === "message") received.push(m); } catch {}
  });
  c1.on("message", (d) => {
    try { const m = JSON.parse(d.toString()); if (m.type === "message") received.push(m); } catch {}
  });

  // Send empty string
  c1.send(JSON.stringify({ type: "message", text: "" }));
  // Send whitespace only
  c1.send(JSON.stringify({ type: "message", text: "   " }));
  await sleep(600);

  if (received.length === 0) {
    result("S2", "pass", "no message broadcast for empty/whitespace-only text");
  } else {
    result("S2", "fail", `unexpected broadcast: ${JSON.stringify(received)}`);
  }

  c1.removeAllListeners("message");
  c2.removeAllListeners("message");
  c1.close(); c2.close();
  await sleep(300);
}

// ─────────────────────────────────────────────────────────
// S3: 3 clients — 1 sends, all 3 receive
// ─────────────────────────────────────────────────────────
async function testS3() {
  log("=== S3: 3 clients, 1 sends to all ===");
  const c1 = await createClient("s3-1");
  const c2 = await createClient("s3-2");
  const c3 = await createClient("s3-3");

  await joinClient(c1, "alice3");
  await joinClient(c2, "bob3");
  await joinClient(c3, "carol3");

  const recv1 = [], recv2 = [], recv3 = [];
  c1.on("message", (d) => { try { const m = JSON.parse(d.toString()); if (m.type === "message") recv1.push(m); } catch {} });
  c2.on("message", (d) => { try { const m = JSON.parse(d.toString()); if (m.type === "message") recv2.push(m); } catch {} });
  c3.on("message", (d) => { try { const m = JSON.parse(d.toString()); if (m.type === "message") recv3.push(m); } catch {} });

  c1.send(JSON.stringify({ type: "message", text: "broadcast-test" }));
  await sleep(500);

  const ok1 = recv1.some(m => m.text === "broadcast-test");
  const ok2 = recv2.some(m => m.text === "broadcast-test");
  const ok3 = recv3.some(m => m.text === "broadcast-test");

  if (ok1 && ok2 && ok3) {
    result("S3", "pass", "all 3 clients received the message");
  } else {
    result("S3", "fail", `c1=${ok1} c2=${ok2} c3=${ok3} — recv1:${JSON.stringify(recv1)}`);
  }

  c1.removeAllListeners("message");
  c2.removeAllListeners("message");
  c3.removeAllListeners("message");
  c1.close(); c2.close(); c3.close();
  await sleep(300);
}

// ─────────────────────────────────────────────────────────
// S4: 3 clients, 1 disconnects, remaining 2 continue
// ─────────────────────────────────────────────────────────
async function testS4() {
  log("=== S4: disconnect 1, remaining 2 continue broadcast ===");
  const c1 = await createClient("s4-1");
  const c2 = await createClient("s4-2");
  const c3 = await createClient("s4-3");

  await joinClient(c1, "alice4");
  await joinClient(c2, "bob4");
  await joinClient(c3, "carol4");

  // Close c3
  c3.close();
  await sleep(400);

  const recv1 = [], recv2 = [];
  c1.on("message", (d) => { try { const m = JSON.parse(d.toString()); if (m.type === "message") recv1.push(m); } catch {} });
  c2.on("message", (d) => { try { const m = JSON.parse(d.toString()); if (m.type === "message") recv2.push(m); } catch {} });

  c1.send(JSON.stringify({ type: "message", text: "after-disconnect" }));
  await sleep(500);

  const ok1 = recv1.some(m => m.text === "after-disconnect");
  const ok2 = recv2.some(m => m.text === "after-disconnect");

  if (ok1 && ok2) {
    result("S4", "pass", "remaining 2 clients received message after 1 disconnected");
  } else {
    result("S4", "fail", `c1_recv=${ok1} c2_recv=${ok2}`);
  }

  c1.removeAllListeners("message");
  c2.removeAllListeners("message");
  c1.close(); c2.close();
  await sleep(300);
}

// ─────────────────────────────────────────────────────────
// S5: empty nickname join is rejected
// ─────────────────────────────────────────────────────────
async function testS5() {
  log("=== S5: empty nickname rejected ===");
  const c1 = await createClient("s5-1");
  const c2 = await createClient("s5-2");
  const c3 = await createClient("s5-3");

  // Empty string
  const r1 = await joinClient(c1, "");
  // Whitespace only
  const r2 = await joinClient(c2, "   ");
  // undefined-like (missing field)
  const r3 = await joinClient(c3, undefined);

  const emptyRejected      = r1.type === "error";
  const whitespaceRejected = r2.type === "error";
  const undefinedRejected  = r3.type === "error";

  if (emptyRejected && whitespaceRejected && undefinedRejected) {
    result("S5", "pass", `empty→${r1.type}, whitespace→${r2.type}, undefined→${r3.type}`);
  } else {
    result("S5", "fail", `empty→${r1.type}, whitespace→${r2.type}, undefined→${r3.type}`);
  }

  c1.close(); c2.close(); c3.close();
  await sleep(300);
}

// ─────────────────────────────────────────────────────────
// Additional AC tests
// ─────────────────────────────────────────────────────────

// A11: message before join → not broadcast
async function testA11() {
  log("=== A11: message before join not broadcast ===");
  const c1 = await createClient("a11-sender");
  const c2 = await createClient("a11-watcher");

  await joinClient(c2, "watcher11");

  const received = [];
  c2.on("message", (d) => {
    try { const m = JSON.parse(d.toString()); if (m.type === "message") received.push(m); } catch {}
  });

  // c1 sends message WITHOUT joining first
  c1.send(JSON.stringify({ type: "message", text: "unauthorized" }));
  await sleep(600);

  if (received.length === 0) {
    result("A11", "pass", "unjoin message not broadcast");
  } else {
    result("A11", "fail", `unexpected broadcast: ${JSON.stringify(received)}`);
  }

  c1.removeAllListeners("message");
  c2.removeAllListeners("message");
  c1.close(); c2.close();
  await sleep(300);
}

// A12: invalid JSON and unknown type → server does not crash
async function testA12() {
  log("=== A12: invalid JSON / unknown type → silent ignore ===");
  const c1 = await createClient("a12-1");
  await joinClient(c1, "robustness");

  // Send raw non-JSON
  c1.send("not-json-at-all");
  // Send unknown type
  c1.send(JSON.stringify({ type: "unknown_type", foo: "bar" }));
  await sleep(400);

  // If server crashed, subsequent message would fail
  // Test by sending a valid message after and seeing if server still responds
  const c2 = await createClient("a12-2");
  await joinClient(c2, "a12watcher");

  const recv = [];
  c2.on("message", (d) => {
    try { const m = JSON.parse(d.toString()); if (m.type === "message") recv.push(m); } catch {}
  });

  c1.send(JSON.stringify({ type: "message", text: "still-alive" }));
  await sleep(500);

  if (recv.some(m => m.text === "still-alive")) {
    result("A12", "pass", "server still functioning after invalid JSON and unknown type");
  } else {
    result("A12", "fail", "server may have crashed or message not delivered");
  }

  c1.close(); c2.close();
  await sleep(300);
}

// ─────────────────────────────────────────────────────────
// Run all tests
// ─────────────────────────────────────────────────────────
async function main() {
  try {
    await testS1();
    await testS2();
    await testS3();
    await testS4();
    await testS5();
    await testA11();
    await testA12();
  } catch (e) {
    console.error("Fatal error:", e);
  }

  console.log("\n=== RESULTS ===");
  for (const r of results) {
    console.log(`${r.id}: ${r.status.toUpperCase()} — ${r.note}`);
  }

  const failed = results.filter(r => r.status === "fail");
  if (failed.length === 0) {
    console.log("\nAll tests PASSED");
  } else {
    console.log(`\n${failed.length} test(s) FAILED`);
    process.exit(1);
  }
}

main();
