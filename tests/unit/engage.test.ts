import { describe, expect, it } from 'vitest';
import { choicesFor, niceAmount } from '@/resident/pages/Guess';

describe('guess the cost', () => {
  it('rounds to two significant figures', () => {
    expect(niceAmount(276_400_000)).toBe(280_000_000);
    expect(niceAmount(69_500_000)).toBe(70_000_000);
    expect(niceAmount(0)).toBe(0);
  });

  it('gives four different choices including the real one, the same for the same seed', () => {
    for (const amount of [276_400_000, 8_200_000_000, 1_250_000]) {
      const a = choicesFor(amount, 42);
      expect(a).toHaveLength(4);
      expect(new Set(a).size).toBe(4);
      expect(a).toContain(niceAmount(amount));
      expect(choicesFor(amount, 42)).toEqual(a);
    }
  });
});
