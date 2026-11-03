import Phaser from 'phaser';
import { MAP_H, MAP_W, TILE } from '../config';
import type { Tile } from '../data/map';

const BUTTERFLY_COLORS = [0xffffff, 0xfff080, 0xffb0d0];

/** Vida decorativa del mapa: sombras de nubes, mariposas y destellos en los estanques */
export function addAmbient(scene: Phaser.Scene, ponds: Tile[]): void {
  // Sombras de nubes que cruzan el mapa despacio
  for (let i = 0; i < 2; i++) {
    const cloud = scene.add.image(-250, 0, 'cloudshadow').setAlpha(0.07).setDepth(60);
    const drift = (delay: number) => {
      cloud.setPosition(-250, Phaser.Math.Between(60, MAP_H - 60));
      scene.tweens.add({
        targets: cloud,
        x: MAP_W + 250,
        duration: Phaser.Math.Between(35000, 50000),
        delay,
        onComplete: () => drift(Phaser.Math.Between(2000, 8000)),
      });
    };
    drift(i * 18000);
  }

  // Mariposas que revolotean por la hierba
  BUTTERFLY_COLORS.forEach((color) => {
    const butterfly = scene.add
      .image(Phaser.Math.Between(40, MAP_W - 40), Phaser.Math.Between(40, MAP_H - 40), 'butterfly')
      .setTint(color)
      .setDepth(55);
    scene.tweens.add({ targets: butterfly, scaleX: 0.25, duration: 110, yoyo: true, repeat: -1 });
    const wander = () => {
      scene.tweens.add({
        targets: butterfly,
        x: Phaser.Math.Clamp(butterfly.x + Phaser.Math.Between(-160, 160), 20, MAP_W - 20),
        y: Phaser.Math.Clamp(butterfly.y + Phaser.Math.Between(-120, 120), 20, MAP_H - 20),
        duration: Phaser.Math.Between(2500, 4500),
        ease: 'Sine.easeInOut',
        onComplete: wander,
      });
    };
    wander();
  });

  // Destellos en el agua
  for (const [col, row] of ponds) addGlints(scene, col * TILE, row * TILE);
}

function addGlints(scene: Phaser.Scene, left: number, top: number): void {
  for (let i = 0; i < 4; i++) {
    const glint = scene.add
      .image(left + Phaser.Math.Between(16, 80), top + Phaser.Math.Between(16, 76), 'px')
      .setScale(1, 0.5)
      .setAlpha(0)
      .setDepth(1);
    scene.tweens.add({
      targets: glint,
      alpha: 0.9,
      scaleX: 3,
      duration: 700,
      yoyo: true,
      repeat: -1,
      repeatDelay: Phaser.Math.Between(800, 2000),
      delay: i * 600,
    });
  }
}
