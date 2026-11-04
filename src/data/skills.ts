import type { TowerAbility } from './towers';

/**
 * Árbol de habilidades de cada Pokémon colocado: tres ramas de tres habilidades. Se compran con
 * puntos de habilidad que el Pokémon gana al evolucionar (o entrenar) y al subir niveles con
 * experiencia. Dentro de una rama hay que comprarlas en orden.
 */
export type SkillId =
  | 'power1'
  | 'power2'
  | 'special'
  | 'range1'
  | 'range2'
  | 'eagleEye'
  | 'speed1'
  | 'speed2'
  | 'loot';

export interface SkillDef {
  id: SkillId;
  name: string;
  description: string;
  /** Habilidad de la misma rama que hay que tener antes */
  requires?: SkillId;
}

/** Puntos de habilidad por cada evolución o entrenamiento */
export const POINTS_PER_STAGE = 2;
/** Niveles ganados con experiencia por cada punto de habilidad */
export const LEVELS_PER_POINT = 3;

export const SKILL = {
  /** Daño extra de cada habilidad de FUERZA */
  power: 0.15,
  /** Alcance extra de cada habilidad de ALCANCE */
  range: 0.1,
  /** Tiempo entre ataques que quita cada habilidad de RAPIDEZ */
  speed: 0.1,
  /** Probabilidad de crítico de OJO DE HALCÓN */
  crit: 0.08,
  /** Dinero extra por cada KO con BOTÍN */
  loot: 0.3,
} as const;

/** Lo que hace la habilidad especial de cada tipo de ataque */
export const SPECIAL = {
  /** Las quemaduras quitan esta parte del daño del golpe (en vez de BURN.ratio) */
  burnRatio: 0.7,
  /** El área de Pistola Agua se multiplica por esto */
  splashRadius: 1.5,
  /** El enemigo se mueve a esta velocidad (en vez de SLOW.factor) durante el doble de tiempo */
  slowFactor: 0.3,
  slowDuration: 2,
  /** Probabilidad de dar un segundo golpe */
  doubleHit: 0.3,
  /** El ancho del lanzallamas se multiplica por esto */
  flameWidth: 2,
} as const;

/** Nombre y texto de la habilidad especial según el ataque del Pokémon */
export const SPECIAL_TEXT: Record<TowerAbility, { name: string; description: string }> = {
  burn: { name: 'LLAMARADA', description: 'Las quemaduras hacen un 75 % más de daño.' },
  splash: { name: 'HIDROBOMBA', description: 'El chorro de agua moja un 50 % más de área.' },
  slow: { name: 'DRENADORAS', description: 'Las lianas frenan más y durante el doble de tiempo.' },
  melee: { name: 'DOBLE GOLPE', description: '30 % de probabilidad de golpear dos veces.' },
  flamethrower: { name: 'INFIERNO', description: 'El lanzallamas es el doble de ancho.' },
};

const pct = (n: number) => `${Math.round(n * 100)} %`;

/** Ramas del árbol, de izquierda a derecha; la especial cambia de nombre según el Pokémon */
export function skillBranches(ability: TowerAbility): { name: string; skills: SkillDef[] }[] {
  const special = SPECIAL_TEXT[ability];
  return [
    {
      name: 'FUERZA',
      skills: [
        { id: 'power1', name: 'FUERZA I', description: `+${pct(SKILL.power)} de daño.` },
        { id: 'power2', name: 'FUERZA II', description: `Otro +${pct(SKILL.power)} de daño.`, requires: 'power1' },
        { id: 'special', name: special.name, description: special.description, requires: 'power2' },
      ],
    },
    {
      name: 'ALCANCE',
      skills: [
        { id: 'range1', name: 'VISTA I', description: `+${pct(SKILL.range)} de alcance.` },
        { id: 'range2', name: 'VISTA II', description: `Otro +${pct(SKILL.range)} de alcance.`, requires: 'range1' },
        { id: 'eagleEye', name: 'OJO DE HALCON', description: `+${pct(SKILL.crit)} de golpe crítico.`, requires: 'range2' },
      ],
    },
    {
      name: 'RAPIDEZ',
      skills: [
        { id: 'speed1', name: 'AGILIDAD I', description: `Ataca un ${pct(SKILL.speed)} más rápido.` },
        { id: 'speed2', name: 'AGILIDAD II', description: `Otro ${pct(SKILL.speed)} más rápido.`, requires: 'speed1' },
        { id: 'loot', name: 'BOTIN', description: `+${pct(SKILL.loot)} de dinero por cada KO.`, requires: 'speed2' },
      ],
    },
  ];
}

export const ALL_SKILLS: SkillId[] = skillBranches('burn').flatMap((b) => b.skills.map((s) => s.id));

/** Puntos de habilidad ganados con `stage` evoluciones y `expLevels` niveles subidos con experiencia */
export const skillPointsEarned = (stage: number, expLevels: number) =>
  Math.min(ALL_SKILLS.length, stage * POINTS_PER_STAGE + Math.floor(expLevels / LEVELS_PER_POINT));

/** Si se puede aprender `id` con las habilidades que ya tiene y los puntos libres */
export function canLearn(id: SkillId, learned: ReadonlySet<SkillId>, freePoints: number, ability: TowerAbility): boolean {
  if (learned.has(id) || freePoints < 1) return false;
  const skill = skillBranches(ability)
    .flatMap((b) => b.skills)
    .find((s) => s.id === id);
  return !!skill && (!skill.requires || learned.has(skill.requires));
}

/** Efectos de las habilidades aprendidas */
export interface SkillEffects {
  damageMult: number;
  rangeMult: number;
  /** Multiplica el tiempo entre ataques (menos es más rápido) */
  intervalMult: number;
  critBonus: number;
  lootMult: number;
  special: boolean;
}

export function skillEffects(learned: ReadonlySet<SkillId>): SkillEffects {
  const count = (...ids: SkillId[]) => ids.filter((id) => learned.has(id)).length;
  return {
    damageMult: 1 + SKILL.power * count('power1', 'power2'),
    rangeMult: 1 + SKILL.range * count('range1', 'range2'),
    intervalMult: 1 - SKILL.speed * count('speed1', 'speed2'),
    critBonus: learned.has('eagleEye') ? SKILL.crit : 0,
    lootMult: learned.has('loot') ? 1 + SKILL.loot : 1,
    special: learned.has('special'),
  };
}
