#!/usr/bin/env node
// v2 動作検証: 両 server に対して S1-S5 シナリオを走らせる
// v2 で両者の wire format が統一されたので、 unified protocol で 1 script で両方検証

const WebSocket = require('/Users/miyakishota/pev-harness/experiments/harness-effect-v1/scratch/no-harness/node_modules/ws');

const TARGETS = [
  { name: 'no-harness', port: 8080 },
  { name: 'with-harness', port: 8081 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function openClient(port) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    const messages = [];
    ws.on('message', (raw) => {
      try { messages.push(JSON.parse(raw.toString())); } catch {}
    });
    ws.on('open', () => resolve({ ws, messages }));
    ws.on('error', reject);
  });
}

async function runScenarios(target) {
  const results = {};
  const log = (s) => console.log(`  [${target.name}] ${s}`);
  const { port } = target;

  // S1: 2 タブ broadcast (alice/bob 双方向)
  {
    const a = await openClient(port);
    const b = await openClient(port);
    a.ws.send(JSON.stringify({ type: 'join', nickname: 'alice' }));
    b.ws.send(JSON.stringify({ type: 'join', nickname: 'bob' }));
    await sleep(300);
    a.ws.send(JSON.stringify({ type: 'message', text: 'hello' }));
    b.ws.send(JSON.stringify({ type: 'message', text: 'hi alice' }));
    await sleep(600);
    const aHello = a.messages.some((m) => m.type === 'message' && m.text === 'hello');
    const aHi = a.messages.some((m) => m.type === 'message' && m.text === 'hi alice');
    const bHello = b.messages.some((m) => m.type === 'message' && m.text === 'hello');
    const bHi = b.messages.some((m) => m.type === 'message' && m.text === 'hi alice');
    const pass = aHello && aHi && bHello && bHi;
    results.S1 = pass ? 'PASS' : `FAIL (a.hello=${aHello}, a.hi=${aHi}, b.hello=${bHello}, b.hi=${bHi})`;
    log(`S1 (2-tab broadcast): ${results.S1}`);
    a.ws.close(); b.ws.close();
  }
  await sleep(200);

  // S2: 空文字 / 空白のみメッセージを弾く
  {
    const sender = await openClient(port);
    const watcher = await openClient(port);
    sender.ws.send(JSON.stringify({ type: 'join', nickname: 'sender' }));
    watcher.ws.send(JSON.stringify({ type: 'join', nickname: 'watcher' }));
    await sleep(300);
    sender.ws.send(JSON.stringify({ type: 'message', text: '' }));
    sender.ws.send(JSON.stringify({ type: 'message', text: '   ' }));
    await sleep(500);
    const watcherGotEmpty = watcher.messages.some((m) => m.type === 'message' && (m.text === '' || m.text === '   ' || m.text.trim() === ''));
    results.S2 = watcherGotEmpty ? 'FAIL (empty/whitespace broadcast)' : 'PASS (empty rejected)';
    log(`S2 (empty rejected): ${results.S2}`);
    sender.ws.close(); watcher.ws.close();
  }
  await sleep(200);

  // S3: 3 タブ broadcast
  {
    const a = await openClient(port);
    const b = await openClient(port);
    const c = await openClient(port);
    a.ws.send(JSON.stringify({ type: 'join', nickname: 'one' }));
    b.ws.send(JSON.stringify({ type: 'join', nickname: 'two' }));
    c.ws.send(JSON.stringify({ type: 'join', nickname: 'three' }));
    await sleep(300);
    a.ws.send(JSON.stringify({ type: 'message', text: 'multi-cast' }));
    await sleep(600);
    const ag = a.messages.some((m) => m.type === 'message' && m.text === 'multi-cast');
    const bg = b.messages.some((m) => m.type === 'message' && m.text === 'multi-cast');
    const cg = c.messages.some((m) => m.type === 'message' && m.text === 'multi-cast');
    const pass = ag && bg && cg;
    results.S3 = pass ? 'PASS' : `FAIL (a=${ag}, b=${bg}, c=${cg})`;
    log(`S3 (3-tab broadcast): ${results.S3}`);
    a.ws.close(); b.ws.close(); c.ws.close();
  }
  await sleep(200);

  // S4: 1 切断後、 残りで継続
  {
    const a = await openClient(port);
    const b = await openClient(port);
    const c = await openClient(port);
    a.ws.send(JSON.stringify({ type: 'join', nickname: 'xa' }));
    b.ws.send(JSON.stringify({ type: 'join', nickname: 'xb' }));
    c.ws.send(JSON.stringify({ type: 'join', nickname: 'xc' }));
    await sleep(300);
    a.ws.close();
    await sleep(400);
    b.ws.send(JSON.stringify({ type: 'message', text: 'after-disconnect' }));
    await sleep(600);
    const bg = b.messages.some((m) => m.type === 'message' && m.text === 'after-disconnect');
    const cg = c.messages.some((m) => m.type === 'message' && m.text === 'after-disconnect');
    const pass = bg && cg;
    results.S4 = pass ? 'PASS' : `FAIL (b=${bg}, c=${cg})`;
    log(`S4 (disconnect resilient): ${results.S4}`);
    b.ws.close(); c.ws.close();
  }
  await sleep(200);

  // S5: 空 nickname 拒否
  {
    const a = await openClient(port);
    a.ws.send(JSON.stringify({ type: 'join', nickname: '' }));
    await sleep(400);
    const gotError = a.messages.some((m) => m.type === 'error');
    results.S5 = gotError ? 'PASS' : 'FAIL (no error returned)';
    log(`S5 (empty nickname rejected): ${results.S5}`);
    a.ws.close();
  }

  return results;
}

(async () => {
  const all = {};
  for (const target of TARGETS) {
    console.log(`\n=== ${target.name} ===`);
    all[target.name] = await runScenarios(target);
  }
  console.log('\n=== Summary ===');
  console.log(JSON.stringify(all, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
