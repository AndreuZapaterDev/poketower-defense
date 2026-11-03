import { ENEMIES } from './enemies';
import { TOWERS } from './towers';

// Cada Pokémon tiene dos gráficos (ficheros en mayúsculas, p. ej. CHARMANDER.png):
//  - public/assets/icon:  icono de 128x64 con 2 fotogramas (tienda, vista previa de oleada)
//  - public/assets/front: tira horizontal de fotogramas cuadrados con la animación frontal (partida)

export const ICON_FRAME = 64;

export const iconPath = (sprite: string) => `assets/icon/${sprite.toUpperCase()}.png`;
export const frontPath = (sprite: string) => `assets/front/${sprite.toUpperCase()}.png`;

export const iconKey = (sprite: string) => `icon-${sprite}`;
export const frontKey = (sprite: string) => `front-${sprite}`;
export const iconAnim = (sprite: string) => `${sprite}-icon`;
export const frontAnim = (sprite: string) => `${sprite}-front`;

export function allSpriteKeys(): string[] {
  const keys = [
    ...TOWERS.flatMap((t) => t.stages.map((s) => s.sprite)),
    ...Object.values(ENEMIES).map((e) => e.sprite),
  ];
  return [...new Set(keys)];
}

// ------------------------------------------------------------------ animaciones frontales

export interface FrontStrip {
  canvas: HTMLCanvasElement;
  /** Lado del fotograma cuadrado, en píxeles */
  size: number;
  count: number;
  cols: number;
  /** Píxeles transparentes bajo los pies (en el fotograma más bajo de la animación) */
  bottomPad: number;
  /** Desplazamiento horizontal del centro de los pies respecto al centro del fotograma */
  feetX: number;
}

/** Busca dónde están los pies: la fila más baja con píxeles y el centro horizontal de esa zona */
function measureFeet(canvas: HTMLCanvasElement, size: number): { bottomPad: number; feetX: number } {
  const ctx = canvas.getContext('2d')!;
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const opaque = (x: number, y: number) => data[(y * width + x) * 4 + 3] > 32;

  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (opaque(x, y)) {
        maxY = Math.max(maxY, y % size);
        break;
      }
    }
  }
  if (maxY < 0) return { bottomPad: 0, feetX: 0 };

  // Centro de los píxeles en la franja inferior (los pies), sumando todos los fotogramas
  const band = Math.max(3, Math.round(size * 0.15));
  let sum = 0;
  let count = 0;
  for (let y = 0; y < height; y++) {
    const localY = y % size;
    if (localY < maxY - band || localY > maxY) continue;
    for (let x = 0; x < width; x++) {
      if (!opaque(x, y)) continue;
      sum += x % size;
      count++;
    }
  }
  const feetX = count ? sum / count + 0.5 - size / 2 : 0;
  return { bottomPad: size - 1 - maxY, feetX };
}

/** Tiras frontales ya cargadas, por clave de sprite */
export const frontStrips = new Map<string, FrontStrip>();

// Algunas tiras miden más de 8000 px de ancho, más de lo que admiten muchas GPU.
// Se recolocan en una cuadrícula de como mucho este ancho.
const MAX_SHEET_WIDTH = 2048;

async function loadStrip(sprite: string): Promise<void> {
  const img = new Image();
  img.src = frontPath(sprite);
  try {
    await img.decode();
  } catch {
    return; // sin animación frontal: se usará el icono
  }
  const size = img.height;
  const count = Math.max(1, Math.floor(img.width / size));
  const cols = Math.max(1, Math.min(count, Math.floor(MAX_SHEET_WIDTH / size)));
  const rows = Math.ceil(count / cols);
  const canvas = document.createElement('canvas');
  canvas.width = cols * size;
  canvas.height = rows * size;
  const ctx = canvas.getContext('2d')!;
  for (let i = 0; i < count; i++) {
    ctx.drawImage(img, i * size, 0, size, size, (i % cols) * size, Math.floor(i / cols) * size, size, size);
  }
  frontStrips.set(sprite, { canvas, size, count, cols, ...measureFeet(canvas, size) });
}

/** Carga todas las animaciones frontales antes de arrancar Phaser */
export async function loadFrontStrips(): Promise<void> {
  await Promise.all(allSpriteKeys().map(loadStrip));
}

// ------------------------------------------------------------------ animaciones de andar

// Hojas opcionales para los enemigos (public/assets/running/<SPRITE>.png): cuadrícula de 4x4
// fotogramas cuadrados, una fila por dirección en el orden de WALK_DIRS
export type WalkDir = 'down' | 'left' | 'right' | 'up';
export const WALK_DIRS: WalkDir[] = ['down', 'left', 'right', 'up'];
export const WALK_FRAMES = 4;

export const walkPath = (sprite: string) => `assets/running/${sprite.toUpperCase()}.png`;
export const walkKey = (sprite: string) => `walk-${sprite}`;
export const walkAnim = (sprite: string, dir: WalkDir) => `${sprite}-walk-${dir}`;

export interface WalkSheet {
  image: HTMLImageElement;
  /** Lado del fotograma cuadrado, en píxeles */
  size: number;
  /** Filas transparentes por encima y por debajo del Pokémon (en el conjunto de fotogramas) */
  topPad: number;
  bottomPad: number;
}

/** Hojas de andar ya cargadas, por clave de sprite */
export const walkSheets = new Map<string, WalkSheet>();

/** Filas vacías por arriba y por abajo, mirando todos los fotogramas de la cuadrícula */
function measurePadding(img: HTMLImageElement, size: number): { topPad: number; bottomPad: number } {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let minY = size;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] <= 32) continue;
      minY = Math.min(minY, y % size);
      maxY = Math.max(maxY, y % size);
    }
  }
  if (maxY < 0) return { topPad: 0, bottomPad: 0 };
  return { topPad: minY, bottomPad: size - 1 - maxY };
}

async function loadWalkSheet(sprite: string): Promise<void> {
  const img = new Image();
  img.src = walkPath(sprite);
  try {
    await img.decode();
  } catch {
    return; // sin hoja de andar: se usará la animación frontal
  }
  const size = img.width / WALK_FRAMES;
  walkSheets.set(sprite, { image: img, size, ...measurePadding(img, size) });
}

/** Carga las hojas de andar de los enemigos antes de arrancar Phaser */
export async function loadWalkSheets(): Promise<void> {
  await Promise.all([...new Set(Object.values(ENEMIES).map((e) => e.sprite))].map(loadWalkSheet));
}

// ------------------------------------------------------------------ uso en la partida

export interface BattleSprite {
  texture: string;
  anim: string;
  /** Tamaño del fotograma en píxeles, para escalar */
  size: number;
  frames: number;
  /** Píxeles vacíos bajo los pies, sin escalar */
  bottomPad: number;
  /** Centro de los pies respecto al centro del fotograma, sin escalar */
  feetX: number;
}

/** Textura y animación con que se muestra un Pokémon en el mapa (icono si no tiene animación frontal) */
export function battleSprite(sprite: string): BattleSprite {
  const strip = frontStrips.get(sprite);
  if (strip) {
    return {
      texture: frontKey(sprite),
      anim: frontAnim(sprite),
      size: strip.size,
      frames: strip.count,
      bottomPad: strip.bottomPad,
      feetX: strip.feetX,
    };
  }
  // El icono ocupa ~40 px dentro de su fotograma de 64, con unos 10 px libres debajo
  return { texture: iconKey(sprite), anim: iconAnim(sprite), size: 40, frames: 2, bottomPad: 10, feetX: 0 };
}

/**
 * Posición local del sprite (con origen abajo-centro) para que los pies queden en (0, feetY).
 * Phaser voltea desde el centro de la textura, así que el desplazamiento cambia de signo con flipX.
 */
export function feetAnchor(look: BattleSprite, scale: number, flipX: boolean, feetY: number) {
  return {
    x: (flipX ? 1 : -1) * look.feetX * scale,
    y: feetY + look.bottomPad * scale,
  };
}
