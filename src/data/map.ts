import Phaser from 'phaser';
import { COLS, ROWS, TILE } from '../config';

type Tile = [number, number];

// Recorrido en coordenadas de casilla [columna, fila]. Empieza fuera del mapa
// y termina en la puerta del Centro Pokémon. Los tramos deben ser rectos.
export const PATH: Tile[] = [
  [-1, 2],
  [3, 2],
  [3, 8],
  [7, 8],
  [7, 3],
  [11, 3],
  [11, 9],
  [14, 9],
  [14, 5],
];

/** Casilla de hierba alta por la que aparecen los Pokémon salvajes */
export const SPAWN_TILE: Tile = [0, 2];

export const TREES: Tile[] = [
  [0, 0], [1, 0], [6, 0], [9, 0], [10, 0], [15, 0], [15, 1],
  [0, 11], [1, 11], [5, 11], [9, 11], [10, 11], [15, 10], [15, 11],
];
export const POND: Tile[] = [[0, 9], [1, 9], [0, 10], [1, 10]];
export const TALL_GRASS: Tile[] = [[0, 1], [1, 1], [0, 3], [1, 3]];
/** Cartel de madera con el nombre de la ruta */
export const SIGN: Tile = [1, 5];

// El Centro Pokémon ocupa 2x2 casillas con la puerta sobre el final del camino
const [endCol, endRow] = PATH[PATH.length - 1];
export const POKECENTER = {
  x: endCol * TILE + TILE / 2 - TILE,
  y: endRow * TILE + 12 - TILE * 2,
  w: TILE * 2,
  h: TILE * 2,
};
const POKECENTER_TILES: Tile[] = [
  [endCol - 1, endRow - 2], [endCol, endRow - 2], [endCol + 1, endRow - 2],
  [endCol - 1, endRow - 1], [endCol, endRow - 1], [endCol + 1, endRow - 1],
];

export const tileKey = (col: number, row: number) => `${col},${row}`;

export const tileCenter = (col: number, row: number) =>
  new Phaser.Math.Vector2(col * TILE + TILE / 2, row * TILE + TILE / 2);

export const WAYPOINTS = PATH.map(([c, r]) => tileCenter(c, r));

export const PATH_TILES: Set<string> = (() => {
  const tiles = new Set<string>();
  for (let i = 0; i < PATH.length - 1; i++) {
    let [c, r] = PATH[i];
    const [c2, r2] = PATH[i + 1];
    const dc = Math.sign(c2 - c);
    const dr = Math.sign(r2 - r);
    tiles.add(tileKey(c, r));
    while (c !== c2 || r !== r2) {
      c += dc;
      r += dr;
      tiles.add(tileKey(c, r));
    }
  }
  return tiles;
})();

const BLOCKED = new Set([...TREES, ...POND, ...TALL_GRASS, SIGN, ...POKECENTER_TILES].map(([c, r]) => tileKey(c, r)));

export const isBuildable = (col: number, row: number) =>
  col >= 0 &&
  col < COLS &&
  row >= 0 &&
  row < ROWS &&
  !PATH_TILES.has(tileKey(col, row)) &&
  !BLOCKED.has(tileKey(col, row));

export const isDecorated = (col: number, row: number) => BLOCKED.has(tileKey(col, row));
