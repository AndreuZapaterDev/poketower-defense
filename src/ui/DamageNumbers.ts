import Phaser from 'phaser';
import { RENDER_ZOOM } from '../config';
import { FONT } from './theme';

export type DamageKind = 'normal' | 'super' | 'weak' | 'crit' | 'burn';

interface Style {
  size: number;
  color: string;
  suffix: string;
}

const STYLES: Record<DamageKind, Style> = {
  normal: { size: 16, color: '#ffffff', suffix: '' },
  weak: { size: 8, color: '#b0b0b0', suffix: '' },
  burn: { size: 8, color: '#ffa050', suffix: '' },
  super: { size: 16, color: '#ffd030', suffix: '!' },
  crit: { size: 24, color: '#ff5040', suffix: '!!' },
};

const DEPTH = 58;

/** Números de daño flotantes. Reutiliza los textos para no crear objetos en cada golpe. */
export class DamageNumbers {
  private readonly scene: Phaser.Scene;
  private readonly pool: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(x: number, y: number, amount: number, kind: DamageKind): void {
    const style = STYLES[kind];
    const big = style.size > 16 || kind === 'super';
    const text = this.pool.pop() ?? this.scene.add.text(0, 0, '', { fontFamily: FONT, resolution: RENDER_ZOOM }).setOrigin(0.5).setDepth(DEPTH);
    text
      .setText(`${Math.max(1, Math.round(amount))}${style.suffix}`)
      .setFontSize(style.size)
      .setColor(style.color)
      .setStroke('#202020', big ? 4 : 3)
      .setPosition(x + Phaser.Math.Between(-8, 8), y)
      .setAlpha(1)
      .setScale(big ? 2 : 1.5)
      .setDepth(DEPTH + (big ? 1 : 0))
      .setVisible(true);

    const tweens = this.scene.tweens;
    tweens.add({ targets: text, scale: 1, duration: 140, ease: 'Back.easeOut' });
    tweens.add({ targets: text, y: y - (big ? 30 : 22), duration: 700, ease: 'Cubic.easeOut' });
    tweens.add({
      targets: text,
      alpha: 0,
      delay: big ? 550 : 400,
      duration: 250,
      onComplete: () => {
        text.setVisible(false);
        this.pool.push(text);
      },
    });
  }
}
