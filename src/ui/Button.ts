import Phaser from 'phaser';
import { audio } from '../audio/Audio';
import { WHITE, textStyle } from './theme';

export type ButtonVariant = 'red' | 'blue' | 'green' | 'gray';

interface Palette {
  fill: number;
  light: number;
  dark: number;
  shadow: string;
}

const PALETTES: Record<ButtonVariant, Palette> = {
  red: { fill: 0xe04040, light: 0xf06868, dark: 0x982828, shadow: '#902020' },
  blue: { fill: 0x3c64c8, light: 0x6088e0, dark: 0x203c88, shadow: '#203c88' },
  green: { fill: 0x38a058, light: 0x58c078, dark: 0x206838, shadow: '#206838' },
  gray: { fill: 0x707888, light: 0x9098a8, dark: 0x404858, shadow: '#404858' },
};
const DISABLED: Palette = { fill: 0xa8a8a8, light: 0xa8a8a8, dark: 0x787878, shadow: '#787878' };

export interface ButtonOptions {
  variant?: ButtonVariant;
  fontSize?: number;
  /** Textura de icono en lugar de texto */
  icon?: string;
  /** Se llama al pasar el ratón por encima */
  onHover?: () => void;
}

export class Button extends Phaser.GameObjects.Container {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly icon: Phaser.GameObjects.Image | null;
  private readonly palette: Palette;
  private readonly boxW: number;
  private readonly boxH: number;
  private enabled = true;
  private hovered = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    w: number,
    h: number,
    text: string,
    onClick: () => void,
    opts: ButtonOptions = {},
  ) {
    super(scene, x, y);
    this.boxW = w;
    this.boxH = h;
    this.palette = PALETTES[opts.variant ?? 'blue'];

    this.g = scene.add.graphics();
    this.label = scene.add
      .text(w / 2, h / 2 - 1, text, { ...textStyle(opts.fontSize ?? 8, WHITE, this.palette.shadow), align: 'center' })
      .setLineSpacing(4)
      .setOrigin(0.5);
    this.icon = opts.icon ? scene.add.image(w / 2, h / 2 - 1, opts.icon) : null;
    const zone = scene.add.zone(0, 0, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    zone
      .on('pointerover', () => {
        this.setHovered(true);
        opts.onHover?.();
      })
      .on('pointerout', () => this.setHovered(false))
      .on('pointerdown', () => {
        if (!this.enabled) {
          audio.play('error');
          return;
        }
        audio.play('click');
        onClick();
        const content = this.icon ?? this.label;
        scene.tweens.add({ targets: content, y: { from: h / 2 + 1, to: h / 2 - 1 }, duration: 100 });
      });

    this.add([this.g, this.label, ...(this.icon ? [this.icon] : []), zone]);
    this.draw();
    scene.add.existing(this);
  }

  setText(text: string): this {
    this.label.setText(text);
    return this;
  }

  setIcon(texture: string): this {
    this.icon?.setTexture(texture);
    return this;
  }

  setEnabled(enabled: boolean): this {
    if (this.enabled === enabled) return this;
    this.enabled = enabled;
    this.draw();
    return this;
  }

  private setHovered(hovered: boolean): void {
    this.hovered = hovered;
    this.draw();
  }

  private draw(): void {
    const p = this.enabled ? this.palette : DISABLED;
    const { boxW: w, boxH: h } = this;
    this.g.clear();
    this.g.fillStyle(0x303030).fillRoundedRect(0, 0, w, h, 6);
    this.g.fillStyle(p.dark).fillRoundedRect(2, 2, w - 4, h - 4, 4);
    this.g.fillStyle(this.hovered && this.enabled ? p.light : p.fill).fillRoundedRect(2, 2, w - 4, h - 7, 4);
    this.label.setShadow(1, 1, p.shadow, 0, false, true);
  }
}
