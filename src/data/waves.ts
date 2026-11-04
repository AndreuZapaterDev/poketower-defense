import type { Difficulty } from './map';
import type { EnemyId } from './enemies';

export interface WaveGroup {
  enemy: EnemyId;
  count: number;
  /** Milisegundos entre cada enemigo del grupo */
  interval: number;
  /** Milisegundos desde el inicio de la oleada hasta que sale el grupo */
  delay?: number;
}

export type Wave = WaveGroup[];

/** Oleadas de un mapa: las de todas las dificultades y las que se añaden al final en difícil */
interface WaveSet {
  waves: Wave[];
  hardExtra: Wave[];
}

/** En difícil cada grupo trae este factor más de Pokémon (los jefes, que van solos, no cambian) */
const HARD_COUNT = 1.25;
/** ...y salen más seguidos */
const HARD_INTERVAL = 0.85;

const g = (enemy: EnemyId, count: number, interval: number, delay?: number): WaveGroup => ({
  enemy,
  count,
  interval,
  ...(delay !== undefined && { delay }),
});

/** Ruta 1, de bosque: Pokémon normales, voladores y de planta; algún Magikarp del estanque */
const RUTA_1: WaveSet = {
  waves: [
    [g('rattata', 8, 1000)],
    [g('pidgey', 8, 900), g('rattata', 6, 800, 3000)],
    [g('oddish', 8, 1000), g('rattata', 8, 700, 4000)],
    [g('pidgey', 12, 600), g('oddish', 6, 900, 3000)],
    [g('raticate', 4, 1500), g('rattata', 10, 600, 2000), g('magikarp', 6, 900, 6000)],
    [g('gloom', 6, 1200), g('pidgey', 10, 600, 3000)],
    [g('pidgeotto', 8, 900), g('oddish', 10, 600, 3000)],
    [g('raticate', 8, 1000), g('gloom', 8, 1000, 3000), g('magikarp', 8, 700, 6000)],
    [g('pidgeotto', 12, 600), g('raticate', 10, 800, 3000)],
    [g('rattata', 15, 400), g('gloom', 8, 900, 3000), g('pidgeotto', 8, 700, 6000), g('vileplume', 1, 0, 12000)],
  ],
  hardExtra: [
    [g('pidgeotto', 15, 500), g('gloom', 10, 800, 3000), g('raticate', 12, 600, 6000)],
    [g('raticate', 15, 500), g('pidgeotto', 12, 600, 3000), g('vileplume', 1, 0, 8000), g('gyarados', 1, 0, 16000)],
  ],
};

/** Ruta 2, pradera con lago: muchos voladores y Magikarp; al final sale Gyarados del lago */
const RUTA_2: WaveSet = {
  waves: [
    [g('pidgey', 10, 800)],
    [g('rattata', 10, 700), g('magikarp', 4, 1200, 4000)],
    [g('magikarp', 10, 800), g('pidgey', 8, 700, 3000)],
    [g('oddish', 10, 800), g('raticate', 3, 1600, 4000)],
    [g('pidgeotto', 6, 1100), g('magikarp', 12, 600, 3000), g('vileplume', 1, 0, 12000)],
    [g('raticate', 8, 1000), g('pidgey', 14, 450, 3000)],
    [g('gloom', 8, 1000), g('magikarp', 14, 500, 4000)],
    [g('pidgeotto', 12, 700), g('raticate', 10, 800, 4000)],
    [g('magikarp', 20, 350), g('gloom', 10, 800, 4000), g('pidgeotto', 8, 700, 8000)],
    [g('pidgeotto', 14, 500), g('raticate', 12, 600, 3000), g('magikarp', 15, 400, 6000), g('gyarados', 1, 0, 14000)],
  ],
  hardExtra: [
    [g('pidgeotto', 18, 450), g('magikarp', 20, 350, 3000), g('gloom', 10, 800, 6000)],
    [g('raticate', 16, 450), g('pidgeotto', 14, 500, 3000), g('gyarados', 1, 0, 9000), g('gyarados', 1, 0, 18000)],
  ],
};

/** Gimnasio Plateada, de tipo roca: sobre todo Geodude, Graveler y Golem */
const GIMNASIO_PLATEADA: WaveSet = {
  waves: [
    [g('geodude', 6, 1500)],
    [g('geodude', 6, 1300), g('rattata', 8, 700, 3000)],
    [g('geodude', 8, 1200), g('pidgey', 8, 700, 4000)],
    [g('graveler', 3, 2000), g('geodude', 8, 1000, 3000)],
    [g('geodude', 10, 900), g('raticate', 4, 1400, 3000), g('golem', 1, 0, 12000)],
    [g('graveler', 6, 1500), g('pidgeotto', 6, 900, 4000)],
    [g('geodude', 15, 600), g('graveler', 4, 1600, 5000)],
    [g('graveler', 8, 1200), g('raticate', 8, 800, 3000), g('geodude', 10, 600, 6000)],
    [g('graveler', 10, 1000), g('pidgeotto', 10, 700, 3000), g('golem', 1, 0, 10000)],
    [g('geodude', 15, 450), g('graveler', 10, 900, 3000), g('golem', 1, 0, 9000), g('golem', 1, 0, 16000)],
  ],
  hardExtra: [
    [g('graveler', 14, 800), g('geodude', 15, 500, 4000)],
    [g('graveler', 12, 700), g('golem', 1, 0, 6000), g('golem', 1, 0, 12000), g('golem', 1, 0, 18000)],
  ],
};

const WAVE_SETS: Record<string, WaveSet> = {
  ruta1: RUTA_1,
  ruta2: RUTA_2,
  gimnasioplateada: GIMNASIO_PLATEADA,
};

/** Versión difícil de una oleada: más Pokémon por grupo y más seguidos */
const harden = (wave: Wave): Wave =>
  wave.map((group) =>
    group.count > 1
      ? { ...group, count: Math.ceil(group.count * HARD_COUNT), interval: Math.round(group.interval * HARD_INTERVAL) }
      : group,
  );

/** Oleadas de un mapa en una dificultad (los mapas sin oleadas propias usan las de la Ruta 1) */
export function wavesFor(mapId: string, difficulty: Difficulty): Wave[] {
  const set = WAVE_SETS[mapId] ?? RUTA_1;
  if (difficulty === 'easy') return set.waves;
  return [...set.waves, ...set.hardExtra].map(harden);
}
