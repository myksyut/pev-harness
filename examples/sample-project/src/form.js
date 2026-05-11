// Event signup form — submission logic
//
// localStorage への永続化 + 二重送信防止 + submit handler 構築。
// validation は src/validation.js の純関数を経由するだけで、 ここでは行わない。

import { validateForm, hasErrors } from './validation.js';

export const STORAGE_KEY = 'pev-sample-submissions';

export function loadSubmissions(storage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSubmission(storage, submission) {
  const all = loadSubmissions(storage);
  const entry = { ...submission, submittedAt: new Date().toISOString() };
  all.push(entry);
  storage.setItem(STORAGE_KEY, JSON.stringify(all));
  return entry;
}

// async simulate (mock API)。 dog food task で実 fetch 化を依頼するときに差し替えやすい形にしておく。
export function submitWithDelay(storage, submission, delayMs = 0) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const entry = saveSubmission(storage, submission);
      resolve(entry);
    }, delayMs);
  });
}

// 二重送信防止 + validation を組み込んだ submit handler を返す。
// UI 側は handleSubmit を form の submit に bind するだけ。
export function buildSubmitHandler({
  getFormData,
  setErrors,
  setSubmitting,
  onSuccess,
  storage,
  delayMs = 300,
}) {
  let submitting = false;
  return async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    const data = getFormData();
    const errors = validateForm(data);
    setErrors(errors);
    if (hasErrors(errors)) return;
    submitting = true;
    setSubmitting(true);
    try {
      const entry = await submitWithDelay(storage, data, delayMs);
      onSuccess(entry);
    } finally {
      submitting = false;
      setSubmitting(false);
    }
  };
}
