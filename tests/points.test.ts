import { describe, expect, it } from 'vitest';
import { POINTS, scoreGame } from '../src/data/points';

describe('puntos de la cuenta', () => {
  it('suma los puntos por oleada al perder, sin premios', () => {
    expect(scoreGame('easy', 6, false, false)).toEqual({ waves: 12, victory: 0, firstClear: 0, total: 12 });
  });

  it('al ganar por primera vez suma la victoria y el premio de primera vez', () => {
    const { perWave, victory, firstClear } = POINTS.easy;
    expect(scoreGame('easy', 10, true, true).total).toBe(10 * perWave + victory + firstClear);
  });

  it('el premio de primera vez solo cuenta si se gana', () => {
    expect(scoreGame('hard', 4, false, true).firstClear).toBe(0);
  });

  it('en difícil se gana más que en fácil con el mismo resultado', () => {
    for (const [waves, won, first] of [[3, false, false], [10, true, false], [10, true, true]] as const) {
      expect(scoreGame('hard', waves, won, first).total).toBeGreaterThan(scoreGame('easy', waves, won, first).total);
    }
  });

  it('nunca da puntos negativos', () => {
    expect(scoreGame('easy', -1, false, false).total).toBe(0);
  });
});
