import Phaser from 'phaser';
import { COLS, ROWS, TILE } from '../config';

export type Tile = [number, number];

/** Se elige al empezar la partida, en cualquier mapa */
export type Difficulty = 'easy' | 'hard';
export const DIFFICULTY_IDS: Difficulty[] = ['easy', 'hard'];

export interface DifficultyDef {
  label: string;
  startMoney: number;
  startLives: number;
  /** Cada oleada los enemigos tienen este porcentaje más de vida que en la anterior */
  hpGrowth: number;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyDef> = {
  easy: { label: 'FACIL', startMoney: 300, startLives: 20, hpGrowth: 0.15 },
  hard: { label: 'DIFICIL', startMoney: 250, startLives: 10, hpGrowth: 0.22 },
};

export const difficultyById = (id: string | undefined): Difficulty => (id === 'hard' ? 'hard' : 'easy');

export interface MapDef {
  id: string;
  name: string;
  /**
   * Recorrido en coordenadas de casilla [columna, fila]. Empieza fuera del mapa
   * y termina en la puerta del Centro Pokémon. Los tramos deben ser rectos.
   */
  path: Tile[];
  /** Casilla de hierba alta por la que aparecen los Pokémon salvajes */
  spawn: Tile;
  trees: Tile[];
  /** Esquina superior izquierda de cada estanque (ocupan 3x3 casillas, 96x96 px) */
  ponds: Tile[];
  tallGrass: Tile[];
  /** Cartel de madera con el nombre de la ruta */
  sign: Tile;
}

export const MAPS: MapDef[] = [
  {
    id: 'ruta1',
    name: 'RUTA 1',
    path: [
      [-1, 3],
      [5, 3],
      [5, 13],
      [11, 13],
      [11, 5],
      [17, 5],
      [17, 14],
      [21, 14],
      [21, 9],
    ],
    spawn: [0, 3],
    trees: [
      [0, 0], [1, 0], [2, 0], [8, 0], [9, 0], [14, 0], [15, 0], [22, 0], [23, 0], [23, 1],
      [8, 8], [14, 10], [14, 11], [20, 2], [2, 11],
      [0, 17], [1, 17], [7, 17], [8, 17], [14, 17], [15, 17], [22, 17], [23, 17], [23, 16],
    ],
    ponds: [[0, 14]],
    tallGrass: [[0, 2], [1, 2], [0, 4], [1, 4]],
    sign: [3, 7],
  },
  {
    // Camino más corto y con menos sitio para construir
    id: 'ruta2',
    name: 'RUTA 2',
    path: [
      [3, -1],
      [3, 6],
      [12, 6],
      [12, 12],
      [19, 12],
      [19, 8],
    ],
    spawn: [3, 0],
    trees: [
      [0, 0], [1, 0], [6, 0], [7, 0], [8, 0], [13, 0], [20, 0], [21, 0], [22, 0], [23, 0],
      [0, 1], [22, 1], [23, 1],
      [5, 4], [6, 4], [9, 4], [10, 8], [9, 9], [7, 10], [5, 13], [1, 9],
      [14, 9], [15, 9], [16, 14], [17, 14], [21, 10], [22, 10],
      [0, 17], [1, 17], [2, 17], [9, 17], [10, 17], [11, 17], [18, 17], [19, 17], [22, 17], [23, 17], [23, 16],
    ],
    ponds: [[14, 1], [1, 12]],
    tallGrass: [[2, 0], [4, 0], [2, 1], [4, 1]],
    sign: [1, 4],
  },
];

export const mapById = (id: string | undefined) => MAPS.find((m) => m.id === id) ?? MAPS[0];

export const tileKey = (col: number, row: number) => `${col},${row}`;

export const tileCenter = (col: number, row: number) =>
  new Phaser.Math.Vector2(col * TILE + TILE / 2, row * TILE + TILE / 2);

/** Casillas que ocupa cada estanque */
export const pondTiles = ([c0, r0]: Tile): Tile[] =>
  [0, 1, 2].flatMap((r) => [0, 1, 2].map((c): Tile => [c0 + c, r0 + r]));

/** Datos derivados de un mapa: casillas del camino, zonas bloqueadas y Centro Pokémon */
export class RouteMap {
  readonly def: MapDef;
  readonly waypoints: Phaser.Math.Vector2[];
  readonly pathTiles = new Set<string>();
  readonly pokecenter: { x: number; y: number; w: number; h: number };
  private readonly blocked: Set<string>;

  constructor(def: MapDef) {
    this.def = def;
    this.waypoints = def.path.map(([c, r]) => tileCenter(c, r));

    for (let i = 0; i < def.path.length - 1; i++) {
      let [c, r] = def.path[i];
      const [c2, r2] = def.path[i + 1];
      const dc = Math.sign(c2 - c);
      const dr = Math.sign(r2 - r);
      this.pathTiles.add(tileKey(c, r));
      while (c !== c2 || r !== r2) {
        c += dc;
        r += dr;
        this.pathTiles.add(tileKey(c, r));
      }
    }

    // El Centro Pokémon ocupa 3x3 casillas con la puerta sobre el final del camino
    const [endCol, endRow] = def.path[def.path.length - 1];
    this.pokecenter = {
      x: (endCol - 1) * TILE,
      y: endRow * TILE + 12 - TILE * 3,
      w: TILE * 3,
      h: TILE * 3,
    };
    const pokecenterTiles: Tile[] = [];
    for (let r = endRow - 3; r < endRow; r++) {
      for (let c = endCol - 1; c <= endCol + 1; c++) pokecenterTiles.push([c, r]);
    }

    this.blocked = new Set(
      [...def.trees, ...def.ponds.flatMap(pondTiles), ...def.tallGrass, def.sign, ...pokecenterTiles].map(([c, r]) =>
        tileKey(c, r),
      ),
    );
  }

  isPath(col: number, row: number): boolean {
    return this.pathTiles.has(tileKey(col, row));
  }

  isBuildable(col: number, row: number): boolean {
    return (
      col >= 0 &&
      col < COLS &&
      row >= 0 &&
      row < ROWS &&
      !this.pathTiles.has(tileKey(col, row)) &&
      !this.blocked.has(tileKey(col, row))
    );
  }
}

export const mapTextureKey = (id: string) => `route-map-${id}`;
