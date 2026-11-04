import { SCALE, TILE } from '../config';
import type { PokeType } from './types';

export type TowerAbility = 'burn' | 'splash' | 'slow' | 'melee' | 'flamethrower';

export interface TowerStage {
  name: string;
  level: number;
  /** Clave del spritesheet (public/assets/pokemon/<SPRITE>.png en mayúsculas) */
  sprite: string;
  damage: number;
  /** Alcance en casillas, como se muestra al jugador */
  rangeTiles: number;
  /** Alcance en píxeles (rangeTiles · TILE), el que se usa para atacar y dibujar el círculo */
  range: number;
  /** Milisegundos entre ataques */
  fireRate: number;
  /** Precio de compra (fase 0) o de evolución / subida de nivel (resto de fases) */
  cost: number;
}

export interface TowerDef {
  id: string;
  type: PokeType;
  ability: TowerAbility;
  description: string;
  stages: TowerStage[];
}

let priceFactor = 1;

/** Descuento de la partida en curso (mejora REBAJAS de la cuenta): 0.9 = un 10 % menos */
export const setPriceFactor = (factor: number) => {
  priceFactor = factor;
};

/** Precio de una fase con el descuento de la partida aplicado */
export const priceOf = (stage: TowerStage) => Math.max(1, Math.round(stage.cost * priceFactor));

export const BURN = { ratio: 0.4, duration: 3 };
export const SLOW = { factor: 0.5, duration: 1.5 };
export const SPLASH_RADIUS = 50 * SCALE;
export const FLAME_WIDTH = 14 * SCALE;

/** Fase de un Pokémon; `rangeTiles` es el alcance en casillas (2.3 = dos casillas y un tercio) */
const stage = (
  name: string,
  level: number,
  damage: number,
  rangeTiles: number,
  fireRate: number,
  cost: number,
): TowerStage => ({
  name,
  level,
  sprite: name.toLowerCase(),
  damage,
  rangeTiles,
  range: Math.round(rangeTiles * TILE),
  fireRate,
  cost,
});

export const TOWERS: TowerDef[] = [
  {
    id: 'charmander',
    type: 'fire',
    ability: 'burn',
    description: 'Ascuas: quema al objetivo durante 3 s.',
    stages: [
      stage('Charmander', 5, 8, 2.3, 800, 100),
      stage('Charmeleon', 16, 16, 2.5, 700, 150),
      stage('Charizard', 36, 34, 2.9, 600, 300),
    ],
  },
  {
    id: 'squirtle',
    type: 'water',
    ability: 'splash',
    description: 'Pistola Agua: daña a todos en el área.',
    stages: [
      stage('Squirtle', 5, 10, 2.1, 1000, 110),
      stage('Wartortle', 16, 20, 2.3, 900, 160),
      stage('Blastoise', 36, 40, 2.5, 800, 320),
    ],
  },
  {
    id: 'bulbasaur',
    type: 'grass',
    ability: 'slow',
    description: 'Látigo Cepa: ralentiza un 50%.',
    stages: [
      stage('Bulbasaur', 5, 7, 2.1, 700, 90),
      stage('Ivysaur', 16, 13, 2.3, 650, 140),
      stage('Venusaur', 32, 26, 2.5, 600, 280),
    ],
  },
  {
    id: 'mankey',
    type: 'fighting',
    ability: 'melee',
    description: 'Golpe Kárate: rápido, corto alcance.',
    stages: [
      stage('Mankey', 5, 12, 1.6, 450, 120),
      stage('Primeape', 28, 24, 1.7, 400, 160),
      stage('Primeape', 45, 44, 1.8, 340, 260),
    ],
  },
  {
    id: 'growlithe',
    type: 'fire',
    ability: 'flamethrower',
    description: 'Lanzallamas: atraviesa toda la fila.',
    stages: [
      stage('Growlithe', 5, 10, 2.7, 1100, 140),
      stage('Arcanine', 30, 22, 3, 1000, 220),
      stage('Arcanine', 45, 40, 3.2, 900, 300),
    ],
  },
];
