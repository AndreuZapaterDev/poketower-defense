import Phaser from 'phaser';
import { TYPE_COLORS, TYPE_NAMES, type PokeType } from '../data/types';

export const FONT = '"Press Start 2P", monospace';

/** Cursor con forma de Poké Ball */
export const POKEBALL_CURSOR =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 16 16'%3E%3Ccircle cx='8' cy='8' r='7.5' fill='%23303030'/%3E%3Cpath d='M1.5 7.5a6.5 6.5 0 0 1 13 0z' fill='%23e83030'/%3E%3Cpath d='M1.5 8.5a6.5 6.5 0 0 0 13 0z' fill='%23f8f8f8'/%3E%3Ccircle cx='8' cy='8' r='2.5' fill='%23303030'/%3E%3Ccircle cx='8' cy='8' r='1.3' fill='%23f8f8f8'/%3E%3C/svg%3E\") 12 12, auto";

// Texto oscuro con sombra clara, como en los juegos de GBA
export const INK = '#404040';
export const INK_SHADOW = '#d0d0c8';
export const WHITE = '#f8f8f8';

export function textStyle(
  size = 8,
  color = INK,
  shadow: string | null = INK_SHADOW,
): Phaser.Types.GameObjects.Text.TextStyle {
  const offset = size >= 16 ? 2 : 1;
  return {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color,
    ...(shadow && { shadow: { offsetX: offset, offsetY: offset, color: shadow, fill: true } }),
  };
}

/** Mayúsculas sin tildes: la fuente pixel no tiene Á, É, Í, Ó ni Ú */
export const caps = (text: string) =>
  text
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .normalize('NFC');

export const darken =(color: number, percent: number) =>
  Phaser.Display.Color.ValueToColor(color).darken(percent).color;

/** Panel blanco con doble borde redondeado, estilo menú de Pokémon */
export function drawPanel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
  g.fillStyle(0x404858).fillRoundedRect(x, y, w, h, 8);
  g.fillStyle(0xa8b8d0).fillRoundedRect(x + 2, y + 2, w - 4, h - 4, 6);
  g.fillStyle(0xf8f8f8).fillRoundedRect(x + 4, y + 4, w - 8, h - 8, 4);
  return g;
}

/** Etiqueta de tipo (FUEGO, AGUA...) con el color oficial */
export function addTypeBadge(scene: Phaser.Scene, x: number, y: number, type: PokeType) {
  const label = caps(TYPE_NAMES[type]);
  const w = label.length * 8 + 10;
  const h = 14;
  const color = TYPE_COLORS[type];
  const g = scene.add.graphics();
  g.fillStyle(darken(color, 30)).fillRoundedRect(0, 0, w, h, 4);
  g.fillStyle(color).fillRoundedRect(1, 1, w - 2, h - 3, 3);
  const text = scene.add.text(w / 2, h / 2, label, textStyle(8, WHITE, 'rgba(0,0,0,0.45)')).setOrigin(0.5);
  return scene.add.container(x, y, [g, text]);
}
