import type { EnemyId } from './enemies';

export interface WaveGroup {
  enemy: EnemyId;
  count: number;
  /** Milisegundos entre cada enemigo del grupo */
  interval: number;
  /** Milisegundos desde el inicio de la oleada hasta que sale el grupo */
  delay?: number;
}

export const WAVES: WaveGroup[][] = [
  [{ enemy: 'rattata', count: 8, interval: 1000 }],
  [
    { enemy: 'rattata', count: 8, interval: 800 },
    { enemy: 'pidgey', count: 6, interval: 1100, delay: 3000 },
  ],
  [
    { enemy: 'oddish', count: 8, interval: 1000 },
    { enemy: 'rattata', count: 8, interval: 700, delay: 4000 },
  ],
  [
    { enemy: 'pidgey', count: 12, interval: 600 },
    { enemy: 'magikarp', count: 6, interval: 1000, delay: 3000 },
  ],
  [
    { enemy: 'geodude', count: 6, interval: 1500 },
    { enemy: 'rattata', count: 10, interval: 600, delay: 2000 },
    { enemy: 'golem', count: 1, interval: 0, delay: 10000 },
  ],
  [
    { enemy: 'magikarp', count: 12, interval: 800 },
    { enemy: 'raticate', count: 5, interval: 1400, delay: 4000 },
  ],
  [
    { enemy: 'gloom', count: 8, interval: 1100 },
    { enemy: 'pidgeotto', count: 6, interval: 900, delay: 3000 },
  ],
  [
    { enemy: 'graveler', count: 6, interval: 1500 },
    { enemy: 'magikarp', count: 12, interval: 700, delay: 2000 },
    { enemy: 'oddish', count: 10, interval: 600, delay: 5000 },
  ],
  [
    { enemy: 'pidgeotto', count: 12, interval: 600 },
    { enemy: 'raticate', count: 10, interval: 800, delay: 3000 },
    { enemy: 'vileplume', count: 1, interval: 0, delay: 10000 },
  ],
  [
    { enemy: 'rattata', count: 15, interval: 400 },
    { enemy: 'raticate', count: 10, interval: 700, delay: 3000 },
    { enemy: 'graveler', count: 8, interval: 1100, delay: 6000 },
    { enemy: 'golem', count: 1, interval: 0, delay: 9000 },
    { enemy: 'gyarados', count: 1, interval: 0, delay: 16000 },
  ],
];
