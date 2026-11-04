import { BASE_TEAM_SIZE, MAX_TEAM_SIZE } from './team';

/**
 * Árbol de mejoras de la cuenta: se compran con los puntos (ver points.ts) y se aplican a todas
 * las partidas. Hay tres ramas; para mejorar una hace falta tener al menos un nivel en la
 * anterior de su rama.
 */
export type UpgradeId =
  | 'startMoney'
  | 'waveBonus'
  | 'shopDiscount'
  | 'extraLives'
  | 'expBoost'
  | 'critChance'
  | 'teamSlots';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  /** Qué hace cada nivel, para el texto de ayuda */
  description: string;
  /** Efecto acumulado con `level` niveles, como texto corto ("+50 $", "-8 %") */
  effectText: (level: number) => string;
  /** Precio en puntos de cada nivel (su longitud es el nivel máximo) */
  costs: number[];
  /** Mejora que hay que tener al menos a nivel 1 antes */
  requires?: UpgradeId;
}

/** Cuánto da cada nivel de cada mejora */
export const UPGRADE_STEP = {
  startMoney: 25,
  waveBonus: 0.1,
  shopDiscount: 0.04,
  extraLives: 2,
  expBoost: 0.15,
  critChance: 0.02,
  teamSlots: 1,
} as const satisfies Record<UpgradeId, number>;

const pct = (value: number) => `${Math.round(value * 100)} %`;

export const UPGRADE_BRANCHES: { name: string; upgrades: UpgradeDef[] }[] = [
  {
    name: 'ECONOMIA',
    upgrades: [
      {
        id: 'startMoney',
        name: 'AHORROS',
        description: `Empiezas cada partida con ${UPGRADE_STEP.startMoney} $ más por nivel.`,
        effectText: (l) => `+${l * UPGRADE_STEP.startMoney} $`,
        costs: [30, 60, 100, 150, 220],
      },
      {
        id: 'waveBonus',
        name: 'PREMIO',
        description: `El dinero por superar cada oleada sube un ${pct(UPGRADE_STEP.waveBonus)} por nivel.`,
        effectText: (l) => `+${pct(l * UPGRADE_STEP.waveBonus)}`,
        costs: [40, 80, 130, 190, 260],
        requires: 'startMoney',
      },
      {
        id: 'shopDiscount',
        name: 'REBAJAS',
        description: `Comprar y evolucionar Pokémon cuesta un ${pct(UPGRADE_STEP.shopDiscount)} menos por nivel.`,
        effectText: (l) => `-${pct(l * UPGRADE_STEP.shopDiscount)}`,
        costs: [60, 120, 190, 270, 360],
        requires: 'waveBonus',
      },
    ],
  },
  {
    name: 'ENTRENAMIENTO',
    upgrades: [
      {
        id: 'extraLives',
        name: 'AGUANTE',
        description: `Empiezas cada partida con ${UPGRADE_STEP.extraLives} vidas más por nivel.`,
        effectText: (l) => `+${l * UPGRADE_STEP.extraLives} VIDAS`,
        costs: [30, 60, 100, 150, 220],
      },
      {
        id: 'expBoost',
        name: 'EXPERIENCIA',
        description: `Tus Pokémon ganan un ${pct(UPGRADE_STEP.expBoost)} más de experiencia por nivel.`,
        effectText: (l) => `+${pct(l * UPGRADE_STEP.expBoost)}`,
        costs: [40, 80, 130, 190, 260],
        requires: 'extraLives',
      },
      {
        id: 'critChance',
        name: 'PUNTERIA',
        description: `La probabilidad de golpe crítico sube un ${pct(UPGRADE_STEP.critChance)} por nivel.`,
        effectText: (l) => `+${pct(l * UPGRADE_STEP.critChance)}`,
        costs: [60, 120, 190, 270, 360],
        requires: 'expBoost',
      },
    ],
  },
  {
    name: 'EQUIPO',
    upgrades: [
      {
        id: 'teamSlots',
        name: 'AMISTAD',
        description: `Cada nivel abre un hueco más en el equipo (empiezas con ${BASE_TEAM_SIZE} y caben hasta ${MAX_TEAM_SIZE}).`,
        effectText: (l) => `${BASE_TEAM_SIZE + l} HUECOS`,
        // Un nivel por cada hueco que falta hasta el máximo
        costs: [150, 300].slice(0, MAX_TEAM_SIZE - BASE_TEAM_SIZE),
      },
    ],
  },
];

export const UPGRADES: UpgradeDef[] = UPGRADE_BRANCHES.flatMap((b) => b.upgrades);
export const upgradeById = (id: UpgradeId) => UPGRADES.find((u) => u.id === id)!;

export type UpgradeLevels = Record<UpgradeId, number>;

export const emptyLevels = (): UpgradeLevels =>
  Object.fromEntries(UPGRADES.map((u) => [u.id, 0])) as UpgradeLevels;

/** Por qué no se puede comprar el siguiente nivel, o null si se puede */
export function blockReason(id: UpgradeId, levels: UpgradeLevels, points: number): 'max' | 'locked' | 'points' | null {
  const def = upgradeById(id);
  const level = levels[id];
  if (level >= def.costs.length) return 'max';
  if (def.requires && levels[def.requires] < 1) return 'locked';
  if (points < def.costs[level]) return 'points';
  return null;
}

/** Puntos gastados en total, para poder devolverlos */
export const spentPoints = (levels: UpgradeLevels) =>
  UPGRADES.reduce((sum, u) => sum + u.costs.slice(0, levels[u.id]).reduce((a, b) => a + b, 0), 0);

/** Efectos de las mejoras en una partida */
export interface UpgradeEffects {
  startMoney: number;
  extraLives: number;
  /** Multiplicadores (1 = sin mejora) */
  waveBonus: number;
  priceFactor: number;
  expFactor: number;
  /** Probabilidad de crítico que se suma a la de siempre */
  critBonus: number;
  /** Huecos de equipo de más */
  teamSlots: number;
}

export const upgradeEffects = (levels: UpgradeLevels): UpgradeEffects => ({
  startMoney: levels.startMoney * UPGRADE_STEP.startMoney,
  extraLives: levels.extraLives * UPGRADE_STEP.extraLives,
  waveBonus: 1 + levels.waveBonus * UPGRADE_STEP.waveBonus,
  priceFactor: 1 - levels.shopDiscount * UPGRADE_STEP.shopDiscount,
  expFactor: 1 + levels.expBoost * UPGRADE_STEP.expBoost,
  critBonus: levels.critChance * UPGRADE_STEP.critChance,
  teamSlots: levels.teamSlots * UPGRADE_STEP.teamSlots,
});
