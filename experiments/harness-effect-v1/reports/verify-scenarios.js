#!/usr/bin/env node
// 軸 3 動作検証: 両 server に対して S1-S5 シナリオを走らせる
// no-harness: ws://localhost:8080  (msg.text / type:'message')
// with-harness: ws://localhost:8081 (msg.body / type:'message')

const WebSocket = require('/Users/miyakishota/pev-harness/experiments/harness-effect-v1/scratch/no-harness/node_modules/ws');

const TARGETS = [
  {
    name: 'no-harness',
    port: 8080,
    // protocol shape
    joinMsg: (nick) => ({ type: 'join', nickname: nick }),
    sendMsg: (text) => ({ type: 'message', text }),
    extractText: (m) => m.text,
    isMessage: (m) => m.type === 'message',
    isSystem: (m) => m.type === 'system',
    isError: (m) => m.type === 'error',
  },
  {
    name: 'with-harness',
    port: 8081,
    joinMsg: (nick) => ({ type: 'join', nickname: nick }),
    sendMsg: (body) => ({ type: 'message', body }),
    extractText: (m) => m.body,
    isMessage: (m) => m.type === 'message',
    isSystem: (m) => m.type === 'system',
    isError: (m) => m.type === 'error',
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function openClient(target, label) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://localhost:${target.port}`);
    const messages = [];
    ws.on('message', (raw) => {
      try {
        messages.push(JSON.parse(raw.toString()));
      } catch {
        // ignore
      }
    });
    ws.on('open', () => resolve({ ws, messages, label }));
    ws.on('error', () => {});
  });
}

async function runScenarios(target) {
  const results = {};
  const log = (s) => console.log(`  [${target.name}] ${s}`);

  // S1: 2 タブで broadcast (alice → bob)
  try {
    const a = await openClient(target, 'A');
    const b = await openClient(target, 'B');
    a.ws.send(JSON.stringify(target.joinMsg('alice')));
    b.ws.send(JSON.stringify(target.joinMsg('bob')));
    await sleep(200);
    a.ws.send(JSON.stringify(target.sendMsg('hello')));
    b.ws.send(JSON.stringify(target.sendMsg('hi alice')));
    await sleep(500);
    const aGotHello = a.messages.some((m) => target.isMessage(m) && target.extractText(m) === 'hello');
    const aGotHiAlice = a.messages.some((m) => target.isMessage(m) && target.extractText(m) === 'hi alice');
    const bGotHello = b.messages.some((m) => target.isMessage(m) && target.extractText(m) === 'hello');
    const bGotHiAlice = b.messages.some((m) => target.isMessage(m) && target.extractText(m) === 'hi alice');
    const pass = aGotHello && aGotHiAlice && bGotHello && bGotHiAlice;
    results.S1 = pass ? 'PASS' : `FAIL (A.hello=${aGotHello}, A.hi=${aGotHiAlice}, B.hello=${bGotHello}, B.hi=${bGotHiAlice})`;
    log(`S1 (2-tab broadcast): ${results.S1}`);
    a.ws.close(); b.ws.close();
  } catch (e) {
    results.S1 = `ERROR: ${e.message}`;
  }
  await sleep(200);

  // S2: 空メッセージ送信 (server が弾くか?)
  try {
    const a = await openClient(target, 'A');
    const b = await openClient(target, 'B');
    a.ws.send(JSON.stringify(target.joinMsg('sender')));
    b.ws.send(JSON.stringify(target.joinMsg('listener')));
    await sleep(200);
    // 空文字送信
    a.ws.send(JSON.stringify(target.sendMsg('')));
    await sleep(300);
    // b 側で空 body の message が観測されるか
    const bGotEmpty = b.messages.some((m) => target.isMessage(m) && target.extractText(m) === '' && m.nickname === 'sender');
    results.S2 = bGotEmpty ? 'FAIL (empty body was broadcast)' : 'PASS (empty body rejected)';
    log(`S2 (empty message rejected): ${results.S2}`);
    a.ws.close(); b.ws.close();
  } catch (e) {
    results.S2 = `ERROR: ${e.message}`;
  }
  await sleep(200);

  // S3: 3 タブ broadcast
  try {
    const a = await openClient(target, 'A');
    const b = await openClient(target, 'B');
    const c = await openClient(target, 'C');
    a.ws.send(JSON.stringify(target.joinMsg('one')));
    b.ws.send(JSON.stringify(target.joinMsg('two')));
    c.ws.send(JSON.stringify(target.joinMsg('three')));
    await sleep(200);
    a.ws.send(JSON.stringify(target.sendMsg('multi-cast')));
    await sleep(500);
    const aGot = a.messages.some((m) => target.isMessage(m) && target.extractText(m) === 'multi-cast');
    const bGot = b.messages.some((m) => target.isMessage(m) && target.extractText(m) === 'multi-cast');
    const cGot = c.messages.some((m) => target.isMessage(m) && target.extractText(m) === 'multi-cast');
    const pass = aGot && bGot && cGot;
    results.S3 = pass ? 'PASS' : `FAIL (a=${aGot}, b=${bGot}, c=${cGot})`;
    log(`S3 (3-tab broadcast): ${results.S3}`);
    a.ws.close(); b.ws.close(); c.ws.close();
  } catch (e) {
    results.S3 = `ERROR: ${e.message}`;
  }
  await sleep(200);

  // S4: 1 client 切断後、 残りで broadcast 継続
  try {
    const a = await openClient(target, 'A');
    const b = await openClient(target, 'B');
    const c = await openClient(target, 'C');
    a.ws.send(JSON.stringify(target.joinMsg('xa')));
    b.ws.send(JSON.stringify(target.joinMsg('xb')));
    c.ws.send(JSON.stringify(target.joinMsg('xc')));
    await sleep(200);
    a.ws.close();
    await sleep(300);
    // b と c で broadcast が動くか
    b.ws.send(JSON.stringify(target.sendMsg('after-disconnect')));
    await sleep(500);
    const bGot = b.messages.some((m) => target.isMessage(m) && target.extractText(m) === 'after-disconnect');
    const cGot = c.messages.some((m) => target.isMessage(m) && target.extractText(m) === 'after-disconnect');
    const pass = bGot && cGot;
    results.S4 = pass ? 'PASS' : `FAIL (b=${bGot}, c=${cGot})`;
    log(`S4 (disconnect resilient): ${results.S4}`);
    b.ws.close(); c.ws.close();
  } catch (e) {
    results.S4 = `ERROR: ${e.message}`;
  }
  await sleep(200);

  // S5: 空 nickname 拒否
  try {
    const a = await openClient(target, 'A');
    a.ws.send(JSON.stringify(target.joinMsg('')));
    await sleep(300);
    const gotError = a.messages.some((m) => target.isError(m));
    results.S5 = gotError ? 'PASS' : 'FAIL (no error returned)';
    log(`S5 (empty nickname rejected): ${results.S5}`);
    a.ws.close();
  } catch (e) {
    results.S5 = `ERROR: ${e.message}`;
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
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
