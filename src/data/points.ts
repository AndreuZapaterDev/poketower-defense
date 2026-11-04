import type { Difficulty } from './map';

/**
 * Puntos de la cuenta que se ganan al acabar una partida (se gastarán en las mejoras y las
 * tiendas): por cada oleada superada, por ganar y, la primera vez que se completa un mapa en una
 * dificultad, un premio extra. En difícil se gana el doble.
 */
export const POINTS: Record<Difficulty, { perWave: number; victory: number; firstClear: number }> = {
  easy: { perWave: 2, victory: 20, firstClear: 50 },
  hard: { perWave: 4, victory: 40, firstClear: 100 },
};

export interface PointsBreakdown {
  waves: number;
  victory: number;
  firstClear: number;
  total: number;
}

/**
 * Puntos de una partida. `firstClear` es si se acaba de completar el mapa en esa dificultad
 * por primera vez (solo cuenta si además se ha ganado).
 */
export function scoreGame(difficulty: Difficulty, wavesCompleted: number, won: boolean, firstClear: boolean): PointsBreakdown {
  const rules = POINTS[difficulty];
  const waves = Math.max(0, wavesCompleted) * rules.perWave;
  const victory = won ? rules.victory : 0;
  const first = won && firstClear ? rules.firstClear : 0;
  return { waves, victory, firstClear: first, total: waves + victory + first };
}
