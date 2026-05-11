import { describe, it, expect } from 'vitest';
import { add } from '../src/index.js';

describe('add', () => {
  it('should return the sum of two positive numbers', () => {
    expect(add(2, 3)).toBe(5);
  });

  it('should return the sum of negative numbers', () => {
    expect(add(-1, -1)).toBe(-2);
  });
});
