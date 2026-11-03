import Phaser from 'phaser';
import { audio } from '../audio/Audio';
import type { VolumeChannel } from '../save';
import { Button } from './Button';
import { textStyle } from './theme';

const STEPS = 10;
const BTN = 36;
const BAR_H = 20;
const GAP = 12;
const PERCENT_W = 32;

export interface VolumeSliderOptions {
  /** Ancho de la barra de segmentos */
  barWidth?: number;
  onHover?: () => void;
}

/** Control de volumen: botones - y +, barra por segmentos (clic para fijar) y porcentaje */
export class VolumeSlider extends Phaser.GameObjects.Container {
  readonly channel: VolumeChannel;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly percent: Phaser.GameObjects.Text;
  private readonly barWidth: number;

  constructor(scene: Phaser.Scene, x: number, y: number, channel: VolumeChannel, opts: VolumeSliderOptions = {}) {
    super(scene, x, y);
    this.channel = channel;
    this.barWidth = opts.barWidth ?? 240;
    const barX = BTN + GAP;
    const plusX = barX + this.barWidth + GAP;

    const minus = new Button(scene, 0, 0, BTN, BTN, '-', () => this.change(-1), { fontSize: 16, onHover: opts.onHover });
    const plus = new Button(scene, plusX, 0, BTN, BTN, '+', () => this.change(1), { fontSize: 16, onHover: opts.onHover });
    this.bar = scene.add.graphics({ x: barX, y: (BTN - BAR_H) / 2 });
    const zone = scene.add
      .zone(barX, 0, this.barWidth, BTN)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => opts.onHover?.())
      .on('pointerdown', (_pointer: Phaser.Input.Pointer, localX: number) => {
        this.setLevel(Math.ceil(Phaser.Math.Clamp(localX / this.barWidth, 0, 1) * STEPS));
      });
    this.percent = scene.add.text(plusX + BTN + GAP, BTN / 2, '', textStyle(8)).setOrigin(0, 0.5);

    this.add([minus, plus, this.bar, zone, this.percent]);
    scene.add.existing(this);
    this.refresh();
  }

  /** Ancho total del control, para colocarlo */
  static width(barWidth = 240): number {
    return BTN + GAP + barWidth + GAP + BTN + GAP + PERCENT_W;
  }

  static get height(): number {
    return BTN;
  }

  private get level(): number {
    return Math.round(audio.getVolume(this.channel) * STEPS);
  }

  change(step: number): void {
    this.setLevel(this.level + step);
  }

  private setLevel(level: number): void {
    audio.setVolume(this.channel, Phaser.Math.Clamp(level, 0, STEPS) / STEPS);
    // Sonido de prueba para oír el nuevo volumen de los efectos
    if (this.channel === 'sfx') audio.play('coin');
    this.refresh();
  }

  private refresh(): void {
    const level = this.level;
    const segW = this.barWidth / STEPS;
    const g = this.bar.clear();
    g.fillStyle(0x404858).fillRoundedRect(-2, -2, this.barWidth + 4, BAR_H + 4, 4);
    for (let s = 0; s < STEPS; s++) {
      g.fillStyle(s < level ? 0x58c078 : 0xa8b0c0).fillRect(s * segW + 1, 0, segW - 2, BAR_H);
    }
    this.percent.setText(level === 0 ? 'OFF' : `${level * 10}%`);
  }
}
