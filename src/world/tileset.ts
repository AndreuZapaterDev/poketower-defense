import Phaser from 'phaser';
import { MAP_H, MAP_W, TILE } from '../config';
import { GYM_TOP_ROWS, GYM_WALL_ROWS, MAPS, RouteMap, tileKey, type MapDef, type Tile } from '../data/map';

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

// Tileset de interiores de gimnasio (public/assets/tiles/Gyms interior.png), para los mapas
// con `gym`. Está ordenado por gimnasios de arriba abajo: las filas 0 a 10 son las del
// gimnasio de roca (madera, arena, rocas, estatuas, pared, alfombra y escalones).
const GYM_PATH = 'assets/tiles/Gyms interior.png';
/** Tablones del camino y de las zonas de madera */
const GYM_WOOD: Src[] = [[8, 3], [8, 4]];
/**
 * Arena del suelo. La madera está más alta: cuando encima o a la izquierda no hay arena, la
 * casilla lleva la sombra del borde en ese lado.
 */
type SandEdge = 'none' | 'top' | 'left' | 'corner';
const GYM_SAND: Record<SandEdge, Src> = {
  none: [7, 2],
  top: [6, 2],
  left: [8, 1],
  corner: [7, 1],
};
/** Rocas grises sobre arena, con la misma sombra que la arena de debajo, y rocas sueltas transparentes */
const GYM_ROCKS: Src[] = [[0, 5], [0, 6]];
const GYM_SAND_ROCKS: Record<SandEdge, Src[]> = {
  none: [[8, 2]],
  top: [[6, 3], [6, 4]],
  left: [[9, 1]],
  corner: [[6, 3], [6, 4]],
};
/** Zócalo de la pared del fondo; sus primeros píxeles son del color liso del resto del muro */
const GYM_WALL: Src = [2, 2];
const GYM_WALL_PLAIN_H = 14;
/**
 * Cuartos de 16 px (en px del tileset) de la pared lateral izquierda; la derecha es la misma en
 * espejo: muro liso, muro con su filo claro a la derecha y una piedra de las columnas
 */
const GYM_SIDE = { plain: { x: 16, y: 64 }, edge: { x: 16, y: 112 }, stone: { x: 16, y: 160 } };
/** Filas de la pared lateral con columna de piedras: junto a la alfombra y junto a la entrada */
const isSideStoneRow = (r: number) => r < GYM_TOP_ROWS || r >= MAP_H / TILE - 2;
/** Emblema de la pared, sobre el centro de la plataforma del líder, y su sombra en la alfombra */
const GYM_EMBLEM: Src = [2, 3];
const GYM_CARPET_EMBLEM: Src = [3, 3];
/**
 * Alfombra del fondo (con columnas de piedra en los extremos): fila de arriba y de abajo, con
 * su extremo izquierdo; el derecho es el izquierdo en espejo
 */
const GYM_CARPET: { end: Src; mid: Src }[] = [
  { end: [3, 1], mid: [3, 2] },
  { end: [4, 1], mid: [4, 2] },
];
/** Adorno sobre la fila de arriba de la alfombra */
const GYM_CARPET_DECOR: Src = [3, 4];
/** Alfombrilla azul de la entrada (en px del tileset; no va alineada a la cuadrícula) */
const GYM_DOOR_MAT = { x: 86, y: 8, w: 52, h: 32 };
/** Estatua del gimnasio: 1 casilla de ancho y 2 de alto */
const GYM_STATUE: Src = [0, 1];
const GYM_SIGN: Src = [0, 7];
/** Escalones de piedra de la plataforma del líder (extremo izquierdo, centro y extremo derecho) */
const GYM_STEPS: Src[] = [[10, 2], [10, 3], [10, 4]];
/** Escalón estrecho por el que se sube a la plataforma, al final del camino */
const GYM_STEP_UP: Src = [9, 3];
/** Roca del líder, de 2x2 casillas; en el tileset está desplazada media casilla a la derecha */
const GYM_LEADER_ROCK = { x: 176, y: 288 };
/** Fotograma del líder (mirando abajo) y altura sobre la roca a la que quedan sus pies, en px */
const LEADER_FRAME = { w: 32, h: 48 };
const LEADER_FEET_Y = 34;

let outside: HTMLImageElement | null = null;
let gymTiles: HTMLImageElement | null = null;
/** Imágenes de los líderes de gimnasio, por ruta */
const leaders = new Map<string, HTMLImageElement>();

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
export async function loadTilesets(): Promise<void> {
  const leaderPaths = [...new Set(MAPS.flatMap((def) => (def.leader ? [def.leader] : [])))];
  const [out, gym, ...leaderImgs] = await Promise.all([OUTSIDE_PATH, GYM_PATH, ...leaderPaths].map(loadImage));
  [outside, gymTiles] = [out, gym];
  leaderPaths.forEach((path, i) => {
    const img = leaderImgs[i];
    if (img) leaders.set(path, img);
  });
}

/** Crea las texturas de los mapas con tileset; se salta los que no tengan su tileset cargado */
export function buildTilesetTextures(scene: Phaser.Scene, maps: { def: MapDef; key: string }[]): void {
  for (const { def, key } of maps) {
    if (scene.textures.exists(key)) continue;
    if (def.gym && gymTiles) scene.textures.addCanvas(key, drawGymMap(def, gymTiles));
    else if (!def.gym && outside) scene.textures.addCanvas(key, drawTileMap(def, outside));
  }
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

function drawTileMap(def: MapDef, img: HTMLImageElement): HTMLCanvasElement {
  const map = new RouteMap(def);
  const canvas = newCanvas(MAP_W, MAP_H);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  // Semilla fija por mapa: los detalles al azar salen siempre iguales
  const rng = new Phaser.Math.RandomDataGenerator([`poketower-${def.id}`]);
  const cols = MAP_W / TILE;
  const rows = MAP_H / TILE;

  const cells: Tile[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push([c, r]);
  for (const [c, r] of cells) blit(ctx, img, GRASS[rng.between(0, GRASS.length - 1)], c * TILE, r * TILE);
  // Flores en algunas casillas libres
  for (const [c, r] of cells) {
    if (map.isBuildable(c, r) && rng.frac() < 0.1) blit(ctx, img, FLOWERS, c * TILE, r * TILE);
  }
  for (const [c, r] of def.tallGrass) blit(ctx, img, TALL_GRASS, c * TILE, r * TILE);
  for (const [c, r] of def.ponds) blit(ctx, img, POND, c * TILE, r * TILE, 3, 3);
  // El camino va después de la hierba porque sus bordes invaden un poco las casillas vecinas
  drawPath(ctx, img, map);
  if (def.sign) blit(ctx, img, SIGN, def.sign[0] * TILE, def.sign[1] * TILE);
  for (const [c, r] of def.rocks ?? []) blit(ctx, img, ROCK, c * TILE, r * TILE);
  for (const [c, r] of def.bushes ?? []) blit(ctx, img, BUSH, c * TILE, r * TILE);

  // Árboles de arriba abajo, para que las copas de los de delante tapen los troncos de detrás
  const sprites: Sprite[] = def.trees.map(([c, r]) => ({
    bottom: r,
    draw: () => blit(ctx, img, PINE, c * TILE, (r - 2) * TILE, 1, 3),
  }));
  // Vallas: pieza de extremo o de en medio según si siguen a izquierda o derecha
  const fences = new Set((def.fences ?? []).map(([c, r]) => tileKey(c, r)));
  for (const [c, r] of def.fences ?? []) {
    const left = fences.has(tileKey(c - 1, r));
    const right = fences.has(tileKey(c + 1, r));
    const piece: Src = [FENCE_ROW, left && right ? FENCE_MID : left ? FENCE_RIGHT : FENCE_LEFT];
    sprites.push({ bottom: r, draw: () => blit(ctx, img, piece, c * TILE, r * TILE) });
  }
  for (const sprite of sprites.sort((a, b) => a.bottom - b.bottom)) sprite.draw();

  if (map.pokecenter) blit(ctx, img, POKECENTER, map.pokecenter.x, map.pokecenter.y, 5, 5);
  return canvas;
}

/**
 * Interior de gimnasio: suelo de arena con rocas, camino de tablones, la pared y la alfombra del
 * fondo, la alfombrilla de la entrada, estatuas y el líder sobre su roca en la plataforma
 */
function drawGymMap(def: MapDef, img: HTMLImageElement): HTMLCanvasElement {
  const map = new RouteMap(def);
  const canvas = newCanvas(MAP_W, MAP_H);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const rng = new Phaser.Math.RandomDataGenerator([`poketower-${def.id}`]);
  const cols = MAP_W / TILE;
  const rows = MAP_H / TILE;
  const k = TILE / SRC;
  const stage = map.leaderStage;
  const inStage = (c: number, r: number) =>
    !!stage && c * TILE >= stage.x && c * TILE < stage.x + stage.w && r * TILE >= stage.y && r * TILE < stage.y + stage.h;
  const [left, right] = def.room ?? [0, cols - 1];

  // Suelo de arena, con sombra donde limita con algo más alto (arriba o a la izquierda, también
  // junto a la pared lateral)
  const wood = new Set((def.wood ?? []).map(([c, r]) => tileKey(c, r)));
  const isWood = (c: number, r: number) => map.isPath(c, r) || wood.has(tileKey(c, r));
  const isSand = (c: number, r: number) =>
    r >= GYM_TOP_ROWS && c >= left && c <= right && !isWood(c, r) && !inStage(c, r);
  const sandEdge = (c: number, r: number): SandEdge => {
    const up = isSand(c, r - 1);
    const leftSand = isSand(c - 1, r);
    return up ? (leftSand ? 'none' : 'left') : leftSand ? 'top' : 'corner';
  };
  for (let r = GYM_TOP_ROWS; r < rows; r++) {
    for (let c = left; c <= right; c++) {
      const piece = isWood(c, r) ? GYM_WOOD[rng.between(0, GYM_WOOD.length - 1)] : GYM_SAND[sandEdge(c, r)];
      blit(ctx, img, piece, c * TILE, r * TILE);
    }
  }
  // El emblema va encima del líder, en la columna de la última casilla del camino
  drawGymBack(ctx, img, def, left, right, stage ? def.path[def.path.length - 1][0] : -1);

  if (map.door) {
    const [c, r] = map.door;
    const mat = GYM_DOOR_MAT;
    ctx.drawImage(img, mat.x, mat.y, mat.w, mat.h, (c + 0.5) * TILE - (mat.w * k) / 2, r * TILE, mat.w * k, mat.h * k);
  }

  // Sobre la arena, rocas grises que llevan la misma sombra que la arena de debajo
  for (const [c, r] of def.rocks ?? []) {
    const set = isSand(c, r) ? GYM_SAND_ROCKS[sandEdge(c, r)] : GYM_ROCKS;
    blit(ctx, img, set[rng.between(0, set.length - 1)], c * TILE, r * TILE);
  }
  if (def.sign) blit(ctx, img, GYM_SIGN, def.sign[0] * TILE, def.sign[1] * TILE);
  for (const [c, r] of def.statues ?? []) blit(ctx, img, GYM_STATUE, c * TILE, (r - 1) * TILE, 1, 2);

  if (stage) {
    // Escalón estrecho en la última casilla del camino, para subir a la plataforma
    const [endCol, endRow] = def.path[def.path.length - 1];
    blit(ctx, img, GYM_STEP_UP, endCol * TILE, endRow * TILE);
    drawLeaderStage(ctx, img, def, stage);
  }
  return canvas;
}

/**
 * Paredes del gimnasio: la del fondo a todo lo ancho (con el emblema en la columna `emblemCol`),
 * debajo la alfombra entre las columnas `left` y `right` del interior, las paredes laterales a
 * cada lado del interior y, más allá, pared lisa
 */
function drawGymBack(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  def: MapDef,
  left: number,
  right: number,
  emblemCol: number,
): void {
  const cols = MAP_W / TILE;
  const rows = MAP_H / TILE;
  const Q = HALF;
  const k = TILE / SRC;
  /** Copia un cuarto de 16 px del tileset; con `w`/`h` lo estira (solo para los de color liso) */
  const quarter = (q: { x: number; y: number }, x: number, y: number, w = Q * k, h = Q * k) =>
    ctx.drawImage(img, q.x, q.y, Q, Q, x, y, w, h);

  for (let r = GYM_WALL_ROWS; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c < left - 1 || c > right + 1) quarter(GYM_SIDE.plain, c * TILE, r * TILE, TILE, TILE);
    }
    // Pared lateral izquierda y, en espejo, la derecha: muro con su filo claro hacia dentro y,
    // junto a la alfombra y la entrada, una columna de piedras
    const stones = isSideStoneRow(r);
    const drawSide = (x: number) => {
      for (const dy of [0, Q * k]) {
        quarter(stones ? GYM_SIDE.edge : GYM_SIDE.plain, x, r * TILE + dy);
        quarter(stones ? GYM_SIDE.stone : GYM_SIDE.edge, x + Q * k, r * TILE + dy);
      }
    };
    drawSide((left - 1) * TILE);
    ctx.save();
    ctx.scale(-1, 1);
    drawSide(-(right + 2) * TILE);
    ctx.restore();
  }

  // Pared del fondo: el zócalo en la última fila y, por encima, su franja lisa estirada
  const [wallRow, wallCol] = GYM_WALL;
  for (let c = 0; c < cols; c++) {
    ctx.drawImage(img, wallCol * SRC, wallRow * SRC, SRC, GYM_WALL_PLAIN_H, c * TILE, 0, TILE, (GYM_WALL_ROWS - 1) * TILE);
    blit(ctx, img, c === emblemCol ? GYM_EMBLEM : GYM_WALL, c * TILE, (GYM_WALL_ROWS - 1) * TILE);
  }
  GYM_CARPET.forEach(({ end, mid }, i) => {
    const y = (GYM_WALL_ROWS + i) * TILE;
    blit(ctx, img, end, left * TILE, y);
    for (let c = left + 1; c < right; c++) {
      let piece = mid;
      if (i === 0 && c === emblemCol) piece = GYM_CARPET_EMBLEM;
      else if (i === 0 && def.carpetDecor?.includes(c)) piece = GYM_CARPET_DECOR;
      blit(ctx, img, piece, c * TILE, y);
    }
    // Extremo derecho: el izquierdo en espejo
    ctx.save();
    ctx.scale(-1, 1);
    blit(ctx, img, end, -(right + 1) * TILE, y);
    ctx.restore();
  });
}

/** Plataforma del líder: escalones de piedra y, en el centro de arriba, el líder de pie sobre su roca */
function drawLeaderStage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  def: MapDef,
  stage: { x: number; y: number; w: number; h: number },
): void {
  const k = TILE / SRC;
  const cols = stage.w / TILE;
  const [left, mid, right] = GYM_STEPS;
  for (let y = stage.y; y < stage.y + stage.h; y += TILE) {
    for (let c = 0; c < cols; c++) blit(ctx, img, c === 0 ? left : c === cols - 1 ? right : mid, stage.x + c * TILE, y);
  }

  const rock = { x: stage.x + (stage.w - 2 * TILE) / 2, y: stage.y };
  ctx.drawImage(img, GYM_LEADER_ROCK.x, GYM_LEADER_ROCK.y, 2 * SRC, 2 * SRC, rock.x, rock.y, 2 * TILE, 2 * TILE);
  const leader = def.leader ? leaders.get(def.leader) : undefined;
  if (leader) {
    const { w, h } = LEADER_FRAME;
    ctx.drawImage(leader, 0, 0, w, h, rock.x + TILE - (w * k) / 2, rock.y + (LEADER_FEET_Y - h) * k, w * k, h * k);
  }
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
