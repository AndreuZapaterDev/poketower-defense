// Preferencias y récord guardados en el navegador. localStorage puede fallar
// (modo privado, almacenamiento bloqueado), así que todo va protegido.

const MUTED_KEY = 'poketower.muted';
// La Ruta 1 en fácil conserva la clave de cuando solo había un mapa para no perder el récord
const bestKey = (mapId: string, difficulty: string) =>
  mapId === 'ruta1' && difficulty === 'easy' ? 'poketower.bestWave' : `poketower.bestWave.${mapId}.${difficulty}`;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // sin almacenamiento: se juega igual, solo que no se guarda
  }
}

export const loadBestWave = (mapId: string, difficulty: string) => Number(read(bestKey(mapId, difficulty))) || 0;

export function saveBestWave(mapId: string, difficulty: string, waves: number): void {
  if (waves > loadBestWave(mapId, difficulty)) write(bestKey(mapId, difficulty), String(waves));
}

const POINTS_KEY = 'poketower.points';

/** Puntos de la cuenta, para gastar en mejoras y tiendas */
export const loadPoints = () => Math.max(0, Math.floor(Number(read(POINTS_KEY)) || 0));

/** Suma (o resta, con un número negativo) puntos a la cuenta y devuelve el nuevo total */
export function addPoints(amount: number): number {
  const total = Math.max(0, loadPoints() + Math.round(amount));
  write(POINTS_KEY, String(total));
  return total;
}

const UPGRADES_KEY = 'poketower.upgrades';

/** Niveles de las mejoras de la cuenta tal como se guardaron (id -> nivel); lo que falte vale 0 */
export function loadUpgradeLevels(): Record<string, number> {
  try {
    const data = JSON.parse(read(UPGRADES_KEY) ?? '{}') as unknown;
    if (!data || typeof data !== 'object') return {};
    return Object.fromEntries(
      Object.entries(data).filter(([, v]) => Number.isInteger(v) && (v as number) >= 0) as [string, number][],
    );
  } catch {
    return {};
  }
}

export const saveUpgradeLevels = (levels: Record<string, number>) => write(UPGRADES_KEY, JSON.stringify(levels));

const ITEMS_KEY = 'poketower.items';

/** Ids de los objetos comprados en la tienda */
export function loadOwnedItems(): string[] {
  try {
    const data = JSON.parse(read(ITEMS_KEY) ?? '[]') as unknown;
    return Array.isArray(data) ? data.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export const saveOwnedItems = (ids: string[]) => write(ITEMS_KEY, JSON.stringify([...new Set(ids)]));

const POKEMON_KEY = 'poketower.pokemon';

/** Ids de los Pokémon comprados en la tienda de Pokémon (los iniciales no se guardan: se tienen siempre) */
export function loadOwnedPokemon(): string[] {
  try {
    const data = JSON.parse(read(POKEMON_KEY) ?? '[]') as unknown;
    return Array.isArray(data) ? data.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export const saveOwnedPokemon = (ids: string[]) => write(POKEMON_KEY, JSON.stringify([...new Set(ids)]));

const TEAM_KEY = 'poketower.team';

/** Equipo guardado (ids de Pokémon, en orden); se valida en progress.ts */
export function loadTeam(): string[] {
  try {
    const data = JSON.parse(read(TEAM_KEY) ?? '[]') as unknown;
    return Array.isArray(data) ? data.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export const saveTeam = (ids: string[]) => write(TEAM_KEY, JSON.stringify(ids));

const DEV_UNLOCK_KEY = 'poketower.dev.unlockAllMaps';

/** Herramienta de desarrollo: todos los mapas abiertos (solo tiene efecto con `npm run dev`) */
export const loadDevUnlockAll = () => import.meta.env.DEV && read(DEV_UNLOCK_KEY) === '1';
export const saveDevUnlockAll = (on: boolean) => write(DEV_UNLOCK_KEY, on ? '1' : '0');

const TEXT_SPEED_KEY = 'poketower.textSpeed';

/** Opción VELOCIDAD DEL TEXTO de los cuadros de diálogo, como en los juegos */
export type TextSpeed = 'slow' | 'medium' | 'fast';
export const TEXT_SPEEDS: TextSpeed[] = ['slow', 'medium', 'fast'];

export function loadTextSpeed(): TextSpeed {
  const value = read(TEXT_SPEED_KEY);
  return TEXT_SPEEDS.includes(value as TextSpeed) ? (value as TextSpeed) : 'medium';
}

export const saveTextSpeed = (speed: TextSpeed) => write(TEXT_SPEED_KEY, speed);

const INTRO_KEY = 'poketower.introSeen';
const NAME_KEY = 'poketower.trainerName';

/** Si ya se ha visto la introducción del Profesor Oak (solo sale sola la primera vez) */
export const loadIntroSeen = () => read(INTRO_KEY) === '1';
export const saveIntroSeen = () => write(INTRO_KEY, '1');

/** Nombre del entrenador, elegido en la introducción; vacío si aún no tiene */
export const loadTrainerName = () => (read(NAME_KEY) ?? '').slice(0, 10);
export const saveTrainerName = (name: string) => write(NAME_KEY, name.slice(0, 10));

export const loadMuted = () => read(MUTED_KEY) === '1';
export const saveMuted = (muted: boolean) => write(MUTED_KEY, muted ? '1' : '0');

export type VolumeChannel = 'music' | 'sfx';
const volumeKey = (channel: VolumeChannel) => `poketower.volume.${channel}`;

/** Volumen entre 0 y 1 (1 si no hay nada guardado) */
export function loadVolume(channel: VolumeChannel): number {
  const value = read(volumeKey(channel));
  if (value === null) return 1;
  const volume = Number(value);
  return Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1;
}

export const saveVolume = (channel: VolumeChannel, volume: number) => write(volumeKey(channel), String(volume));

const ACCOUNT_PREFIX = 'poketower.';

/** Descarga un archivo con todo lo guardado de la cuenta. Devuelve false si no se pudo */
export function exportAccount(): boolean {
  try {
    const data: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(ACCOUNT_PREFIX)) data[key] = localStorage.getItem(key) ?? '';
    }
    const file = JSON.stringify({ version: 1, savedAt: new Date().toISOString(), data }, null, 2);
    const url = URL.createObjectURL(new Blob([file], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `poketower-cuenta-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}
