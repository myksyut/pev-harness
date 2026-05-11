// Sample project source (dog food fixture for pev-harness)
//
// add() / subtract() を実装済 state でコミット。
// unit test dog food 時 (v0.1-v0.6) は手動で TODO 状態に reset してから /pev で実装させる。
// E2E test dog food 時 (v1.4+) は index.html がこれらを import するので実装済 state が前提。
// multiply 等の新機能 dog food (v1.4+v1.5) は task ごとに追加して、 完了後 reset する。

export function add(a, b) {
  return a + b;
}

export function subtract(a, b) {
  return a - b;
}
