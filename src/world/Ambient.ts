import Phaser from 'phaser';
import { MAP_H, MAP_W, TILE } from '../config';
import { NPC_DIRS, type MapDef } from '../data/map';
import { FLOWER_FRAMES, FLOWER_VARIANTS, flowerKey, npcKey } from './tileset';

const BUTTERFLY_COLORS = [0xffffff, 0xfff080, 0xffb0d0];

/** Vida decorativa del mapa: sombras de nubes, mariposas y destellos en los estanques */
export function addAmbient(scene: Phaser.Scene, def: MapDef): void {
  // Dentro de un gimnasio no hay nubes ni mariposas
  if (def.gym) return;

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
  for (const [col, row] of def.ponds) addGlints(scene, col * TILE, row * TILE);
  addFlowers(scene, def);
  addTrainers(scene, def);
}

/** Macizos de flores que se mecen con el viento, cada uno a su ritmo */
function addFlowers(scene: Phaser.Scene, def: MapDef): void {
  const key = (c: number, r: number) => flowerKey((c * 7 + r * 3) % FLOWER_VARIANTS);
  for (const [c, r] of def.flowers ?? []) {
    if (!scene.textures.exists(key(c, r))) continue;
    const flower = scene.add.sprite(c * TILE, r * TILE, key(c, r), 0).setOrigin(0).setDepth(1);
    const anim = `${key(c, r)}-sway`;
    if (!scene.anims.exists(anim)) {
      // Ida y vuelta, con una pausa en el fotograma de reposo
      const frames = scene.anims.generateFrameNumbers(key(c, r), { start: 0, end: FLOWER_FRAMES - 1 });
      scene.anims.create({ key: anim, frames, frameRate: 6, yoyo: true, repeat: -1, repeatDelay: 900 });
    }
    flower.play({ key: anim, delay: ((c * 5 + r * 3) % 8) * 150 });
  }
}

/** Entrenadores quietos junto a la ruta que de vez en cuando miran a otro lado */
function addTrainers(scene: Phaser.Scene, def: MapDef): void {
  for (const npc of def.npcs ?? []) {
    const key = npcKey(npc.sprite);
    if (!scene.textures.exists(key)) continue;
    const [c, r] = npc.at;
    const frame = (dir: number) => dir * 4;
    let dir = NPC_DIRS.indexOf(npc.dir ?? 'down');
    const home = dir;
    const trainer = scene.add
      .sprite((c + 0.5) * TILE, (r + 1) * TILE - 2, key, frame(dir))
      .setOrigin(0.5, 1)
      .setDepth(10 + r / 100);
    const look = () => {
      // Casi siempre vuelve a mirar hacia donde miraba al principio
      dir = dir !== home || Math.random() < 0.4 ? home : Phaser.Math.Between(0, NPC_DIRS.length - 1);
      trainer.setFrame(frame(dir));
      scene.time.delayedCall(Phaser.Math.Between(1800, 5000), look);
    };
    scene.time.delayedCall(Phaser.Math.Between(1000, 4000), look);
  }
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
