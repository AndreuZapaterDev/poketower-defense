import Phaser from 'phaser';
import { SCALE, SELL_RATIO, TILE } from '../config';
import { battleSprite, feetAnchor, type BattleSprite } from '../data/sprites';
import type { TowerDef, TowerStage } from '../data/towers';
import { TYPE_COLORS } from '../data/types';
import { darken } from '../ui/theme';

/** Altura de los pies respecto al centro de la casilla (sobre la plataforma) */
export const TOWER_FEET_Y = 15 * SCALE;
/** Tamaño máximo con que se dibuja cada fase: los evolucionados se ven más grandes */
const STAGE_MAX_SIZE = [50, 64, 78].map((size) => size * SCALE);
/** Daño extra por cada nivel ganado con experiencia por encima del nivel de su fase */
const LEVEL_BONUS = 0.03;
const MAX_LEVEL = 100;
/** Ritmo con que se alternan las dos siluetas al evolucionar (ms), cada vez más rápido */
const EVOLUTION_FLICKER = [260, 220, 190, 160, 130, 110, 90, 75, 60, 50, 40, 40];

export type TargetMode = 'first' | 'last' | 'strong' | 'close';
export const TARGET_MODES: TargetMode[] = ['first', 'last', 'strong', 'close'];
export const TARGET_LABELS: Record<TargetMode, string> = {
  first: 'PRIMERO',
  last: 'ULTIMO',
  strong: 'MAS FUERTE',
  close: 'MAS CERCANO',
};

/** Escala para que un Pokémon de la fase `stage` no supere su tamaño máximo (sin agrandar los pequeños) */
export function towerScale(sprite: string, stage: number): number {
  const look = battleSprite(sprite);
  return Math.min(1, STAGE_MAX_SIZE[Math.min(stage, STAGE_MAX_SIZE.length - 1)] / look.size);
}

export class Tower extends Phaser.GameObjects.Container {
  readonly def: TowerDef;
  readonly col: number;
  readonly row: number;
  stage = 0;
  level: number;
  /** Experiencia acumulada hacia el siguiente nivel */
  exp = 0;
  /** Milisegundos hasta el siguiente ataque */
  cooldown = 0;
  /** Dinero total invertido (compra + evoluciones) */
  spent: number;
  kills = 0;
  targetMode: TargetMode = 'first';
  evolving = false;
  private released = false;

  private readonly sprite: Phaser.GameObjects.Sprite;
  private baseScale = 1;
  private look!: BattleSprite;

  constructor(scene: Phaser.Scene, def: TowerDef, col: number, row: number) {
    super(scene, col * TILE + TILE / 2, row * TILE + TILE / 2);
    this.def = def;
    this.col = col;
    this.row = row;
    this.spent = def.stages[0].cost;
    this.level = def.stages[0].level;

    // Plataforma de combate del color del tipo
    const color = TYPE_COLORS[def.type];
    const platform = scene.add.graphics();
    platform.fillStyle(darken(color, 35)).fillEllipse(0, 9, 30, 11);
    platform.fillStyle(color).fillEllipse(0, 9, 27, 8);
    platform.fillStyle(0xffffff, 0.35).fillEllipse(-3, 7, 16, 3);

    this.sprite = scene.add.sprite(0, TOWER_FEET_Y, battleSprite(this.stats.sprite).texture).setOrigin(0.5, 1);
    this.showStage();
    this.add([platform, this.sprite]);
    this.setDepth(10 + row / 100);
    // Invisible hasta que sale de la Poké Ball (ver release)
    this.setVisible(false);
    scene.add.existing(this);
  }

  /** No ataca mientras sale de la Poké Ball o evoluciona */
  get busy(): boolean {
    return this.evolving || !this.released;
  }

  get stats(): TowerStage {
    return this.def.stages[this.stage];
  }

  /** Daño real: el de su fase más un bonus por los niveles ganados con experiencia */
  get damage(): number {
    return Math.round(this.stats.damage * (1 + LEVEL_BONUS * Math.max(0, this.level - this.stats.level)));
  }

  get expToNext(): number {
    return 4 + this.level;
  }

  get canEvolve(): boolean {
    return this.stage < this.def.stages.length - 1;
  }

  get evolveCost(): number {
    return this.canEvolve ? this.def.stages[this.stage + 1].cost : 0;
  }

  get sellValue(): number {
    return Math.floor(this.spent * SELL_RATIO);
  }

  /** Altura visible del Pokémon (sin el margen transparente de debajo) */
  private get bodyHeight(): number {
    return (this.look.size - this.look.bottomPad) * this.baseScale;
  }

  /** Punto desde el que salen los ataques (a media altura del Pokémon) */
  get mouthY(): number {
    return this.y + TOWER_FEET_Y - this.bodyHeight * 0.55;
  }

  get topY(): number {
    return this.y + TOWER_FEET_Y - this.bodyHeight;
  }

  /** Posición del sprite para que los pies queden sobre la plataforma */
  private get anchor() {
    return feetAnchor(this.look, this.baseScale, this.sprite.flipX, TOWER_FEET_Y);
  }

  private resetPose(): void {
    const { x, y } = this.anchor;
    this.sprite.setPosition(x, y).setScale(this.baseScale);
  }

  cycleTargetMode(): void {
    this.targetMode = TARGET_MODES[(TARGET_MODES.indexOf(this.targetMode) + 1) % TARGET_MODES.length];
  }

  /** Suma experiencia y devuelve cuántos niveles ha subido */
  gainExp(amount: number): number {
    if (this.level >= MAX_LEVEL) return 0;
    this.exp += amount;
    let gained = 0;
    while (this.exp >= this.expToNext && this.level < MAX_LEVEL) {
      this.exp -= this.expToNext;
      this.level++;
      gained++;
    }
    if (this.level >= MAX_LEVEL) this.exp = 0;
    if (gained) {
      this.scene.tweens.add({ targets: this.sprite, y: this.anchor.y - 8, duration: 120, yoyo: true });
    }
    return gained;
  }

  /** Sale de la Poké Ball: aparece como silueta blanca que crece */
  release(): void {
    this.setVisible(true);
    this.resetPose();
    this.sprite.setTintFill(0xffffff).setScale(0);
    this.scene.tweens.add({
      targets: this.sprite,
      scale: this.baseScale,
      duration: 280,
      ease: 'Back.easeOut',
      onComplete: () => {
        if (!this.active) return;
        this.sprite.clearTint();
        this.released = true;
      },
    });
  }

  /** Vuelve a la Poké Ball (al venderlo) y desaparece */
  recall(): void {
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.setTintFill(0xff5050);
    this.scene.tweens.add({ targets: this.sprite, scale: 0, y: this.anchor.y - 12, duration: 280, ease: 'Quad.easeIn' });
    this.scene.tweens.add({ targets: this, alpha: 0, delay: 260, duration: 160, onComplete: () => this.destroy() });
  }

  /** Mira hacia el objetivo y hace un pequeño salto (o embestida si es cuerpo a cuerpo) */
  attackAnim(targetX: number, targetY: number, lunge: boolean): void {
    this.sprite.setFlipX(targetX > this.x);
    this.scene.tweens.killTweensOf(this.sprite);
    this.resetPose();
    const { x, y } = this.anchor;
    if (lunge) {
      const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
      this.scene.tweens.add({
        targets: this.sprite,
        x: x + Math.cos(angle) * 12,
        y: y + Math.sin(angle) * 12,
        duration: 60,
        yoyo: true,
      });
    } else {
      this.scene.tweens.add({ targets: this.sprite, y: y - 5, duration: 80, yoyo: true });
    }
  }

  /**
   * Pasa a la siguiente fase. Devuelve true si cambia de forma (evolución) y false si solo
   * sube de nivel. `onEvolved` se llama al terminar la animación de evolución.
   */
  evolve(onEvolved?: () => void): boolean {
    if (!this.canEvolve) return false;
    const before = this.stats.sprite;
    const beforeScale = this.baseScale;
    this.spent += this.evolveCost;
    this.stage++;
    this.level = Math.max(this.level, this.stats.level);
    const after = this.stats.sprite;

    this.scene.tweens.killTweensOf(this.sprite);
    this.resetPose();

    if (before === after) {
      this.showStage();
      this.scene.tweens.add({ targets: this.sprite, y: this.anchor.y - 12, duration: 150, yoyo: true, ease: 'Quad.easeOut' });
      return false;
    }

    // Como en los juegos: las siluetas de antes y después se alternan cada vez más rápido
    const looks = [battleSprite(after), battleSprite(before)];
    const scales = [towerScale(after, this.stage), beforeScale];
    this.evolving = true;
    this.released = true;
    this.sprite.stop().setTintFill(0xffffff);
    let elapsed = 0;
    EVOLUTION_FLICKER.forEach((ms, i) => {
      elapsed += ms;
      this.scene.time.delayedCall(elapsed, () => {
        if (!this.active) return;
        const look = looks[i % 2];
        const pos = feetAnchor(look, scales[i % 2], this.sprite.flipX, TOWER_FEET_Y);
        this.sprite.setTexture(look.texture, 0).setScale(scales[i % 2]).setPosition(pos.x, pos.y);
      });
    });
    this.scene.time.delayedCall(elapsed + 120, () => {
      if (!this.active) return;
      this.showStage();
      this.sprite.setTintFill(0xffffff);
      this.scene.tweens.add({ targets: this.sprite, scale: { from: this.baseScale * 1.3, to: this.baseScale }, duration: 220 });
      this.scene.time.delayedCall(260, () => {
        if (this.active) this.sprite.clearTint();
      });
      this.evolving = false;
      onEvolved?.();
    });
    return true;
  }

  /** Pone la textura, animación y escala de la fase actual */
  private showStage(): void {
    this.look = battleSprite(this.stats.sprite);
    this.baseScale = towerScale(this.stats.sprite, this.stage);
    this.sprite.setTexture(this.look.texture);
    this.resetPose();
    this.sprite.play({ key: this.look.anim, startFrame: Phaser.Math.Between(0, this.look.frames - 1) });
  }
}
