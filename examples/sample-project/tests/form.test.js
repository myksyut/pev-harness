import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  STORAGE_KEY,
  loadSubmissions,
  saveSubmission,
  submitWithDelay,
  buildSubmitHandler,
} from '../src/form.js';

function createMockStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
    _map: map,
  };
}

describe('loadSubmissions', () => {
  it('未保存 state は [] を返す', () => {
    const storage = createMockStorage();
    expect(loadSubmissions(storage)).toEqual([]);
  });

  it('JSON parse 失敗時は [] を返す (例: 不正な文字列が紛れ込んでも crash しない)', () => {
    const storage = createMockStorage();
    storage.setItem(STORAGE_KEY, 'not json');
    expect(loadSubmissions(storage)).toEqual([]);
  });

  it('object (array でない) が入っていても [] にフォールバック', () => {
    const storage = createMockStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ unexpected: true }));
    expect(loadSubmissions(storage)).toEqual([]);
  });
});

describe('saveSubmission', () => {
  it('submittedAt を付与して append 保存される', () => {
    const storage = createMockStorage();
    const before = Date.now();
    const entry = saveSubmission(storage, { name: 'A', email: 'a@b.c' });
    expect(entry.name).toBe('A');
    expect(entry.submittedAt).toBeDefined();
    expect(new Date(entry.submittedAt).getTime()).toBeGreaterThanOrEqual(before);

    const all = loadSubmissions(storage);
    expect(all).toHaveLength(1);
    expect(all[0].email).toBe('a@b.c');
  });

  it('複数 submission は順序を保って append される', () => {
    const storage = createMockStorage();
    saveSubmission(storage, { name: 'A' });
    saveSubmission(storage, { name: 'B' });
    saveSubmission(storage, { name: 'C' });
    expect(loadSubmissions(storage).map((s) => s.name)).toEqual(['A', 'B', 'C']);
  });
});

describe('submitWithDelay', () => {
  it('delayMs 後に save される', async () => {
    vi.useFakeTimers();
    const storage = createMockStorage();
    const promise = submitWithDelay(storage, { name: 'A' }, 100);
    expect(loadSubmissions(storage)).toEqual([]);
    await vi.advanceTimersByTimeAsync(100);
    await promise;
    expect(loadSubmissions(storage)).toHaveLength(1);
    vi.useRealTimers();
  });
});

describe('buildSubmitHandler', () => {
  const valid = {
    name: '山田',
    email: 'y@example.com',
    phone: '',
    plan: 'standard',
    agreement: true,
  };

  function makeContext(overrides = {}) {
    const setErrors = vi.fn();
    const setSubmitting = vi.fn();
    const onSuccess = vi.fn();
    const storage = createMockStorage();
    const getFormData = vi.fn(() => valid);
    const handler = buildSubmitHandler({
      getFormData,
      setErrors,
      setSubmitting,
      onSuccess,
      storage,
      delayMs: 0,
      ...overrides,
    });
    return { handler, setErrors, setSubmitting, onSuccess, storage, getFormData };
  }

  it('正常 submit: validation pass → saveSubmission → onSuccess', async () => {
    const ctx = makeContext();
    const ev = { preventDefault: vi.fn() };
    await ctx.handler(ev);
    expect(ev.preventDefault).toHaveBeenCalled();
    expect(ctx.setErrors).toHaveBeenCalledWith(expect.objectContaining({ name: null, email: null }));
    expect(ctx.setSubmitting).toHaveBeenNthCalledWith(1, true);
    expect(ctx.setSubmitting).toHaveBeenNthCalledWith(2, false);
    expect(ctx.onSuccess).toHaveBeenCalledOnce();
    expect(loadSubmissions(ctx.storage)).toHaveLength(1);
  });

  it('validation 失敗時は save も onSuccess も呼ばれない', async () => {
    const ctx = makeContext({ getFormData: () => ({ ...valid, email: 'bad' }) });
    await ctx.handler({ preventDefault: () => {} });
    expect(ctx.onSuccess).not.toHaveBeenCalled();
    expect(ctx.setSubmitting).not.toHaveBeenCalled();
    expect(loadSubmissions(ctx.storage)).toHaveLength(0);
  });

  it('二重送信防止: submit 中の再 invoke は無視', async () => {
    const ctx = makeContext({ delayMs: 50 });
    vi.useFakeTimers();
    const ev1 = { preventDefault: vi.fn() };
    const ev2 = { preventDefault: vi.fn() };
    const p1 = ctx.handler(ev1);
    const p2 = ctx.handler(ev2); // 即座に再 click
    await vi.advanceTimersByTimeAsync(50);
    await Promise.all([p1, p2]);
    expect(ctx.onSuccess).toHaveBeenCalledOnce();
    expect(loadSubmissions(ctx.storage)).toHaveLength(1);
    vi.useRealTimers();
  });
});
