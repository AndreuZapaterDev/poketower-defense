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
