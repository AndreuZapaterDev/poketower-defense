import { SCALE } from '../config';
import type { PokeType } from './types';

export type TowerAbility = 'burn' | 'splash' | 'slow' | 'melee' | 'flamethrower';

export interface TowerStage {
  name: string;
  level: number;
  /** Clave del spritesheet (public/assets/pokemon/<SPRITE>.png en mayúsculas) */
  sprite: string;
  damage: number;
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

export const BURN = { ratio: 0.4, duration: 3 };
export const SLOW = { factor: 0.5, duration: 1.5 };
export const SPLASH_RADIUS = 50 * SCALE;
export const FLAME_WIDTH = 14 * SCALE;

const stage = (
  name: string,
  level: number,
  damage: number,
  range: number,
  fireRate: number,
  cost: number,
): TowerStage => ({ name, level, sprite: name.toLowerCase(), damage, range: Math.round(range * SCALE), fireRate, cost });

export const TOWERS: TowerDef[] = [
  {
    id: 'charmander',
    type: 'fire',
    ability: 'burn',
    description: 'Ascuas: quema al objetivo durante 3 s.',
    stages: [
      stage('Charmander', 5, 8, 110, 800, 100),
      stage('Charmeleon', 16, 16, 120, 700, 150),
      stage('Charizard', 36, 34, 140, 600, 300),
    ],
  },
  {
    id: 'squirtle',
    type: 'water',
    ability: 'splash',
    description: 'Pistola Agua: daña a todos en el área.',
    stages: [
      stage('Squirtle', 5, 10, 100, 1000, 110),
      stage('Wartortle', 16, 20, 110, 900, 160),
      stage('Blastoise', 36, 40, 120, 800, 320),
    ],
  },
  {
    id: 'bulbasaur',
    type: 'grass',
    ability: 'slow',
    description: 'Látigo Cepa: ralentiza un 50%.',
    stages: [
      stage('Bulbasaur', 5, 7, 100, 700, 90),
      stage('Ivysaur', 16, 13, 110, 650, 140),
      stage('Venusaur', 32, 26, 120, 600, 280),
    ],
  },
  {
    id: 'mankey',
    type: 'fighting',
    ability: 'melee',
    description: 'Golpe Kárate: rápido, corto alcance.',
    stages: [
      stage('Mankey', 5, 12, 75, 450, 120),
      stage('Primeape', 28, 24, 80, 400, 160),
      stage('Primeape', 45, 44, 85, 340, 260),
    ],
  },
  {
    id: 'growlithe',
    type: 'fire',
    ability: 'flamethrower',
    description: 'Lanzallamas: atraviesa toda la fila.',
    stages: [
      stage('Growlithe', 5, 10, 130, 1100, 140),
      stage('Arcanine', 30, 22, 145, 1000, 220),
      stage('Arcanine', 45, 40, 155, 900, 300),
    ],
  },
];
