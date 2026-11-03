import Phaser from 'phaser';
import { MAP_H, MAP_W, TILE } from '../config';
import { RouteMap, tileKey, type MapDef, type Tile } from '../data/map';

// Tileset de exteriores (public/assets/tiles/Outside.png): casillas de 32 px en 8 columnas.
// Mide más de 16000 px de alto, más de lo que admiten muchas GPU, así que no se sube a Phaser:
// se carga como imagen y cada mapa copia a un canvas solo las casillas que usa.

const SRC = 32;
const HALF = SRC / 2;
const OUTSIDE_PATH = 'assets/tiles/Outside.png';

/** Posición de una casilla del tileset: [fila, columna] */
type Src = [row: number, col: number];

const GRASS: Src[] = [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5]];
const TALL_GRASS: Src = [0, 6];
const FLOWERS: Src = [3, 7];
/** Estanque completo de 3x3 casillas (esquina superior izquierda) */
const POND: Src = [86, 5];
/** Pino estrecho: 1 casilla de ancho y 3 de alto, con el tronco en la última */
const PINE: Src = [58, 6];
const SIGN: Src = [119, 2];
const ROCK: Src = [118, 0];
const BUSH: Src = [59, 3];
/** Valla de madera: extremo izquierdo, tramo de en medio y extremo derecho */
const FENCE_ROW = 149;
const FENCE_LEFT = 5;
const FENCE_MID = 6;
const FENCE_RIGHT = 7;
/** Centro Pokémon de 5x5 casillas, con la puerta en el centro de la fila de abajo */
const POKECENTER: Src = [326, 0];

// Camino de tierra. Cada casilla se compone de cuatro cuartos de 16 px elegidos según las
// casillas vecinas, a partir de un bloque de 3x3 (bordes y esquinas) y de las esquinas interiores.
const DIRT_CENTER: Src = [13, 2];
const DIRT_BLOCK_TOP = 12;
const DIRT_BLOCK_LEFT = 1;
const DIRT_INNER_TOP = 12;
const DIRT_INNER_LEFT = 4;
/** Píxeles (del tileset) que los bordes del camino invaden la hierba de al lado */
const EDGE_SHIFT = 6;

// Tileset del bosque (public/assets/tiles/Dungeon forest.png), para los mapas con `forest`:
// hierba, hierba alta, un árbol redondo de 2x2 y un pino de 2x3 casillas repartido en tres
// tiras (copa, centro y tronco) que, puestos al tresbolillo, forman un bosque cerrado.
const FOREST_PATH = 'assets/tiles/Dungeon forest.png';
const FOREST_GRASS: Src[] = [[5, 2], [5, 3], [5, 4], [5, 5], [5, 6]];
const FOREST_TALL_GRASS: Src = [5, 7];
/** Tiras del pino grande (2 casillas de ancho), de arriba abajo */
const FOREST_PINE: Src[] = [[3, 1], [4, 1], [0, 1]];
/** Árbol redondo de 2x2 casillas */
const ROUND_TREE: Src = [1, 4];

let outside: HTMLImageElement | null = null;
let forestTiles: HTMLImageElement | null = null;

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  const img = new Image();
  img.src = src;
  try {
    await img.decode();
    return img;
  } catch {
    return null;
  }
}

/** Carga los tilesets antes de arrancar Phaser; si falla, los mapas se dibujan por código */
export async function loadOutsideTileset(): Promise<void> {
  [outside, forestTiles] = await Promise.all([loadImage(OUTSIDE_PATH), loadImage(FOREST_PATH)]);
}

/** Crea las texturas de los mapas con tileset. Devuelve false si el tileset no se ha cargado */
export function buildTilesetTextures(scene: Phaser.Scene, maps: { def: MapDef; key: string }[]): boolean {
  if (!outside) return false;
  const img = outside;
  for (const { def, key } of maps) {
    if (!scene.textures.exists(key)) scene.textures.addCanvas(key, drawTileMap(def, img, forestTiles));
  }
  return true;
}

function newCanvas(w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

/** Copia `w`x`h` casillas del tileset a la posición (x, y) del mapa */
function blit(ctx: CanvasRenderingContext2D, img: HTMLImageElement, [row, col]: Src, x: number, y: number, w = 1, h = 1): void {
  const k = TILE / SRC;
  ctx.drawImage(img, col * SRC, row * SRC, w * SRC, h * SRC, x, y, w * SRC * k, h * SRC * k);
}

/** Algo que se dibuja de arriba abajo según la fila de su base (árboles) */
interface Sprite {
  bottom: number;
  draw: () => void;
}

function drawTileMap(def: MapDef, img: HTMLImageElement, forestImg: HTMLImageElement | null): HTMLCanvasElement {
  const map = new RouteMap(def);
  const canvas = newCanvas(MAP_W, MAP_H);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  // Semilla fija por mapa: los detalles al azar salen siempre iguales
  const rng = new Phaser.Math.RandomDataGenerator([`poketower-${def.id}`]);
  const cols = MAP_W / TILE;
  const rows = MAP_H / TILE;
  // Los mapas de bosque usan la hierba del tileset del bosque (si se ha cargado)
  const woods = def.pines && forestImg ? forestImg : null;

  const cells: Tile[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push([c, r]);
  for (const [c, r] of cells) {
    if (woods) blit(ctx, woods, FOREST_GRASS[rng.between(0, FOREST_GRASS.length - 1)], c * TILE, r * TILE);
    else blit(ctx, img, GRASS[rng.between(0, GRASS.length - 1)], c * TILE, r * TILE);
  }
  // Flores en algunas casillas libres (en el bosque no hay)
  if (!woods) {
    for (const [c, r] of cells) {
      if (map.isBuildable(c, r) && rng.frac() < 0.1) blit(ctx, img, FLOWERS, c * TILE, r * TILE);
    }
  }
  for (const [c, r] of def.tallGrass) {
    if (woods) blit(ctx, woods, FOREST_TALL_GRASS, c * TILE, r * TILE);
    else blit(ctx, img, TALL_GRASS, c * TILE, r * TILE);
  }
  for (const [c, r] of def.ponds) blit(ctx, img, POND, c * TILE, r * TILE, 3, 3);
  // El camino va después de la hierba porque sus bordes invaden un poco las casillas vecinas
  drawPath(ctx, img, map);
  blit(ctx, img, SIGN, def.sign[0] * TILE, def.sign[1] * TILE);
  for (const [c, r] of def.rocks ?? []) blit(ctx, img, ROCK, c * TILE, r * TILE);
  for (const [c, r] of def.bushes ?? []) blit(ctx, img, BUSH, c * TILE, r * TILE);

  // Árboles de arriba abajo, para que las copas de los de delante tapen los troncos de detrás
  const sprites: Sprite[] = def.trees.map(([c, r]) => ({
    bottom: r,
    draw: () => blit(ctx, img, PINE, c * TILE, (r - 2) * TILE, 1, 3),
  }));
  if (woods) {
    for (const [c, r] of def.bigTrees ?? []) {
      sprites.push({ bottom: r + 1, draw: () => blit(ctx, woods, ROUND_TREE, c * TILE, r * TILE, 2, 2) });
    }
  }
  // Vallas: pieza de extremo o de en medio según si siguen a izquierda o derecha
  const fences = new Set((def.fences ?? []).map(([c, r]) => tileKey(c, r)));
  for (const [c, r] of def.fences ?? []) {
    const left = fences.has(tileKey(c - 1, r));
    const right = fences.has(tileKey(c + 1, r));
    const piece: Src = [FENCE_ROW, left && right ? FENCE_MID : left ? FENCE_RIGHT : FENCE_LEFT];
    sprites.push({ bottom: r, draw: () => blit(ctx, img, piece, c * TILE, r * TILE) });
  }
  // Pinos grandes del bosque (2x3); sin el tileset del bosque, dos pinos estrechos en su lugar
  for (const [x, top] of def.pines ?? []) {
    sprites.push({
      bottom: top + 2,
      draw: () => {
        if (woods) FOREST_PINE.forEach((strip, i) => blit(ctx, woods, strip, x * TILE, (top + i) * TILE, 2, 1));
        else [x, x + 1].forEach((c) => blit(ctx, img, PINE, c * TILE, top * TILE, 1, 3));
      },
    });
  }
  for (const sprite of sprites.sort((a, b) => a.bottom - b.bottom)) sprite.draw();

  if (map.pokecenter) blit(ctx, img, POKECENTER, map.pokecenter.x, map.pokecenter.y, 5, 5);
  return canvas;
}

/**
 * Dibuja la tierra del camino. Con camino de 1 casilla, la tierra va casilla a casilla.
 * Con un camino más ancho (por ejemplo 3), la tierra se dibuja una casilla más estrecha que el
 * camino, en una cuadrícula desplazada media casilla: así queda centrada sobre el recorrido
 * de los enemigos, con césped a los lados, y se siguen usando las piezas del tileset enteras.
 */
function drawPath(ctx: CanvasRenderingContext2D, img: HTMLImageElement, map: RouteMap): void {
  const side = Math.floor(((map.def.pathWidth ?? 1) - 1) / 2);
  const offset = side > 0 ? TILE / 2 : 0;
  const dirt = new Set<string>();
  for (const [c, r] of map.centerline) {
    // Bloque de (2·side) x (2·side) celdas centrado en la casilla; con side 0, la propia casilla
    const from = side > 0 ? -side : 0;
    const to = side > 0 ? side - 1 : 0;
    for (let dr = from; dr <= to; dr++) for (let dc = from; dc <= to; dc++) dirt.add(tileKey(c + dc, r + dr));
  }
  const isDirt = (c: number, r: number) => dirt.has(tileKey(c, r));
  const cells = [...dirt].map((key) => key.split(',').map(Number) as Tile);
  for (const [c, r] of cells) blit(ctx, img, DIRT_CENTER, c * TILE + offset, r * TILE + offset);
  for (const [c, r] of cells) drawDirtEdges(ctx, img, c * TILE + offset, r * TILE + offset, c, r, isDirt);
}

/**
 * Bordes de una celda de tierra: cuatro cuartos elegidos según qué vecinos son tierra.
 * En el tileset el borde ocupa casi un tercio de la casilla y el camino de una casilla se
 * vería muy estrecho, así que cada cuarto con borde se desplaza EDGE_SHIFT px hacia la hierba.
 */
function drawDirtEdges(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  c: number,
  r: number,
  isPath: (c: number, r: number) => boolean,
): void {
  const k = TILE / SRC;
  /** Copia el cuarto (qx, qy) de la casilla `src` a (destX, destY) dentro de la celda, en px del tileset */
  const quarter = ([row, col]: Src, qx: number, qy: number, destX: number, destY: number) =>
    ctx.drawImage(img, col * SRC + qx, row * SRC + qy, HALF, HALF, x + destX * k, y + destY * k, HALF * k, HALF * k);
  const S = EDGE_SHIFT;

  for (const dy of [-1, 1]) {
    for (const dx of [-1, 1]) {
      const vertical = isPath(c, r + dy);
      const horizontal = isPath(c + dx, r);
      const qx = dx < 0 ? 0 : HALF;
      const qy = dy < 0 ? 0 : HALF;
      const topBottomEdge: Src = [DIRT_BLOCK_TOP + (dy < 0 ? 0 : 2), DIRT_BLOCK_LEFT + 1];
      const sideEdge: Src = [DIRT_BLOCK_TOP + 1, DIRT_BLOCK_LEFT + (dx < 0 ? 0 : 2)];

      if (!vertical && !horizontal) {
        // Esquina exterior: al desplazarla en diagonal deja un hueco de S px junto a los bordes
        // de al lado. Se rellena con un trozo de borde antes de poner la esquina encima.
        quarter(topBottomEdge, qx, qy, dx < 0 ? HALF - S : S, qy + dy * S);
        quarter(sideEdge, qx, qy, qx + dx * S, dy < 0 ? HALF - S : S);
        quarter([DIRT_BLOCK_TOP + (dy < 0 ? 0 : 2), DIRT_BLOCK_LEFT + (dx < 0 ? 0 : 2)], qx, qy, qx + dx * S, qy + dy * S);
      } else if (!horizontal) {
        quarter(sideEdge, qx, qy, qx + dx * S, qy);
      } else if (!vertical) {
        quarter(topBottomEdge, qx, qy, qx, qy + dy * S);
      } else if (!isPath(c + dx, r + dy)) {
        // Esquina interior: también se desplaza en diagonal para cuadrar con los bordes
        const inner: Src = [DIRT_INNER_TOP + (dy < 0 ? 1 : 0), DIRT_INNER_LEFT + (dx < 0 ? 1 : 0)];
        quarter(inner, qx, qy, qx + dx * S, qy + dy * S);
      }
      // Rodeado de camino: ya está la tierra de fondo
    }
  }
}
