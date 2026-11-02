import type { PokeType } from './types';

export interface EnemyDef {
  name: string;
  sprite: string;
  types: readonly PokeType[];
  hp: number;
  /** Píxeles por segundo */
  speed: number;
  reward: number;
  /** Vidas que quita al llegar al Centro Pokémon */
  damage: number;
  /** Altura aproximada con la que se dibuja, en píxeles */
  size: number;
  boss?: boolean;
}

export type EnemyId =
  | 'rattata'
  | 'pidgey'
  | 'oddish'
  | 'magikarp'
  | 'raticate'
  | 'geodude'
  | 'pidgeotto'
  | 'gloom'
  | 'graveler'
  | 'golem'
  | 'vileplume'
  | 'gyarados';

const enemy = (
  name: string,
  types: PokeType[],
  hp: number,
  speed: number,
  reward: number,
  damage: number,
  size: number,
  boss = false,
): EnemyDef => ({ name, sprite: name.toLowerCase(), types, hp, speed, reward, damage, size, boss });

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  rattata: enemy('Rattata', ['normal'], 30, 80, 5, 1, 40),
  pidgey: enemy('Pidgey', ['normal', 'flying'], 35, 95, 6, 1, 40),
  oddish: enemy('Oddish', ['grass', 'poison'], 60, 55, 8, 1, 40),
  magikarp: enemy('Magikarp', ['water'], 70, 60, 9, 1, 44),
  raticate: enemy('Raticate', ['normal'], 140, 85, 14, 2, 52),
  geodude: enemy('Geodude', ['rock', 'ground'], 160, 40, 15, 2, 46),
  pidgeotto: enemy('Pidgeotto', ['normal', 'flying'], 150, 100, 16, 2, 60),
  gloom: enemy('Gloom', ['grass', 'poison'], 210, 45, 18, 2, 50),
  graveler: enemy('Graveler', ['rock', 'ground'], 380, 35, 26, 3, 58),
  golem: enemy('Golem', ['rock', 'ground'], 1500, 30, 120, 10, 96, true),
  vileplume: enemy('Vileplume', ['grass', 'poison'], 2000, 34, 160, 12, 90, true),
  gyarados: enemy('Gyarados', ['water', 'flying'], 2600, 38, 250, 20, 120, true),
};
