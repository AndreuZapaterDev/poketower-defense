import Phaser from 'phaser';
import { COLS, ROWS, TILE } from '../config';

export type Tile = [number, number];

/** Suelos con autotile de public/assets/tiles (ver world/tileset.ts) */
export type GroundKind = 'light' | 'sand' | 'gravel' | 'dirt' | 'brick' | 'white';

/** Fila de cada dirección en las hojas de los entrenadores */
export type NpcDir = 'down' | 'left' | 'right' | 'up';
export const NPC_DIRS: NpcDir[] = ['down', 'left', 'right', 'up'];

/**
 * Decorados grandes del tileset de exteriores: posición en el tileset ([fila, columna] de la
 * esquina superior izquierda) y tamaño en casillas. Ocupan (y bloquean) todas sus casillas,
 * con `at` en la esquina superior izquierda. Los árboles frondosos asoman la copa por la
 * casilla central de encima (`top`), que también se dibuja y se bloquea.
 */
export const PROPS = {
  /** Árbol frondoso redondo */
  roundTree: { src: [61, 3], w: 3, h: 3, top: true },
  /** Árbol frondoso amarillo, de otoño */
  yellowTree: { src: [67, 3], w: 3, h: 3, top: true },
  /** Pino grande */
  bigPine: { src: [55, 0], w: 3, h: 3 },
  /** Matorral amarillo */
  yellowBush: { src: [65, 3], w: 1, h: 1 },
  /** Matorral grande */
  bigBush: { src: [75, 6], w: 1, h: 1 },
} as const satisfies Record<string, { src: [number, number]; w: number; h: number; top?: boolean }>;
export type PropKind = keyof typeof PROPS;

/** Casillas que ocupa un decorado, incluida la de la copa que asoma por encima */
export function propTiles({ kind, at: [c, r] }: { kind: PropKind; at: Tile }): Tile[] {
  const prop: { w: number; h: number; top?: boolean } = PROPS[kind];
  const tiles = rect(c, r, prop.w, prop.h);
  if (prop.top) tiles.push([c + Math.floor(prop.w / 2), r - 1]);
  return tiles;
}

/**
 * Casillas que tapa el dibujo de un pino del tileset (1x3): el tronco y las dos de encima. No se
 * puede construir en ninguna, y en ellas no debe haber nada más que otros árboles.
 */
export const pineTiles = ([c, r]: Tile): Tile[] => [[c, r], [c, r - 1], [c, r - 2]];

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
  /** Línea corta bajo el nombre en la selección de mapa (en mayúsculas, sin tildes) */
  subtitle?: string;
  /** Id del mapa que hay que completar (en cualquier dificultad) para poder jugar este */
  unlockedBy?: string;
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
   * Zonas de suelo con autotile (solo con tileset): hierba clara, arena, grava... Se dibujan bajo
   * el camino, con bordes y esquinas según las casillas vecinas. Se puede construir encima.
   */
  ground?: { kind: GroundKind; tiles: Tile[] }[];
  /** Decorados grandes (árboles de 3x3, pinos pequeños...); ver PROPS. No se puede construir encima. */
  props?: { kind: PropKind; at: Tile }[];
  /** Macizos de flores animadas (solo con tileset); no se puede construir encima */
  flowers?: Tile[];
  /**
   * Entrenadores que miran la ruta (solo con tileset): imagen de public/assets/characters/NPC
   * (`trainer_<sprite>.png`, 4x4 fotogramas de 32x48) y hacia dónde miran al empezar
   */
  npcs?: { sprite: string; at: Tile; dir?: NpcDir }[];
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

/**
 * Bosque de pinos al tresbolillo que llena las columnas de más, a la derecha del mapa. Empieza en
 * la fila 1: de un pino en la fila 0 solo se vería el tronco.
 */
function forestMargin(): Tile[] {
  const trees: Tile[] = [];
  for (let c = DESIGN_COLS; c < COLS; c++) {
    for (let r = 1; r < ROWS; r++) if ((c + r) % 2 === 0) trees.push([c, r]);
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
    subtitle: 'BOSQUE CON HIERBA ALTA',
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
    // Ruta de bosque: bosque cerrado arriba, abajo y a la derecha (con árboles grandes en el
    // borde de abajo) y pinos sueltos dentro de la ruta. Los pinos tapan su casilla y las dos de
    // encima: ahí solo puede haber otros árboles (ver pineTiles).
    trees: [
      // Borde de arriba en dos filas, con la salida (columna 21) entre dos pinos
      ...treeRow(1, [0, 1, 2, 21]),
      [3, 2], [11, 2], [16, 2], [18, 2], [20, 2], [22, 2], [23, 2],
      // Borde de abajo, con huecos para los árboles grandes y el claro de hierba alta
      ...treeRow(17, [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 22, 23]),
      [3, 16], [4, 16], [5, 16], [16, 16],
      // Borde de la derecha
      [23, 4], [22, 6], [23, 7], [23, 10], [22, 12], [23, 13],
      // Pinos sueltos dentro de la ruta
      [1, 11], [3, 11], [3, 14], [8, 6], [15, 12], [19, 7], [19, 10],
      ...forestMargin(),
    ],
    props: [
      { kind: 'bigPine', at: [0, 0] },
      { kind: 'bigPine', at: [6, 15] },
      { kind: 'roundTree', at: [13, 15] },
      { kind: 'bigPine', at: [22, 15] },
    ],
    ponds: [[0, 12]],
    // Hierba alta por todas partes, siempre a una casilla o más del camino
    tallGrass: [
      ...rect(7, 2, 4, 2), [11, 3], ...rect(12, 2, 4, 2), [16, 3], [18, 3], [19, 3],
      ...rect(0, 5, 3, 4), [3, 6], [3, 7], [0, 9], [0, 10], [0, 11], [2, 9], [2, 10], [2, 11],
      [7, 7], [8, 7], [8, 8], [9, 8], [7, 9], [8, 9], [8, 10], [9, 10],
      [15, 7], [13, 8], [14, 8], [14, 9], [15, 9], [13, 10], [14, 10],
      [19, 11], [19, 12],
      ...rect(9, 15, 4, 3),
    ],
    flowers: [[7, 11], [8, 11], [13, 12], [14, 12]],
    npcs: [
      { sprite: 'YOUNGSTER', at: [4, 9], dir: 'right' },
      { sprite: 'LASS', at: [12, 14], dir: 'left' },
    ],
    sign: [4, 2],
    tileset: true,
    rocks: [[4, 12], [16, 7]],
    bushes: [[12, 4]],
  },
  ruta2(),
  gimnasioPlateada(),
];

/**
 * Ruta 2: pradera con un lago y el Centro Pokémon al final. El camino va en zigzag horizontal
 * (al revés que la Ruta 1, que va por columnas) y sube hasta la puerta del Centro Pokémon, a la
 * derecha. Abajo, una valla de madera separa el camino de un macizo de flores.
 */
function ruta2(): MapDef {
  return {
    id: 'ruta2',
    name: 'RUTA 2',
    subtitle: 'PRADERA CON LAGO',
    unlockedBy: 'ruta1',
    path: [
      [-1, 2],
      [17, 2],
      [17, 6],
      [3, 6],
      [3, 11],
      [12, 11],
      [12, 15],
      [20, 15],
      [20, 11],
    ],
    goal: 'pokecenter',
    spawn: [0, 2],
    tileset: true,
    trees: [
      // Bosque arriba (la fila 1 se ve casi entera) y abajo, donde no pisa el camino
      ...treeRow(1, [0, 1, 2, 18, 19, 20, 21, 22, 23]),
      ...Array.from({ length: 12 }, (_, c): Tile => [c, 17]).filter(([c]) => ![6, 7, 9, 10].includes(c)),
      [21, 17], [22, 17], [23, 17],
      // Borde izquierdo y derecho
      [0, 5], [0, 10], [1, 9],
      [23, 5], [23, 8], [23, 11], [23, 14],
      // Pinos sueltos
      [17, 14], [5, 10],
      ...forestMargin(),
    ],
    props: [
      { kind: 'roundTree', at: [20, 2] },
      { kind: 'yellowTree', at: [6, 15] },
      { kind: 'yellowBush', at: [18, 5] },
    ],
    ponds: [[7, 8]],
    tallGrass: [
      [12, 4], [13, 4], [14, 4],
      [15, 12], [16, 12], [16, 13],
      ...rect(1, 13, 4, 2), [0, 14],
      ...rect(9, 14, 2, 4),
    ],
    flowers: [
      [6, 4], [7, 4],
      [15, 9], [16, 9], [15, 10], [16, 10],
      // Macizo detrás de la valla de abajo
      ...rect(13, 17, 7, 1),
    ],
    ground: [
      // Playa de arena alrededor del lago
      { kind: 'sand', tiles: [...rect(6, 7, 5, 4), [11, 8], [11, 9]] },
      // Prados de hierba clara
      { kind: 'light', tiles: [...rect(13, 7, 4, 5), ...rect(14, 12, 3, 2)] },
      { kind: 'light', tiles: rect(18, 2, 5, 4) },
      { kind: 'light', tiles: [...rect(0, 3, 3, 2), ...rect(8, 3, 4, 3)] },
    ],
    npcs: [
      { sprite: 'TUBER_M', at: [10, 9], dir: 'left' },
      { sprite: 'AROMALADY', at: [14, 9], dir: 'right' },
      { sprite: 'BIRDKEEPER', at: [7, 13], dir: 'up' },
    ],
    sign: [1, 3],
    fences: rect(12, 16, 8, 1),
    rocks: [[19, 13], [2, 8]],
    bushes: [[11, 4], [22, 13]],
  };
}

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
    subtitle: 'DEFIENDE A BROCK',
    unlockedBy: 'ruta2',
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

/** Lo que defienden los jugadores, para los textos: "...antes de que lleguen a {goalName}" */
export function goalName(def: MapDef): string {
  if (def.goal === 'exit') return 'la salida de la ruta';
  if (def.goal === 'leader') return 'el líder del gimnasio';
  return 'el Centro Pokémon';
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
      const touching = [...def.tallGrass, ...(def.flowers ?? [])].filter(([c, r]) =>
        [-1, 0, 1].some((dr) => [-1, 0, 1].some((dc) => this.pathTiles.has(tileKey(c + dc, r + dr)))),
      );
      if (touching.length) console.warn(`${def.id}: hierba alta o flores pegadas al camino en`, touching);
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
    // Los pinos del tileset tapan con la copa las dos casillas de encima
    const crowns: Tile[] = def.tileset ? def.trees.flatMap(pineTiles) : [];

    this.blocked = new Set(
      [
        ...def.trees,
        ...crowns,
        ...def.ponds.flatMap(pondTiles),
        ...def.tallGrass,
        ...(def.sign ? [def.sign] : []),
        ...(def.rocks ?? []),
        ...(def.bushes ?? []),
        ...(def.props ?? []).flatMap(propTiles),
        ...(def.flowers ?? []),
        ...(def.npcs ?? []).map((npc) => npc.at),
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
