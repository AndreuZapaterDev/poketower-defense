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
   * puerta del Centro Pokémon (fuera del mapa con `goal: 'exit'`, o delante del líder con
   * `goal: 'leader'`). Los tramos deben ser rectos.
   */
  path: Tile[];
  /**
   * Meta de los enemigos: el Centro Pokémon (por defecto), la salida del mapa sin edificio, o el
   * líder del gimnasio, subido a una roca sobre una plataforma de escalones de 7x3 casillas
   * justo encima del final del camino
   */
  goal?: 'pokecenter' | 'exit' | 'leader';
  /**
   * Imagen del líder del gimnasio, con `goal: 'leader'`: hoja de 4x4 fotogramas de 32x48 px
   * (una fila por dirección); se dibuja el primero, mirando hacia abajo
   */
  leader?: string;
  /** Vallas de madera (solo con tileset); las casillas seguidas en una fila forman una valla */
  fences?: Tile[];
  /** Casilla de hierba alta por la que aparecen los Pokémon salvajes */
  spawn: Tile;
  trees: Tile[];
  /** Esquina superior izquierda de cada estanque (ocupan 3x3 casillas, 96x96 px) */
  ponds: Tile[];
  tallGrass: Tile[];
  /** Cartel de madera con el nombre de la ruta */
  sign?: Tile;
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
   * Interior de gimnasio (ver world/tileset.ts): suelo de arena, camino de tablones de madera,
   * arriba la pared y una alfombra (GYM_TOP_ROWS filas en las que no se puede construir) y la
   * alfombrilla de la entrada en la primera casilla del camino, que tapa un poco la de cada lado
   */
  gym?: boolean;
  /** Estatuas del gimnasio (solo con tileset): ocupan su casilla y la de encima */
  statues?: Tile[];
  /** Zonas de suelo de madera del gimnasio, además del camino; se puede construir encima */
  wood?: Tile[];
  /** Columnas de la alfombra del fondo con un adorno */
  carpetDecor?: number[];
  /**
   * Primera y última columna del interior del gimnasio: a cada lado va una columna de pared
   * lateral y, más allá (en pantallas anchas), pared maciza. No se puede construir fuera.
   */
  room?: [left: number, right: number];
}

/** Columnas para las que están diseñados los mapas; en pantallas anchas el mapa tiene más (ver COLS) */
const DESIGN_COLS = 24;

/** Filas de pared en lo alto de los mapas de gimnasio */
export const GYM_WALL_ROWS = 2;
/** Filas de alfombra bajo la pared del gimnasio */
export const GYM_CARPET_ROWS = 2;
/** Filas de arriba de los gimnasios en las que no se puede construir: pared y alfombra */
export const GYM_TOP_ROWS = GYM_WALL_ROWS + GYM_CARPET_ROWS;

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
  gimnasioPlateada(),
];

/**
 * Gimnasio de Ciudad Plateada (tipo roca), adaptado del original: una sala centrada en el mapa,
 * con paredes a los lados, suelo de arena con rocas grises, la alfombra del fondo bajo la pared
 * y Brock en su roca, en el centro de una plataforma de escalones. Se entra por la alfombrilla
 * de abajo y se sube por el pasillo central, entre dos estatuas. Como en el original, el suelo
 * alterna franjas de tablones y de arena: el camino recorre las franjas en zigzag (para que haya
 * recorrido donde atacar) y llega a Brock de frente, por el escalón de la plataforma; nunca pasa
 * por detrás de él. La decoración es simétrica respecto a la columna central.
 */
function gimnasioPlateada(): MapDef {
  // Interior de 21 columnas; con las dos paredes laterales, 23, centradas en el mapa
  const inner = 21;
  const left = Math.floor((COLS - inner - 2) / 2) + 1;
  const cx = left + (inner - 1) / 2;
  /** Casilla a `d` columnas del centro */
  const at = (d: number, r: number): Tile => [cx + d, r];
  /** La casilla a `d` columnas del centro y su simétrica */
  const pair = (d: number, r: number): Tile[] => [at(-d, r), at(d, r)];
  return {
    id: 'gimnasioplateada',
    name: 'GIMNASIO PLATEADA',
    // Franjas de tablones en las filas 15, 13 y 11, unidas por los extremos; de la última se
    // sube recto por el centro hasta la plataforma
    path: [at(0, ROWS), at(0, 15), at(9, 15), at(9, 13), at(-9, 13), at(-9, 11), at(0, 11), at(0, 8)],
    goal: 'leader',
    leader: 'assets/characters/gym/trainer_LEADER_Brock.png',
    spawn: at(0, ROWS - 1),
    trees: [],
    ponds: [],
    tallGrass: [],
    tileset: true,
    gym: true,
    room: [left, left + inner - 1],
    statues: pair(2, ROWS - 1),
    // Esquinas escalonadas de madera arriba y suelo de madera junto a la entrada
    wood: [...pair(10, 4), ...pair(9, 4), ...pair(8, 4), ...pair(10, 5), ...pair(9, 5), ...pair(10, 6),
      ...rect(left, ROWS - 1, inner, 1)],
    carpetDecor: pair(4, 0).concat(pair(2, 0)).map(([c]) => c),
    // Alrededor de la plataforma, como en el original; y alguna en las franjas de arena
    rocks: [
      ...pair(2, 4), ...pair(5, 6), ...pair(7, 8), ...pair(3, 8),
      ...pair(10, 10), ...pair(10, 14), ...pair(5, 16), ...pair(9, 16),
    ],
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
  /** Rectángulo del Centro Pokémon, o null si la meta es otra */
  readonly pokecenter: { x: number; y: number; w: number; h: number } | null;
  /** Rectángulo del escenario del líder del gimnasio, con `goal: 'leader'` */
  readonly leaderStage: { x: number; y: number; w: number; h: number } | null;
  /** Casilla de la entrada de los gimnasios (la primera del camino dentro del mapa) */
  readonly door: Tile | null;
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
    const goalTiles: Tile[] = [];
    this.leaderStage = null;
    if (def.goal === 'exit') {
      this.pokecenter = null;
    } else if (def.goal === 'leader') {
      // Plataforma de 7x3 casillas centrada sobre la última casilla del camino
      this.pokecenter = null;
      this.leaderStage = { x: (endCol - 3) * TILE, y: (endRow - 3) * TILE, w: TILE * 7, h: TILE * 3 };
      goalTiles.push(...rect(endCol - 3, endRow - 3, 7, 3));
    } else if (def.tileset) {
      // El del tileset ocupa 5x5 casillas, con la puerta en la última casilla del camino
      this.pokecenter = { x: (endCol - 2) * TILE, y: (endRow - 4) * TILE, w: TILE * 5, h: TILE * 5 };
      for (let r = endRow - 4; r <= endRow; r++) {
        for (let c = endCol - 2; c <= endCol + 2; c++) goalTiles.push([c, r]);
      }
    } else {
      // El Centro Pokémon ocupa 3x3 casillas con la puerta sobre el final del camino
      this.pokecenter = { x: (endCol - 1) * TILE, y: endRow * TILE + 12 - TILE * 3, w: TILE * 3, h: TILE * 3 };
      for (let r = endRow - 3; r < endRow; r++) {
        for (let c = endCol - 1; c <= endCol + 1; c++) goalTiles.push([c, r]);
      }
    }
    // Fuera del interior del gimnasio todo es pared
    const outside: Tile[] = [];
    if (def.room) {
      const [left, right] = def.room;
      outside.push(...rect(0, 0, left, ROWS), ...rect(right + 1, 0, COLS - right - 1, ROWS));
    }
    // La alfombrilla de la entrada del gimnasio tapa un poco la casilla de cada lado
    this.door = def.gym ? (this.centerline.find(([c, r]) => c >= 0 && c < COLS && r >= 0 && r < ROWS) ?? null) : null;
    const doorSides: Tile[] = this.door ? [[this.door[0] - 1, this.door[1]], [this.door[0] + 1, this.door[1]]] : [];
    // Los pinos del tileset tapan con la copa la casilla de encima
    const crowns: Tile[] = def.tileset ? def.trees.map(([c, r]): Tile => [c, r - 1]) : [];

    this.blocked = new Set(
      [
        ...def.trees,
        ...crowns,
        ...def.ponds.flatMap(pondTiles),
        ...def.tallGrass,
        ...(def.sign ? [def.sign] : []),
        ...(def.rocks ?? []),
        ...(def.bushes ?? []),
        ...(def.statues ?? []).flatMap(([c, r]) => rect(c, r - 1, 1, 2)),
        ...(def.gym ? rect(0, 0, COLS, GYM_TOP_ROWS) : []),
        ...outside,
        ...doorSides,
        ...(def.fences ?? []),
        ...goalTiles,
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
