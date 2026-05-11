import { describe, it, expect } from 'vitest';
import { add, subtract } from '../src/index.js';

describe('add', () => {
  it('should return the sum of two positive numbers', () => {
    expect(add(2, 3)).toBe(5);
  });

  it('should return the sum of negative numbers', () => {
    expect(add(-1, -1)).toBe(-2);
  });
});

describe('subtract', () => {
  it('should return the difference of two positive numbers', () => {
    expect(subtract(5, 3)).toBe(2);
  });

  it('should return zero when subtracting equal negative numbers', () => {
    expect(subtract(-1, -1)).toBe(0);
  });
});
