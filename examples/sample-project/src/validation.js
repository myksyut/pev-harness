// Event signup form — validation 純関数群
//
// 各 validator は (value) => string | null の signature。
// null = OK、 string = error message (日本語、 UI にそのまま表示)。
// validation.js は副作用なし。 DOM/Storage には触れない。

const PLAN_VALUES = ['standard', 'premium', 'student'];

export function validateName(value) {
  const trimmed = (value ?? '').trim();
  if (trimmed.length === 0) return '氏名は必須です';
  if (trimmed.length > 50) return '氏名は50文字以内で入力してください';
  return null;
}

export function validateEmail(value) {
  const trimmed = (value ?? '').trim();
  if (trimmed.length === 0) return 'メールアドレスは必須です';
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!pattern.test(trimmed)) return 'メールアドレスの形式が正しくありません';
  return null;
}

// 任意項目。 入力があればフォーマット検証する。
// 日本の電話番号: ハイフンあり/なし両対応、 数字のみ 10 or 11 桁。
export function validatePhone(value) {
  const trimmed = (value ?? '').trim();
  if (trimmed.length === 0) return null;
  const digits = trimmed.replace(/-/g, '');
  if (!/^\d{10,11}$/.test(digits)) return '電話番号は10桁または11桁の数字で入力してください';
  return null;
}

export function validatePlan(value) {
  if (!PLAN_VALUES.includes(value)) return 'プランを選択してください';
  return null;
}

export function validateAgreement(checked) {
  if (!checked) return '利用規約への同意が必要です';
  return null;
}

export function validateForm(data) {
  return {
    name: validateName(data.name),
    email: validateEmail(data.email),
    phone: validatePhone(data.phone),
    plan: validatePlan(data.plan),
    agreement: validateAgreement(data.agreement),
  };
}

export function hasErrors(errors) {
  return Object.values(errors).some((e) => e !== null);
}

export const PLANS = PLAN_VALUES;
