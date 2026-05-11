import { describe, it, expect } from 'vitest';
import {
  validateName,
  validateEmail,
  validatePhone,
  validatePlan,
  validateAgreement,
  validateForm,
  hasErrors,
} from '../src/validation.js';

describe('validateName', () => {
  it('正常: 1文字以上50文字以内', () => {
    expect(validateName('山田太郎')).toBeNull();
    expect(validateName('a'.repeat(50))).toBeNull();
  });

  it('空文字 / 空白のみ は拒否', () => {
    expect(validateName('')).toBe('氏名は必須です');
    expect(validateName('   ')).toBe('氏名は必須です');
    expect(validateName(null)).toBe('氏名は必須です');
    expect(validateName(undefined)).toBe('氏名は必須です');
  });

  it('51文字以上は拒否', () => {
    expect(validateName('a'.repeat(51))).toBe('氏名は50文字以内で入力してください');
  });
});

describe('validateEmail', () => {
  it('正常な email', () => {
    expect(validateEmail('user@example.com')).toBeNull();
    expect(validateEmail('user.name+tag@sub.example.co.jp')).toBeNull();
  });

  it('空は拒否', () => {
    expect(validateEmail('')).toBe('メールアドレスは必須です');
    expect(validateEmail('   ')).toBe('メールアドレスは必須です');
  });

  it('形式不正は拒否', () => {
    expect(validateEmail('not-an-email')).toBe('メールアドレスの形式が正しくありません');
    expect(validateEmail('user@')).toBe('メールアドレスの形式が正しくありません');
    expect(validateEmail('@example.com')).toBe('メールアドレスの形式が正しくありません');
    expect(validateEmail('user@example')).toBe('メールアドレスの形式が正しくありません');
  });
});

describe('validatePhone', () => {
  it('空は OK (任意項目)', () => {
    expect(validatePhone('')).toBeNull();
    expect(validatePhone('   ')).toBeNull();
    expect(validatePhone(null)).toBeNull();
  });

  it('ハイフンあり/なし 10-11 桁は OK', () => {
    expect(validatePhone('090-1234-5678')).toBeNull();
    expect(validatePhone('09012345678')).toBeNull();
    expect(validatePhone('03-1234-5678')).toBeNull();
    expect(validatePhone('0312345678')).toBeNull();
  });

  it('桁数不一致 / 数字以外は拒否', () => {
    expect(validatePhone('090-1234')).toBe('電話番号は10桁または11桁の数字で入力してください');
    expect(validatePhone('090-1234-56789')).toBe('電話番号は10桁または11桁の数字で入力してください');
    expect(validatePhone('abc-defg-hijk')).toBe('電話番号は10桁または11桁の数字で入力してください');
  });
});

describe('validatePlan', () => {
  it('許可リスト内は OK', () => {
    expect(validatePlan('standard')).toBeNull();
    expect(validatePlan('premium')).toBeNull();
    expect(validatePlan('student')).toBeNull();
  });

  it('未選択 / 不正値は拒否', () => {
    expect(validatePlan('')).toBe('プランを選択してください');
    expect(validatePlan('vip')).toBe('プランを選択してください');
    expect(validatePlan(undefined)).toBe('プランを選択してください');
  });
});

describe('validateAgreement', () => {
  it('checked=true は OK', () => {
    expect(validateAgreement(true)).toBeNull();
  });

  it('checked=false は拒否', () => {
    expect(validateAgreement(false)).toBe('利用規約への同意が必要です');
    expect(validateAgreement(undefined)).toBe('利用規約への同意が必要です');
  });
});

describe('validateForm + hasErrors', () => {
  const valid = {
    name: '山田太郎',
    email: 'taro@example.com',
    phone: '',
    plan: 'standard',
    agreement: true,
  };

  it('正常データは hasErrors=false', () => {
    const errors = validateForm(valid);
    expect(hasErrors(errors)).toBe(false);
  });

  it('1 項目でも error があれば hasErrors=true', () => {
    const errors = validateForm({ ...valid, email: 'bad' });
    expect(hasErrors(errors)).toBe(true);
    expect(errors.email).toMatch(/メールアドレス/);
    expect(errors.name).toBeNull();
  });

  it('複数 error を独立に収集する', () => {
    const errors = validateForm({ name: '', email: '', phone: '123', plan: '', agreement: false });
    expect(errors.name).toBe('氏名は必須です');
    expect(errors.email).toBe('メールアドレスは必須です');
    expect(errors.phone).toMatch(/電話番号/);
    expect(errors.plan).toBe('プランを選択してください');
    expect(errors.agreement).toBe('利用規約への同意が必要です');
  });
});
