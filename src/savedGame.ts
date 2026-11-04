import { DIFFICULTY_IDS, MAPS, type Difficulty } from './data/map';
import { TOWERS } from './data/towers';
import { ALL_SKILLS, type SkillId } from './data/skills';
import { TARGET_MODES, type TargetMode } from './data/targeting';

/**
 * Partida en curso guardada en el navegador (solo hay una). Se guarda entre oleadas: si se sale
 * a mitad de una, al continuar esa oleada empieza de nuevo con lo que había antes de ella.
 */
const KEY = 'poketower.savedGame';
const VERSION = 1;

export interface SavedTower {
  tower: string;
  col: number;
  row: number;
  stage: number;
  level: number;
  exp: number;
  kills: number;
  damage: number;
  target: TargetMode;
  /** Dinero invertido, para el precio de venta */
  spent: number;
  /** Niveles subidos con experiencia y habilidades aprendidas (ver data/skills.ts) */
  expLevels: number;
  skills: SkillId[];
}

export interface SavedGame {
  version: number;
  mapId: string;
  difficulty: Difficulty;
  /** Índice de la última oleada superada (-1 si aún no se ha jugado ninguna) */
  waveIndex: number;
  money: number;
  lives: number;
  defeated: number;
  towers: SavedTower[];
}

const isInt = (v: unknown, min = 0): v is number => Number.isInteger(v) && (v as number) >= min;

/** Comprueba una torre guardada; devuelve null si no encaja con los datos actuales del juego */
function parseTower(raw: unknown): SavedTower | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  const def = TOWERS.find((d) => d.id === t.tower);
  if (!def || !isInt(t.col) || !isInt(t.row) || !isInt(t.stage) || (t.stage as number) >= def.stages.length) return null;
  if (!isInt(t.level, 1) || !isInt(t.spent)) return null;
  return {
    tower: def.id,
    col: t.col as number,
    row: t.row as number,
    stage: t.stage as number,
    level: t.level as number,
    exp: isInt(t.exp) ? t.exp : 0,
    kills: isInt(t.kills) ? t.kills : 0,
    damage: typeof t.damage === 'number' && t.damage >= 0 ? t.damage : 0,
    target: TARGET_MODES.includes(t.target as TargetMode) ? (t.target as TargetMode) : 'first',
    spent: t.spent as number,
    expLevels: isInt(t.expLevels) ? t.expLevels : 0,
    skills: Array.isArray(t.skills) ? t.skills.filter((id): id is SkillId => ALL_SKILLS.includes(id as SkillId)) : [],
  };
}

export function loadSavedGame(): SavedGame | null {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Record<string, unknown> | null;
    if (!raw || raw.version !== VERSION) return null;
    if (!MAPS.some((m) => m.id === raw.mapId) || !DIFFICULTY_IDS.includes(raw.difficulty as Difficulty)) return null;
    if (!isInt(raw.waveIndex, -1) || !isInt(raw.money) || !isInt(raw.lives, 1) || !Array.isArray(raw.towers)) return null;
    return {
      version: VERSION,
      mapId: raw.mapId as string,
      difficulty: raw.difficulty as Difficulty,
      waveIndex: raw.waveIndex as number,
      money: raw.money as number,
      lives: raw.lives as number,
      defeated: isInt(raw.defeated) ? raw.defeated : 0,
      towers: raw.towers.map(parseTower).filter((t): t is SavedTower => !!t),
    };
  } catch {
    return null;
  }
}

/** La partida guardada, si es de ese mapa y esa dificultad */
export function savedGameFor(mapId: string, difficulty: Difficulty): SavedGame | null {
  const game = loadSavedGame();
  return game && game.mapId === mapId && game.difficulty === difficulty ? game : null;
}

export function saveGame(game: Omit<SavedGame, 'version'>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: VERSION, ...game }));
  } catch {
    // sin almacenamiento: se juega igual, solo que no se guarda
  }
}

export function clearSavedGame(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nada que borrar
  }
}
