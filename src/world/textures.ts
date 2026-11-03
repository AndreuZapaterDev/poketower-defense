import Phaser from 'phaser';
import { COLS, MAP_H, MAP_W, ROWS, TILE } from '../config';
import { MAPS, RouteMap, mapTextureKey, type MapDef, type Tile } from '../data/map';

type G = Phaser.GameObjects.Graphics;

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

/** Genera todas las texturas procedurales del juego (una sola vez) */
export function buildTextures(scene: Phaser.Scene): void {
  make(scene, 'px', 4, 4, (g) => g.fillStyle(0xffffff).fillRect(0, 0, 4, 4));
  make(scene, 'shadow', 32, 12, (g) => g.fillStyle(0x000000).fillEllipse(16, 6, 32, 12));
  make(scene, 'pokeball', 16, 16, drawPokeball);
  make(scene, 'coin', 14, 14, (g) => {
    g.fillStyle(0x806010).fillCircle(7, 7, 7);
    g.fillStyle(0xf8c838).fillCircle(7, 7, 6);
    g.fillStyle(0xfff0a0).fillRect(4, 3, 3, 3);
    g.fillStyle(0xc89820).fillRect(6, 4, 2, 6);
  });
  make(scene, 'star', 12, 12, (g) => {
    g.fillStyle(0xffffff);
    g.fillTriangle(6, 0, 4, 6, 8, 6).fillTriangle(6, 12, 4, 6, 8, 6);
    g.fillTriangle(0, 6, 6, 4, 6, 8).fillTriangle(12, 6, 6, 4, 6, 8);
  });
  make(scene, 'ember', 12, 12, (g) => {
    g.fillStyle(0xe04018).fillCircle(6, 6, 6);
    g.fillStyle(0xffa030).fillCircle(6, 6, 4);
    g.fillStyle(0xfff0a0).fillCircle(6, 6, 2);
  });
  make(scene, 'bubble', 12, 12, (g) => {
    g.fillStyle(0x3878d0).fillCircle(6, 6, 6);
    g.fillStyle(0x88c8f8).fillCircle(6, 6, 5);
    g.fillStyle(0xffffff).fillRect(3, 3, 2, 2);
  });
  make(scene, 'leaf', 14, 8, (g) => {
    g.fillStyle(0x306820).fillEllipse(7, 4, 14, 8);
    g.fillStyle(0x58b040).fillEllipse(7, 4, 12, 6);
    g.fillStyle(0x98d878).fillRect(2, 3, 10, 1);
  });
  // Destello suave para fuego y brillos (se usa con mezcla aditiva)
  make(scene, 'flare', 16, 16, (g) => {
    for (let r = 8; r >= 1; r--) g.fillStyle(0xffffff, 0.08 + (8 - r) * 0.11).fillCircle(8, 8, r);
  });
  make(scene, 'smoke', 16, 16, (g) => {
    g.fillStyle(0xffffff, 0.35).fillCircle(8, 8, 8);
    g.fillStyle(0xffffff, 0.6).fillCircle(8, 8, 5);
  });
  make(scene, 'drop', 6, 8, (g) => {
    g.fillStyle(0x3878d0).fillCircle(3, 5, 3).fillTriangle(3, 0, 0.5, 4, 5.5, 4);
    g.fillStyle(0xa8e0ff).fillRect(2, 4, 1, 2);
  });
  make(scene, 'hitspark', 32, 32, (g) => {
    const points: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 16; i++) {
      const r = i % 2 === 0 ? (i % 4 === 0 ? 16 : 11) : 4;
      const a = (i / 16) * Math.PI * 2;
      points.push(new Phaser.Math.Vector2(16 + Math.cos(a) * r, 16 + Math.sin(a) * r));
    }
    g.fillStyle(0xffffff).fillPoints(points, true);
  });
  make(scene, 'butterfly', 12, 8, (g) => {
    g.fillStyle(0xffffff).fillEllipse(3, 3, 6, 6).fillEllipse(9, 3, 6, 6);
    g.fillStyle(0xe8e8e8).fillEllipse(3, 6, 4, 4).fillEllipse(9, 6, 4, 4);
    g.fillStyle(0x303030).fillRect(5, 1, 2, 7);
  });
  make(scene, 'cloudshadow', 220, 110, (g) => {
    g.fillStyle(0x000000).fillEllipse(110, 60, 200, 80).fillEllipse(70, 45, 110, 70).fillEllipse(150, 40, 120, 70);
  });
  // Iconos de botón (pixel art blanco, 14x14)
  make(scene, 'icon-sound', 14, 14, (g) => {
    g.fillStyle(0xffffff).fillRect(1, 5, 3, 4).fillTriangle(3, 7, 8, 1, 8, 13).fillRect(10, 4, 1, 6).fillRect(12, 2, 1, 10);
  });
  make(scene, 'icon-mute', 14, 14, (g) => {
    g.fillStyle(0xffffff).fillRect(1, 5, 3, 4).fillTriangle(3, 7, 8, 1, 8, 13);
    for (let i = 0; i < 5; i++) g.fillRect(9 + i, 4 + i, 1, 1).fillRect(13 - i, 4 + i, 1, 1);
  });
  make(scene, 'icon-reset', 14, 14, (g) => {
    g.lineStyle(2, 0xffffff);
    g.beginPath();
    g.arc(7, 7, 5, Phaser.Math.DegToRad(-60), Phaser.Math.DegToRad(220));
    g.strokePath();
    g.fillStyle(0xffffff).fillTriangle(7, 0, 12, 3, 8, 6);
  });
  make(scene, 'icon-pause', 14, 14, (g) => g.fillStyle(0xffffff).fillRect(3, 2, 3, 10).fillRect(8, 2, 3, 10));
  make(scene, 'icon-play', 14, 14, (g) => g.fillStyle(0xffffff).fillTriangle(3, 1, 3, 13, 12, 7));
  make(scene, 'tallgrass', TILE, TILE, (g) => drawTallGrass(g, 0, 0, false));
  // Fondo de los menús: dos siluetas de Poké Ball por casilla, en diagonal
  make(scene, 'menu-pattern', 64, 64, (g) => {
    for (const [cx, cy] of [[16, 16], [48, 48]]) {
      g.lineStyle(3, 0xffffff).strokeCircle(cx, cy, 11);
      g.fillStyle(0xffffff).fillRect(cx - 11, cy - 1.5, 22, 3).fillCircle(cx, cy, 4);
    }
  });
  for (const def of MAPS) make(scene, mapTextureKey(def.id), MAP_W, MAP_H, (g) => drawMap(g, def));
}

function drawPokeball(g: G): void {
  g.fillStyle(0x303030).fillCircle(8, 8, 8);
  g.fillStyle(0xf8f8f8).fillCircle(8, 8, 7);
  g.fillStyle(0xe83030);
  g.slice(8, 8, 7, Math.PI, Math.PI * 2, false);
  g.fillPath();
  g.fillStyle(0x303030).fillRect(1, 7, 14, 2);
  g.fillStyle(0x303030).fillCircle(8, 8, 3);
  g.fillStyle(0xf8f8f8).fillCircle(8, 8, 1.5);
}

// ------------------------------------------------------------------ mapa

function drawMap(g: G, def: MapDef): void {
  const map = new RouteMap(def);
  // Semilla fija por mapa: los detalles al azar salen siempre iguales
  const rng = new Phaser.Math.RandomDataGenerator([`poketower-${def.id}`]);
  const isPath = (c: number, r: number) => map.isPath(c, r);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (isPath(c, r)) drawPathTile(g, c, r, isPath, rng);
      else drawGrassTile(g, c * TILE, r * TILE, (c + r) % 2 === 1, rng);
    }
  }

  // Flores en algunas casillas libres
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (map.isBuildable(c, r) && rng.frac() < 0.14) drawFlowers(g, c * TILE, r * TILE, rng);
    }
  }

  for (const [c, r] of def.tallGrass) drawTallGrass(g, c * TILE, r * TILE, true);
  for (const pond of def.ponds) drawPond(g, pond);
  for (const [c, r] of def.trees) drawTree(g, c * TILE, r * TILE);
  drawSign(g, def.sign[0] * TILE, def.sign[1] * TILE);
  drawPokeCenter(g, map.pokecenter);
}

function drawGrassTile(g: G, x: number, y: number, odd: boolean, rng: Phaser.Math.RandomDataGenerator): void {
  g.fillStyle(odd ? 0x88c870 : 0x80c068).fillRect(x, y, TILE, TILE);
  g.fillStyle(0x68a850);
  for (let i = 0; i < 3; i++) {
    const px = x + rng.between(4, TILE - 10);
    const py = y + rng.between(4, TILE - 10);
    g.fillRect(px, py, 2, 4).fillRect(px + 4, py, 2, 4).fillRect(px + 2, py + 2, 2, 4);
  }
}

function drawPathTile(
  g: G,
  c: number,
  r: number,
  isPath: (c: number, r: number) => boolean,
  rng: Phaser.Math.RandomDataGenerator,
): void {
  const x = c * TILE;
  const y = r * TILE;
  g.fillStyle(0xe8d098).fillRect(x, y, TILE, TILE);
  g.fillStyle(0xd8bc80);
  for (let i = 0; i < 6; i++) g.fillRect(x + rng.between(3, TILE - 6), y + rng.between(3, TILE - 6), 3, 2);
  g.fillStyle(0xf8e8b8);
  for (let i = 0; i < 3; i++) g.fillRect(x + rng.between(3, TILE - 6), y + rng.between(3, TILE - 6), 2, 2);

  // Bordes donde el camino toca la hierba
  const edge = 4;
  g.fillStyle(0xc0a060);
  if (!isPath(c, r - 1)) g.fillRect(x, y, TILE, edge);
  if (!isPath(c, r + 1)) g.fillRect(x, y + TILE - edge, TILE, edge);
  if (!isPath(c - 1, r)) g.fillRect(x, y, edge, TILE);
  if (!isPath(c + 1, r)) g.fillRect(x + TILE - edge, y, edge, TILE);
}

function drawFlowers(g: G, x: number, y: number, rng: Phaser.Math.RandomDataGenerator): void {
  const colors = [0xf85868, 0xf8e050, 0xf8f8f8];
  const count = rng.between(1, 3);
  for (let i = 0; i < count; i++) {
    const fx = x + rng.between(8, TILE - 12);
    const fy = y + rng.between(8, TILE - 12);
    g.fillStyle(colors[rng.between(0, colors.length - 1)]);
    g.fillRect(fx, fy - 2, 2, 2).fillRect(fx - 2, fy, 2, 2).fillRect(fx + 2, fy, 2, 2).fillRect(fx, fy + 2, 2, 2);
    g.fillStyle(0xf8a830).fillRect(fx, fy, 2, 2);
  }
}

function drawTallGrass(g: G, x: number, y: number, withBase: boolean): void {
  if (withBase) g.fillStyle(0x70b858).fillRect(x, y, TILE, TILE);
  for (let row = 0; row < 3; row++) {
    const by = y + 10 + row * 7;
    for (let i = 0; i < 4; i++) {
      const bx = x + i * 8 + (row % 2) * 4;
      g.fillStyle(0x306830).fillTriangle(bx, by + 8, bx + 4, by - 2, bx + 8, by + 8);
      g.fillStyle(0x48a048).fillTriangle(bx + 1, by + 8, bx + 4, by + 1, bx + 7, by + 8);
      g.fillStyle(0x78c860).fillRect(bx + 3, by + 2, 2, 3);
    }
  }
}

function drawTree(g: G, x: number, y: number): void {
  const cx = x + TILE / 2;
  g.fillStyle(0x000000, 0.18).fillEllipse(cx, y + TILE - 4, 24, 7);
  g.fillStyle(0x583818).fillRect(cx - 3, y + 20, 7, 9);
  g.fillStyle(0x806030).fillRect(cx - 2, y + 20, 3, 9);
  g.fillStyle(0x204818).fillCircle(cx, y + 13, 13);
  g.fillStyle(0x388030).fillCircle(cx, y + 13, 12);
  g.fillStyle(0x2c6828).fillCircle(cx + 4, y + 17, 7);
  g.fillStyle(0x58a840).fillCircle(cx - 3, y + 9, 6);
  g.fillStyle(0x80c860).fillRect(cx - 6, y + 6, 3, 2);
}

function drawSign(g: G, x: number, y: number): void {
  const cx = x + TILE / 2;
  g.fillStyle(0x000000, 0.18).fillEllipse(cx, y + 28, 20, 6);
  // Postes
  g.fillStyle(0x503018).fillRect(cx - 8, y + 17, 3, 11).fillRect(cx + 5, y + 17, 3, 11);
  // Tablero
  g.fillStyle(0x503018).fillRect(cx - 12, y + 5, 24, 15);
  g.fillStyle(0xb88848).fillRect(cx - 11, y + 6, 22, 13);
  g.fillStyle(0xd0a060).fillRect(cx - 11, y + 6, 22, 2);
  // Letras simuladas
  g.fillStyle(0x684020).fillRect(cx - 7, y + 10, 14, 2).fillRect(cx - 7, y + 14, 10, 2);
}

function drawPond(g: G, [col, row]: Tile): void {
  const x = col * TILE;
  const y = row * TILE;
  const w = TILE * 3;
  const h = TILE * 3;
  g.fillStyle(0xd8c890).fillRoundedRect(x + 2, y + 2, w - 4, h - 4, 18);
  g.fillStyle(0x3870c0).fillRoundedRect(x + 6, y + 6, w - 12, h - 12, 14);
  g.fillStyle(0x58a0e8).fillRoundedRect(x + 8, y + 9, w - 16, h - 17, 12);
  g.fillStyle(0x98d0f8);
  g.fillRect(x + 20, y + 24, 14, 2).fillRect(x + 50, y + 40, 18, 2).fillRect(x + 28, y + 62, 12, 2);
  // Nenúfar
  g.fillStyle(0x388030).fillCircle(x + 64, y + 66, 7);
  g.fillStyle(0x58b040).fillCircle(x + 64, y + 66, 5);
  g.fillStyle(0xf890b0).fillRect(x + 63, y + 64, 3, 3);
}

function drawPokeCenter(g: G, { x, y, w, h }: RouteMap['pokecenter']): void {
  const cx = x + w / 2;
  const wallTop = y + 34;

  g.fillStyle(0x000000, 0.2).fillRect(x + 6, y + h - 4, w, 8);
  // Paredes
  g.fillStyle(0x404040).fillRect(x, wallTop, w, h - 34);
  g.fillStyle(0xf8f0e0).fillRect(x + 2, wallTop + 2, w - 4, h - 38);
  g.fillStyle(0xd8d0c0).fillRect(x + 2, y + h - 8, w - 4, 6);
  // Tejado
  g.fillStyle(0x404040).fillRect(x - 4, y, w + 8, 38);
  g.fillStyle(0xe05050).fillRect(x - 2, y + 2, w + 4, 34);
  g.fillStyle(0xf88888).fillRect(x - 2, y + 2, w + 4, 6);
  g.fillStyle(0xb03838).fillRect(x - 2, y + 30, w + 4, 6);
  // Emblema Poké Ball del tejado
  g.fillStyle(0x404040).fillCircle(cx, y + 19, 12);
  g.fillStyle(0xf8f8f8).fillCircle(cx, y + 19, 10);
  g.fillStyle(0xe83030);
  g.slice(cx, y + 19, 10, Math.PI, Math.PI * 2, false);
  g.fillPath();
  g.fillStyle(0x404040).fillRect(cx - 10, y + 18, 20, 3).fillCircle(cx, y + 19, 4);
  g.fillStyle(0xf8f8f8).fillCircle(cx, y + 19, 2);
  // Ventanas
  for (const wx of [x + 8, x + w - 30]) {
    g.fillStyle(0x404040).fillRect(wx, wallTop + 10, 22, 18);
    g.fillStyle(0x88c8f8).fillRect(wx + 2, wallTop + 12, 18, 14);
    g.fillStyle(0xd0f0ff).fillRect(wx + 3, wallTop + 13, 6, 4);
  }
  // Puerta automática
  g.fillStyle(0x404040).fillRect(cx - 15, y + h - 32, 30, 32);
  g.fillStyle(0x5880d0).fillRect(cx - 13, y + h - 30, 26, 30);
  g.fillStyle(0x88b0f0).fillRect(cx - 11, y + h - 28, 8, 10);
  g.fillStyle(0x404040).fillRect(cx - 1, y + h - 30, 2, 30);
}
