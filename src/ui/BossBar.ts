import Phaser from 'phaser';
import { MAP_W } from '../config';
import type { Enemy } from '../objects/Enemy';
import { caps, drawPanel, textStyle } from './theme';

const W = 300;
const H = 62;
const BAR_X = 44;
const BAR_W = W - BAR_X - 16;

export const hpColor = (ratio: number) => (ratio > 0.5 ? 0x58d080 : ratio > 0.2 ? 0xf8c030 : 0xf85838);

/** Recuadro de PS estilo combate Pokémon para los jefes */
export class BossBar {
  private readonly container: Phaser.GameObjects.Container;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly levelText: Phaser.GameObjects.Text;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly bar: Phaser.GameObjects.Graphics;
  private current: Enemy | null = null;
  private shownHp = 0;

  constructor(scene: Phaser.Scene) {
    const g = drawPanel(scene.add.graphics(), 0, 0, W, H);
    this.nameText = scene.add.text(14, 12, '', textStyle(8));
    this.levelText = scene.add.text(W - 14, 12, '', textStyle(8)).setOrigin(1, 0);
    const hpLabel = scene.add.text(16, 30, 'PS', textStyle(8, '#f8a830', '#805010'));
    this.hpText = scene.add.text(W - 16, 44, '', textStyle(8)).setOrigin(1, 0);
    this.bar = scene.add.graphics();
    this.container = scene.add
      .container((MAP_W - W) / 2, 8, [g, this.nameText, this.levelText, hpLabel, this.hpText, this.bar])
      .setDepth(140)
      .setVisible(false);
  }

  update(boss: Enemy | null, dt: number): void {
    if (boss !== this.current) {
      this.current = boss;
      this.container.setVisible(!!boss);
      if (boss) {
        this.nameText.setText(caps(boss.def.name));
        this.levelText.setText(`Nv${boss.level}`);
        this.shownHp = boss.hp;
      }
    }
    if (!boss) return;

    // El número y la barra bajan poco a poco, como en los combates
    if (this.shownHp > boss.hp) this.shownHp = Math.max(boss.hp, this.shownHp - boss.maxHp * 0.8 * dt);
    const ratio = boss.hp / boss.maxHp;
    const shown = this.shownHp / boss.maxHp;
    this.hpText.setText(`${Math.ceil(this.shownHp)}/${boss.maxHp}`);

    this.bar.clear();
    this.bar.fillStyle(0x404040).fillRoundedRect(BAR_X - 2, 28, BAR_W + 4, 12, 3);
    this.bar.fillStyle(0x506050).fillRect(BAR_X, 30, BAR_W, 8);
    this.bar.fillStyle(0xf8f8f8).fillRect(BAR_X, 30, BAR_W * shown, 8);
    this.bar.fillStyle(hpColor(ratio)).fillRect(BAR_X, 30, BAR_W * ratio, 8);
    this.bar.fillStyle(0xffffff, 0.35).fillRect(BAR_X, 30, BAR_W * ratio, 2);
  }
}
