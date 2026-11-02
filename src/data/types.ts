export type PokeType =
  | 'normal'
  | 'fire'
  | 'water'
  | 'grass'
  | 'electric'
  | 'fighting'
  | 'bug'
  | 'flying'
  | 'poison'
  | 'rock'
  | 'ground'
  | 'psychic';

export const TYPE_NAMES: Record<PokeType, string> = {
  normal: 'Normal',
  fire: 'Fuego',
  water: 'Agua',
  grass: 'Planta',
  electric: 'Eléctrico',
  fighting: 'Lucha',
  bug: 'Bicho',
  flying: 'Volador',
  poison: 'Veneno',
  rock: 'Roca',
  ground: 'Tierra',
  psychic: 'Psíquico',
};

export const TYPE_COLORS: Record<PokeType, number> = {
  normal: 0xa8a878,
  fire: 0xf08030,
  water: 0x6890f0,
  grass: 0x78c850,
  electric: 0xf8d030,
  fighting: 0xc03028,
  bug: 0xa8b820,
  flying: 0xa890f0,
  poison: 0xa040a0,
  rock: 0xb8a038,
  ground: 0xe0c068,
  psychic: 0xf85888,
};

// Multiplicadores atacante -> defensor (solo los tipos que usa el juego)
const CHART: Partial<Record<PokeType, Partial<Record<PokeType, number>>>> = {
  normal: { rock: 0.5 },
  fire: { grass: 2, bug: 2, fire: 0.5, water: 0.5, rock: 0.5 },
  water: { fire: 2, ground: 2, rock: 2, water: 0.5, grass: 0.5 },
  grass: { water: 2, ground: 2, rock: 2, fire: 0.5, grass: 0.5, poison: 0.5, flying: 0.5, bug: 0.5 },
  electric: { water: 2, flying: 2, electric: 0.5, grass: 0.5, ground: 0 },
  fighting: { normal: 2, rock: 2, flying: 0.5, poison: 0.5, bug: 0.5 },
  psychic: { poison: 2, psychic: 0.5 },
};

export function effectiveness(attack: PokeType, defense: readonly PokeType[]): number {
  return defense.reduce((mult, t) => mult * (CHART[attack]?.[t] ?? 1), 1);
}

function typesWhere(attack: PokeType, test: (mult: number) => boolean): PokeType[] {
  return Object.entries(CHART[attack] ?? {})
    .filter(([, mult]) => test(mult))
    .map(([t]) => t as PokeType);
}

export const strongAgainst = (attack: PokeType) => typesWhere(attack, (m) => m > 1);
export const weakAgainst = (attack: PokeType) => typesWhere(attack, (m) => m > 0 && m < 1);
export const uselessAgainst = (attack: PokeType) => typesWhere(attack, (m) => m === 0);
