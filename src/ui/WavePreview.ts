import Phaser from 'phaser';
import { MAP_W } from '../config';
import { ENEMIES, type EnemyId } from '../data/enemies';
import { iconKey } from '../data/sprites';
import type { WaveGroup } from '../data/waves';
import { drawPanel, textStyle } from './theme';

const SLOT = 44;
const H = 66;

/** Panel con los Pokémon de la próxima oleada */
export class WavePreview {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 8).setDepth(140).setVisible(false);
  }

  show(waveNumber: number, groups: WaveGroup[]): void {
    const counts = new Map<EnemyId, number>();
    for (const g of groups) counts.set(g.enemy, (counts.get(g.enemy) ?? 0) + g.count);

    const title = `PROXIMA: OLEADA ${waveNumber}`;
    const w = Math.max(title.length * 8 + 24, counts.size * SLOT + 16);
    const add = this.scene.add;
    this.container.removeAll(true);
    this.container.add([drawPanel(add.graphics(), 0, 0, w, H), add.text(12, 11, title, textStyle(8))]);

    [...counts].forEach(([id, count], i) => {
      const def = ENEMIES[id];
      const x = 8 + SLOT / 2 + i * SLOT;
      if (def.boss) this.container.add(add.circle(x, 40, 15, 0xf05050, 0.3));
      this.container.add([
        add.image(x, 38, iconKey(def.sprite), 0).setScale(0.5),
        add.text(x + 14, 46, `x${count}`, textStyle(8)).setOrigin(1, 0),
      ]);
    });

    this.container.setX(MAP_W - w - 8).setVisible(true).setAlpha(0);
    this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 250 });
  }

  hide(): void {
    this.container.setVisible(false);
  }
}
