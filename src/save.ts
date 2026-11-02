// Preferencias y récord guardados en el navegador. localStorage puede fallar
// (modo privado, almacenamiento bloqueado), así que todo va protegido.

const BEST_KEY = 'poketower.bestWave';
const MUTED_KEY = 'poketower.muted';

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

export const loadBestWave = () => Number(read(BEST_KEY)) || 0;

export function saveBestWave(waves: number): void {
  if (waves > loadBestWave()) write(BEST_KEY, String(waves));
}

export const loadMuted = () => read(MUTED_KEY) === '1';
export const saveMuted = (muted: boolean) => write(MUTED_KEY, muted ? '1' : '0');
