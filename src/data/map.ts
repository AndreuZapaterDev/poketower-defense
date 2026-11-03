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
   * Recorrido en coordenadas de casilla [columna, fila]. Empieza fuera del mapa y termina en la
   * puerta del Centro Pokémon (o fuera del mapa, con `goal: 'exit'`). Los tramos deben ser rectos.
   */
  path: Tile[];
  /** Meta de los enemigos: el Centro Pokémon (por defecto) o la salida del mapa, sin edificio */
  goal?: 'pokecenter' | 'exit';
  /** Vallas de madera (solo con tileset); las casillas seguidas en una fila forman una valla */
  fences?: Tile[];
  /** Casilla de hierba alta por la que aparecen los Pokémon salvajes */
  spawn: Tile;
  trees: Tile[];
  /** Esquina superior izquierda de cada estanque (ocupan 3x3 casillas, 96x96 px) */
  ponds: Tile[];
  tallGrass: Tile[];
  /** Cartel de madera con el nombre de la ruta */
  sign: Tile;
  /**
   * Se dibuja con el tileset de exteriores (ver world/tileset.ts). Los árboles son pinos
   * que tapan también la casilla de encima, y el Centro Pokémon ocupa 5x5 casillas.
   */
  tileset?: boolean;
  /** Ancho del camino en casillas (impar; 1 si no se indica) */
  pathWidth?: number;
  /** Rocas y arbustos decorativos (solo con tileset); no se puede construir encima */
  rocks?: Tile[];
  bushes?: Tile[];
  /**
   * Pinos grandes del tileset del bosque (solo con tileset): esquina superior izquierda de
   * cada uno. Ocupan 2x3 casillas y no se puede construir en ninguna de ellas.
   */
  pines?: Tile[];
  /** Esquina superior izquierda de cada árbol redondo de 2x2 del tileset del bosque */
  bigTrees?: Tile[];
}

/** Columnas para las que están diseñados los mapas; en pantallas anchas el mapa tiene más (ver COLS) */
const DESIGN_COLS = 24;

/** Bosque de pinos al tresbolillo que llena las columnas de más, a la derecha del mapa */
function forestMargin(): Tile[] {
  const trees: Tile[] = [];
  for (let c = DESIGN_COLS; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) if ((c + r) % 2 === 0) trees.push([c, r]);
  }
  return trees;
}

/** Fila completa de pinos, menos las columnas indicadas */
const treeRow = (row: number, gaps: number[]): Tile[] =>
  Array.from({ length: DESIGN_COLS }, (_, c): Tile => [c, row]).filter(([c]) => !gaps.includes(c));

export const MAPS: MapDef[] = [
  {
    id: 'ruta1',
    name: 'RUTA 1',
    // Se sale de la ruta por arriba, junto a una valla
    path: [
      [-1, 3],
      [5, 3],
      [5, 13],
      [11, 13],
      [11, 5],
      [17, 5],
      [17, 14],
      [21, 14],
      [21, -1],
    ],
    goal: 'exit',
    spawn: [0, 3],
    // Bosque arriba, abajo y a la derecha, con algunos pinos sueltos dentro de la ruta. Los
    // decorados de las filas 15 y 16 van en los huecos de la fila de abajo, para que no los
    // tapen las copas.
    trees: [
      ...treeRow(0, [4, 11, 18, 21]),
      ...treeRow(17, [10, 19]),
      [23, 16],
      [8, 8], [14, 10], [14, 11], [2, 11],
      ...forestMargin(),
    ],
    ponds: [[0, 12]],
    // Zonas de hierba alta, siempre a una casilla o más del camino
    tallGrass: [
      [7, 1], [8, 1], [7, 2], [8, 2],
      [0, 9], [1, 9], [0, 10], [1, 10],
      [7, 10], [8, 10], [7, 11], [8, 11],
      [13, 1], [14, 1], [13, 2], [14, 2],
    ],
    sign: [3, 7],
    fences: [[18, 1], [19, 1], [20, 1]],
    tileset: true,
    rocks: [[1, 7], [15, 2], [23, 12], [10, 15]],
    bushes: [[4, 1], [12, 2], [19, 15], [3, 14]],
  },
  bosqueVerde(),
];

/**
 * Bosque Verde: se entra por abajo y el camino serpentea entre los árboles hasta la salida del
 * bosque, arriba a la derecha, entre dos vallas. Solo se construye en los claros que deja el
 * bosque junto al camino; su anchura cambia poco a poco para que los bordes no sean rectos.
 */
function bosqueVerde(): MapDef {
  const path: Tile[] = [
    [2, ROWS],
    [2, 14],
    [8, 14],
    [8, 9],
    [4, 9],
    [4, 3],
    [12, 3],
    [12, 13],
    [17, 13],
    [17, 6],
    [21, 6],
    [21, -1],
  ];
  const sign: Tile = [19, 4];
  const fences: Tile[] = [[18, 2], [19, 2], [20, 2], [22, 2], [23, 2], [24, 2]];
  // Zonas de hierba alta en los claros, siempre a una casilla o más del camino
  const tallGrass: Tile[] = [
    [5, 1], [6, 1], [7, 1], [8, 1],
    [14, 8], [15, 8], [14, 9], [15, 9],
    [8, 5], [8, 6], [8, 7],
    [19, 10], [19, 11], [19, 12],
    [0, 12], [1, 12], [0, 13],
    [10, 15], [11, 15], [10, 16], [11, 16],
  ];
  const bushes: Tile[] = [[4, 1], [22, 8], [6, 11]];
  const rocks: Tile[] = [[5, 12], [13, 1], [6, 15]];
  // Árboles en los claros del centro: pinos a los lados de la hierba del primer bucle, otro
  // en la franja central y en la esquina de arriba, y árboles redondos en los huecos
  const centralPines: Tile[] = [[6, 5], [9, 5], [14, 4], [10, 0]];
  const bigTrees: Tile[] = [[14, 11], [18, 8], [10, 10]];
  const decor = new Set<string>(
    [
      ...bigTrees.flatMap(([c, r]) => rect(c, r, 2, 2)),
      sign,
      ...fences,
      ...tallGrass,
      ...bushes,
      ...rocks,
    ].map(([c, r]) => tileKey(c, r)),
  );
  // Distancia mínima al camino a partir de la cual hay bosque: entre 2 y 4 casillas,
  // variando suavemente (claros más anchos o más estrechos según la zona)
  const clearance = (c: number, r: number) => {
    const wave = Math.sin(c * 0.7 + r * 0.3) * 0.5 + Math.sin(r * 0.9 - c * 0.4 + 1.7) * 0.5;
    return wave > 0.55 ? 4 : wave < -0.55 ? 2 : 3;
  };
  const zone = forestAround(path, clearance).filter(([c, r]) => !decor.has(tileKey(c, r)));
  // Ni los pinos ni sus copas pueden tapar el camino, los decorados ni las casillas de al lado
  // del camino (sus bordes las invaden un poco)
  const keep = new Set(decor);
  for (const [c, r] of segmentTiles(path)) for (const [a, b] of rect(c - 1, r - 1, 3, 3)) keep.add(tileKey(a, b));
  const forest = placePines(zone, centralPines, keep);
  return {
    id: 'bosqueverde',
    name: 'BOSQUE VERDE',
    path,
    goal: 'exit',
    spawn: [2, ROWS - 1],
    trees: [],
    pines: forest.pines,
    bigTrees,
    ponds: [],
    tallGrass,
    sign,
    tileset: true,
    bushes: [...bushes, ...forest.fillers],
    rocks,
    fences,
  };
}

function rect(c0: number, r0: number, w: number, h: number): Tile[] {
  return Array.from({ length: w * h }, (_, i): Tile => [c0 + (i % w), r0 + Math.floor(i / w)]);
}

/** Casillas por las que pasa un recorrido de tramos rectos, en orden */
function segmentTiles(path: Tile[]): Tile[] {
  const tiles: Tile[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    let [c, r] = path[i];
    const [c2, r2] = path[i + 1];
    const dc = Math.sign(c2 - c);
    const dr = Math.sign(r2 - r);
    tiles.push([c, r]);
    while (c !== c2 || r !== r2) {
      c += dc;
      r += dr;
      tiles.push([c, r]);
    }
  }
  return tiles;
}

/**
 * Reparte pinos grandes (2x3 casillas) por una zona de bosque, sin que ninguno se monte encima
 * de otro ni de nada: cada pino ocupa sus 6 casillas en exclusiva. `fixed` son pinos ya
 * colocados a mano y `keep` las casillas que nunca se pueden tapar (camino y decorados).
 *  1. Pinos enteros dentro de la zona, primero al tresbolillo y luego en cualquier hueco.
 *  2. Pinos con la copa (la fila de arriba) asomando fuera de la zona, sobre el claro.
 *  3. Arbustos en las casillas de la zona que hayan quedado sueltas.
 * Fuera del mapa cuenta como bosque, para que los pinos del borde salgan cortados.
 */
function placePines(zone: Tile[], fixed: Tile[], keep: Set<string>): { pines: Tile[]; fillers: Tile[] } {
  const inZone = new Set(zone.map(([c, r]) => tileKey(c, r)));
  const inMap = (c: number, r: number) => c >= 0 && c < COLS && r >= 0 && r < ROWS;
  const inForest = (c: number, r: number) => inZone.has(tileKey(c, r)) || !inMap(c, r);
  const used = new Set(fixed.flatMap(([c, r]) => rect(c, r, 2, 3)).map(([c, r]) => tileKey(c, r)));
  const free = (c: number, r: number) => !used.has(tileKey(c, r)) && !keep.has(tileKey(c, r));
  const pines: Tile[] = [...fixed];
  const place = (x: number, top: number, crownOutside: boolean) => {
    const crown = rect(x, top, 2, 1);
    const lower = rect(x, top + 1, 2, 2);
    if (!lower.every(([c, r]) => inForest(c, r) && free(c, r))) return;
    if (!crown.every(([c, r]) => free(c, r) && (crownOutside || inForest(c, r)))) return;
    for (const [c, r] of [...crown, ...lower]) used.add(tileKey(c, r));
    pines.push([x, top]);
  };
  for (let j = -1; 3 * j < ROWS + 3; j++) {
    for (let x = -2 + (j & 1); x < COLS + 1; x += 2) place(x, 3 * j - 1, false);
  }
  for (let top = -2; top < ROWS + 1; top++) for (let x = -1; x < COLS + 1; x++) place(x, top, false);
  for (let top = -2; top < ROWS + 1; top++) for (let x = -1; x < COLS + 1; x++) place(x, top, true);
  const fillers = zone.filter(([c, r]) => inMap(c, r) && free(c, r));
  return { pines, fillers };
}

/** Todas las casillas del mapa a `minDist(c, r)` casillas o más del camino */
function forestAround(path: Tile[], minDist: (c: number, r: number) => number): Tile[] {
  const tiles = segmentTiles(path);
  const near = (c: number, r: number) =>
    tiles.some(([pc, pr]) => Math.max(Math.abs(pc - c), Math.abs(pr - r)) < minDist(c, r));
  const forest: Tile[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) if (!near(c, r)) forest.push([c, r]);
  }
  return forest;
}

export const mapById = (id: string | undefined) => MAPS.find((m) => m.id === id) ?? MAPS[0];

// Funciones (no constantes) para poder usarlas al construir MAPS, que va antes en el fichero
export function tileKey(col: number, row: number): string {
  return `${col},${row}`;
}

export const tileCenter = (col: number, row: number) =>
  new Phaser.Math.Vector2(col * TILE + TILE / 2, row * TILE + TILE / 2);

/** Casillas que ocupa cada estanque */
export function pondTiles([c0, r0]: Tile): Tile[] {
  return [0, 1, 2].flatMap((r) => [0, 1, 2].map((c): Tile => [c0 + c, r0 + r]));
}

/** Datos derivados de un mapa: casillas del camino, zonas bloqueadas y Centro Pokémon */
export class RouteMap {
  readonly def: MapDef;
  readonly waypoints: Phaser.Math.Vector2[];
  readonly pathTiles = new Set<string>();
  /** Casillas por las que pasan los enemigos (el centro del camino), en orden */
  readonly centerline: Tile[] = [];
  /** Rectángulo del Centro Pokémon, o null si el mapa termina en una salida */
  readonly pokecenter: { x: number; y: number; w: number; h: number } | null;
  private readonly blocked: Set<string>;

  constructor(def: MapDef) {
    this.def = def;
    this.waypoints = def.path.map(([c, r]) => tileCenter(c, r));

    // Los enemigos van por el centro; el resto del ancho se reparte a cada lado
    const side = Math.floor(((def.pathWidth ?? 1) - 1) / 2);
    for (const [c, r] of segmentTiles(def.path)) {
      this.centerline.push([c, r]);
      for (let dr = -side; dr <= side; dr++) {
        for (let dc = -side; dc <= side; dc++) this.pathTiles.add(tileKey(c + dc, r + dr));
      }
    }

    // Los bordes del camino invaden un poco las casillas de al lado (también en diagonal) y
    // pisarían las hojas de la hierba alta: avisa si alguna está pegada al camino
    if (import.meta.env.DEV) {
      const touching = def.tallGrass.filter(([c, r]) =>
        [-1, 0, 1].some((dr) => [-1, 0, 1].some((dc) => this.pathTiles.has(tileKey(c + dc, r + dr)))),
      );
      if (touching.length) console.warn(`${def.id}: hierba alta pegada al camino en`, touching);
    }

    const [endCol, endRow] = def.path[def.path.length - 1];
    const pokecenterTiles: Tile[] = [];
    if (def.goal === 'exit') {
      this.pokecenter = null;
    } else if (def.tileset) {
      // El del tileset ocupa 5x5 casillas, con la puerta en la última casilla del camino
      this.pokecenter = { x: (endCol - 2) * TILE, y: (endRow - 4) * TILE, w: TILE * 5, h: TILE * 5 };
      for (let r = endRow - 4; r <= endRow; r++) {
        for (let c = endCol - 2; c <= endCol + 2; c++) pokecenterTiles.push([c, r]);
      }
    } else {
      // El Centro Pokémon ocupa 3x3 casillas con la puerta sobre el final del camino
      this.pokecenter = { x: (endCol - 1) * TILE, y: endRow * TILE + 12 - TILE * 3, w: TILE * 3, h: TILE * 3 };
      for (let r = endRow - 3; r < endRow; r++) {
        for (let c = endCol - 1; c <= endCol + 1; c++) pokecenterTiles.push([c, r]);
      }
    }
    // Los pinos del tileset tapan con la copa la casilla de encima
    const crowns: Tile[] = def.tileset ? def.trees.map(([c, r]): Tile => [c, r - 1]) : [];

    this.blocked = new Set(
      [
        ...def.trees,
        ...crowns,
        ...def.ponds.flatMap(pondTiles),
        ...def.tallGrass,
        def.sign,
        ...(def.rocks ?? []),
        ...(def.bushes ?? []),
        ...(def.pines ?? []).flatMap(([c, r]) => rect(c, r, 2, 3)),
        ...(def.bigTrees ?? []).flatMap(([c, r]) => rect(c, r, 2, 2)),
        ...(def.fences ?? []),
        ...pokecenterTiles,
      ].map(([c, r]) => tileKey(c, r)),
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
