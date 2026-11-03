import Phaser from 'phaser';
import { audio } from '../audio/Audio';
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

export const MENU_HEADER_H = 64;
export const MENU_FOOTER_H = 40;

/** Fondo de los menús: cielo degradado con siluetas de Poké Ball que se desplazan en diagonal */
export function drawMenuBackground(scene: Phaser.Scene): void {
  const { width: W, height: H } = scene.scale;
  scene.add.graphics().fillGradientStyle(0x68a8e8, 0x68a8e8, 0xc8e4f8, 0xc8e4f8, 1).fillRect(0, 0, W, H);
  const pattern = scene.add.tileSprite(0, 0, W, H, 'menu-pattern').setOrigin(0).setAlpha(0.22);
  scene.tweens.add({ targets: pattern, tilePositionX: 64, tilePositionY: 64, duration: 5000, repeat: -1 });
}

/** Franja roja superior con el título; con `onBack`, añade un botón para volver */
export function addMenuHeader(scene: Phaser.Scene, title: string, onBack?: () => void): void {
  const W = scene.scale.width;
  const h = MENU_HEADER_H;
  const g = scene.add.graphics().setDepth(40);
  g.fillStyle(0x303030).fillRect(0, 0, W, h + 4);
  g.fillStyle(0xe04040).fillRect(0, 0, W, h);
  g.fillStyle(0xf06868).fillRect(0, 0, W, 6);
  g.fillStyle(0xb03030).fillRect(0, h - 8, W, 8);
  // Franja blanca con una Poké Ball a cada lado del título
  g.fillStyle(0xf8f8f8).fillRect(0, h - 2, W, 2);
  const text = scene.add
    .text(W / 2, h / 2 - 2, title, { ...textStyle(24, WHITE, '#802020') })
    .setOrigin(0.5)
    .setDepth(41);
  for (const side of [-1, 1]) {
    scene.add
      .image(W / 2 + side * (text.width / 2 + 28), h / 2 - 2, 'pokeball')
      .setScale(1.5)
      .setDepth(41);
  }
  if (onBack) {
    scene.add.existing(new BackButton(scene, 16, (h - 36) / 2 - 2, onBack).setDepth(41));
  }
}

/** Franja oscura inferior con las teclas, p. ej. [['ENTER', 'Elegir'], ['ESC', 'Volver']] */
export function addMenuFooter(scene: Phaser.Scene, hints: [key: string, label: string][]): void {
  const { width: W, height: H } = scene.scale;
  const y = H - MENU_FOOTER_H;
  const g = scene.add.graphics().setDepth(40);
  g.fillStyle(0x303030).fillRect(0, y - 4, W, MENU_FOOTER_H + 4);
  g.fillStyle(0x404858).fillRect(0, y, W, MENU_FOOTER_H);
  // Se colocan de derecha a izquierda
  let x = W - 20;
  for (const [key, label] of [...hints].reverse()) {
    const text = scene.add.text(x, y + MENU_FOOTER_H / 2, label, textStyle(8, WHITE, '#202020')).setOrigin(1, 0.5).setDepth(41);
    x -= text.width + 8;
    const keyText = scene.add.text(0, 0, key, textStyle(8, INK, null)).setOrigin(0.5).setDepth(42);
    const kw = keyText.width + 10;
    g.fillStyle(0x202020).fillRoundedRect(x - kw, y + 10, kw, 20, 4);
    g.fillStyle(0xf8f8f8).fillRoundedRect(x - kw, y + 10, kw, 18, 4);
    keyText.setPosition(x - kw / 2, y + 19);
    x -= kw + 24;
  }
}

/** Cursor triangular negro que se balancea, como en los menús de los juegos */
export function addMenuCursor(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  g.fillStyle(0x303030).fillTriangle(0, -8, 0, 8, 10, 0);
  scene.tweens.add({ targets: g, x: 4, duration: 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return scene.add.container(0, 0, [g]).setDepth(30);
}

/** Botón pequeño de volver para la cabecera (texto blanco sobre rojo oscuro) */
class BackButton extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, x: number, y: number, onClick: () => void) {
    super(scene, x, y);
    const w = 112;
    const h = 36;
    const g = scene.add.graphics();
    const draw = (hover: boolean) => {
      g.clear();
      g.fillStyle(0x802020).fillRoundedRect(0, 0, w, h, 6);
      g.fillStyle(hover ? 0xd04848 : 0xb83030).fillRoundedRect(2, 2, w - 4, h - 6, 5);
      g.fillStyle(0xf8f8f8).fillTriangle(16, h / 2 - 2, 24, h / 2 - 8, 24, h / 2 + 4);
    };
    draw(false);
    const label = scene.add.text(w / 2 + 10, h / 2 - 2, 'VOLVER', textStyle(8, WHITE, '#802020')).setOrigin(0.5);
    const zone = scene.add
      .zone(0, 0, w, h)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => draw(true))
      .on('pointerout', () => draw(false))
      .on('pointerdown', () => {
        audio.play('click');
        onClick();
      });
    this.add([g, label, zone]);
  }
}

/** Título grande amarillo con borde azul, como el logo */
export function addMenuTitle(scene: Phaser.Scene, y: number, text: string, size = 24) {
  return scene.add
    .text(scene.scale.width / 2, y, text, {
      ...textStyle(size, '#ffcb05', '#1d2c5e'),
      stroke: '#3c5aa6',
      strokeThickness: size >= 32 ? 10 : 8,
    })
    .setOrigin(0.5);
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
