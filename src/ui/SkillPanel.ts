import Phaser from 'phaser';
import { audio } from '../audio/Audio';
import { MAP_H, MAP_W } from '../config';
import { LEVELS_PER_POINT, POINTS_PER_STAGE, canLearn, skillBranches, type SkillDef } from '../data/skills';
import type { Tower } from '../objects/Tower';
import { Button } from './Button';
import { addSectionLabel, drawPanel, textStyle } from './theme';

const DEPTH = 215;
const PAD = 20;
const NODE_H = 58;
const NODE_GAP = 14;
const TOP = 78;

/**
 * Árbol de habilidades de un Pokémon colocado, sobre el mapa: tres ramas de tres habilidades.
 * Las que se pueden aprender ya se pulsan para aprenderlas.
 */
export class SkillPanel {
  private readonly scene: Phaser.Scene;
  private readonly tower: Tower;
  private readonly onLearn: () => void;
  private readonly onClose: () => void;
  private readonly overlay: Phaser.GameObjects.Rectangle;
  private container: Phaser.GameObjects.Container | null = null;

  constructor(scene: Phaser.Scene, tower: Tower, handlers: { onLearn(): void; onClose(): void }) {
    this.scene = scene;
    this.tower = tower;
    this.onLearn = handlers.onLearn;
    this.onClose = handlers.onClose;
    // Tapa el mapa y se traga los clics, para no colocar ni seleccionar nada debajo
    this.overlay = scene.add
      .rectangle(0, 0, MAP_W, MAP_H, 0x000000, 0.55)
      .setOrigin(0)
      .setDepth(DEPTH - 1)
      .setInteractive()
      .on('pointerdown', () => this.onClose());
    this.render();
  }

  destroy(): void {
    this.overlay.destroy();
    this.container?.destroy();
  }

  private render(): void {
    this.container?.destroy();
    const scene = this.scene;
    const tower = this.tower;
    const branches = skillBranches(tower.def.ability);
    const w = Math.min(MAP_W - 32, 660);
    const colW = (w - PAD * 2 - 16 * (branches.length - 1)) / branches.length;
    const h = TOP + 3 * NODE_H + 2 * NODE_GAP + 74;
    const free = tower.freeSkillPoints;

    const g = drawPanel(scene.add.graphics(), 0, 0, w, h);
    // El panel también se traga los clics (si no, llegarían al fondo, que cierra)
    const blocker = scene.add.zone(0, 0, w, h).setOrigin(0).setInteractive();
    const parts: Phaser.GameObjects.GameObject[] = [g, blocker];
    parts.push(scene.add.text(w / 2, 24, `HABILIDADES DE ${tower.stats.name.toUpperCase()}`, textStyle(16)).setOrigin(0.5));
    parts.push(
      scene.add
        .text(
          w / 2,
          46,
          free ? `¡${free} PUNTO${free > 1 ? 'S' : ''} PARA GASTAR! Pulsa una habilidad para aprenderla.` : 'Sin puntos libres por ahora.',
          textStyle(8, free ? '#d09000' : '#7080a0', null),
        )
        .setOrigin(0.5),
    );

    branches.forEach((branch, col) => {
      const x = PAD + col * (colW + 16);
      parts.push(...addSectionLabel(scene, x, TOP - 12, colW, branch.name));
      // Línea que une las habilidades de la rama
      parts.push(scene.add.graphics().fillStyle(0x404858).fillRect(x + colW / 2 - 3, TOP, 6, 2 * (NODE_H + NODE_GAP)));
      branch.skills.forEach((skill, row) => parts.push(this.node(skill, x, TOP + row * (NODE_H + NODE_GAP), colW)));
    });

    parts.push(
      scene.add
        .text(
          w / 2,
          h - 58,
          `Ganas ${POINTS_PER_STAGE} puntos al evolucionar o entrenar y 1 cada ${LEVELS_PER_POINT} niveles de experiencia.`,
          { ...textStyle(8, '#7080a0', null), align: 'center', wordWrap: { width: w - 40 } },
        )
        .setOrigin(0.5),
    );
    const close = new Button(scene, w / 2 - 70, h - 44, 140, 30, 'CERRAR', () => this.onClose(), { variant: 'red' });
    parts.push(close);

    this.container = scene.add.container((MAP_W - w) / 2, (MAP_H - h) / 2, parts).setDepth(DEPTH);
  }

  /** Recuadro de una habilidad: aprendida (verde), disponible (azul, se pulsa) o bloqueada (gris) */
  private node(skill: SkillDef, x: number, y: number, w: number): Phaser.GameObjects.Container {
    const scene = this.scene;
    const tower = this.tower;
    const learned = tower.skills.has(skill.id);
    const available = canLearn(skill.id, tower.skills, tower.freeSkillPoints, tower.def.ability);
    const [fill, border, ink] = learned
      ? [0xc8f0c8, 0x38a058, '#206838']
      : available
        ? [0xd8e8f8, 0x3c64c8, '#203c88']
        : [0xe8e8e8, 0xa8a8a8, '#909090'];

    const bg = scene.add.graphics();
    const draw = (hover: boolean) => {
      bg.clear().fillStyle(border).fillRoundedRect(0, 0, w, NODE_H, 6);
      bg.fillStyle(hover ? 0xffffff : fill).fillRoundedRect(2, 2, w - 4, NODE_H - 4, 5);
    };
    draw(false);
    const name = scene.add.text(10, 12, skill.name, textStyle(8, ink, null)).setOrigin(0, 0.5);
    const state = scene.add
      .text(w - 8, 12, learned ? 'OK' : available ? '1 PT' : '', textStyle(8, ink, null))
      .setOrigin(1, 0.5);
    const text = scene.add
      .text(10, 24, skill.description, { ...textStyle(8, learned || available ? '#404040' : '#a0a0a0', null), wordWrap: { width: w - 20 } })
      .setLineSpacing(4);
    const zone = scene.add.zone(0, 0, w, NODE_H).setOrigin(0).setInteractive({ useHandCursor: available });
    zone.on('pointerdown', () => this.learn(skill));
    if (available) {
      zone.on('pointerover', () => draw(true)).on('pointerout', () => draw(false));
    }
    return scene.add.container(x, y, [bg, name, state, text, zone]);
  }

  private learn(skill: SkillDef): void {
    if (!this.tower.learn(skill.id)) {
      if (!this.tower.skills.has(skill.id)) audio.play('error');
      return;
    }
    audio.play('levelup');
    this.onLearn();
    this.render();
  }
}
