import Phaser from 'phaser';
import { MAP_H } from '../config';
import type { EnemyDef } from '../data/enemies';
import { WAYPOINTS } from '../data/map';
import { battleSprite, feetAnchor, type BattleSprite } from '../data/sprites';
import { hpColor } from '../ui/BossBar';
import type { Tower } from './Tower';

const BURN_TINT = 0xffa080;
const SLOW_TINT = 0xa8f0a0;
const FLASH_TIME = 0.07;
const SHAKE_TIME = 0.12;
/** Cada cuánto se muestra el daño acumulado por quemadura */
const BURN_REPORT_INTERVAL = 0.6;
/** La barra "fantasma" espera un poco y luego baja hasta la vida real */
const DRAIN_DELAY = 0.3;
const DRAIN_SPEED = 1.2; // fracción de la vida máxima por segundo
const HP_BAR_DEPTH = 36;
/** Altura de los pies respecto al centro del camino */
const FEET_Y = 10;

export class Enemy extends Phaser.GameObjects.Container {
  readonly def: EnemyDef;
  readonly maxHp: number;
  readonly level: number;
  hp: number;
  /** Distancia recorrida por el camino; sirve para apuntar al que va primero */
  distanceTravelled = 0;
  dead = false;
  reachedEnd = false;
  /** Torre que dio el último golpe, para contar sus KO */
  lastAttacker: Tower | null = null;
  /** Daño de quemadura pendiente de mostrar (lo recoge la escena) */
  burnReport = 0;

  private burnSource: Tower | null = null;
  private nextWaypoint = 1;
  private slowFactor = 1;
  private slowTimer = 0;
  private burnDps = 0;
  private burnTimer = 0;
  private burnAccum = 0;
  private burnReportTimer = BURN_REPORT_INTERVAL;
  private flashTimer = 0;
  private shakeTimer = 0;
  private trailHp: number;
  private drainDelay = 0;
  private hpDirty = true;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly hpBar: Phaser.GameObjects.Graphics;
  private readonly barWidth: number;
  private readonly barOffsetY: number;
  private readonly displaySize: number;
  private readonly look: BattleSprite;
  private readonly spriteScale: number;

  constructor(scene: Phaser.Scene, def: EnemyDef, hpMultiplier: number, level: number) {
    super(scene, WAYPOINTS[0].x, WAYPOINTS[0].y);
    this.def = def;
    this.level = level;
    this.maxHp = Math.round(def.hp * hpMultiplier);
    this.hp = this.maxHp;
    this.trailHp = this.maxHp;

    // El sprite se apoya por los pies un poco por debajo del centro del camino
    const look = battleSprite(def.sprite);
    // Se escala por la parte visible, sin el margen transparente de debajo de los pies
    const scale = def.size / Math.max(1, look.size - look.bottomPad);
    this.look = look;
    this.spriteScale = scale;
    this.displaySize = def.size;
    const width = def.size * 0.8;
    const parts: Phaser.GameObjects.GameObject[] = [];
    if (def.boss) {
      const aura = scene.add.ellipse(0, FEET_Y, width * 1.1, width * 0.4, 0xff3030, 0.35);
      scene.tweens.add({ targets: aura, alpha: 0.1, scale: 1.2, duration: 500, yoyo: true, repeat: -1 });
      parts.push(aura);
    }
    parts.push(scene.add.image(0, FEET_Y, 'shadow').setScale(width / 32, width / 64).setAlpha(0.3));
    const pos = feetAnchor(look, scale, false, FEET_Y + 2);
    this.sprite = scene.add.sprite(pos.x, pos.y, look.texture).setOrigin(0.5, 1).setScale(scale);
    this.sprite.play({ key: look.anim, startFrame: Phaser.Math.Between(0, look.frames - 1) });
    parts.push(this.sprite);
    this.add(parts);

    // La barra va en su propia capa para que no la tapen otros Pokémon
    this.barWidth = Math.round(Phaser.Math.Clamp(def.size * 0.75, 30, 60));
    this.barOffsetY = Math.round(FEET_Y - def.size - 6);
    this.hpBar = scene.add.graphics().setDepth(HP_BAR_DEPTH);

    scene.add.existing(this);
    this.updateHpBar(0);
  }

  get alive(): boolean {
    return !this.dead && !this.reachedEnd;
  }

  /** X local del sprite para que los pies queden centrados sobre la sombra */
  private get anchorX(): number {
    return feetAnchor(this.look, this.spriteScale, this.sprite.flipX, 0).x;
  }

  get hitRadius(): number {
    return this.displaySize * 0.32;
  }

  /** Centro del cuerpo: donde apuntan los ataques y salen los números */
  get aimY(): number {
    return this.y + FEET_Y - this.displaySize * 0.45;
  }

  get topY(): number {
    return this.y + FEET_Y - this.displaySize;
  }

  tick(dt: number): void {
    if (!this.alive) return;

    if (this.burnTimer > 0) {
      this.burnTimer -= dt;
      const burn = Math.min(this.burnDps * dt, this.hp);
      this.burnAccum += burn;
      this.burnReportTimer -= dt;
      this.takeDamage(burn, this.burnSource, false);
      if (this.burnReportTimer <= 0 || this.burnTimer <= 0 || this.dead) {
        this.burnReport += this.burnAccum;
        this.burnAccum = 0;
        this.burnReportTimer = BURN_REPORT_INTERVAL;
      }
      if (this.dead) return;
    }
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) this.slowFactor = 1;
    }
    if (this.flashTimer > 0) this.flashTimer -= dt;

    if (this.flashTimer > 0) this.sprite.setTintFill(0xffffff);
    else if (this.burnTimer > 0) this.sprite.setTint(BURN_TINT);
    else if (this.slowTimer > 0) this.sprite.setTint(SLOW_TINT);
    else this.sprite.clearTint();

    // Pequeña sacudida al recibir un golpe
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      this.sprite.x = this.anchorX + (this.shakeTimer > 0 ? Phaser.Math.Between(-2, 2) : 0);
    }

    this.advance(this.def.speed * this.slowFactor * dt);
    // Los que están más abajo se dibujan por delante
    this.setDepth(20 + this.y / MAP_H);
    this.updateHpBar(dt);
  }

  takeDamage(amount: number, source: Tower | null, flash = true): void {
    if (!this.alive || amount <= 0) return;
    this.hp -= amount;
    if (source) this.lastAttacker = source;
    if (flash) {
      this.flashTimer = FLASH_TIME;
      this.shakeTimer = SHAKE_TIME;
      this.drainDelay = DRAIN_DELAY;
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
    }
    this.hpDirty = true;
  }

  applySlow(factor: number, duration: number): void {
    this.slowFactor = Math.min(this.slowFactor, factor);
    this.slowTimer = Math.max(this.slowTimer, duration);
  }

  applyBurn(dps: number, duration: number, source: Tower): void {
    this.burnSource = source;
    this.burnDps = this.burnTimer > 0 ? Math.max(this.burnDps, dps) : dps;
    this.burnTimer = Math.max(this.burnTimer, duration);
  }

  /** Animación de debilitado (o de entrar al Centro) y destrucción */
  vanish(): void {
    this.hpBar.destroy();
    this.sprite.stop().clearTint();
    this.sprite.x = this.anchorX;
    const fainted = this.dead;
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      y: fainted ? this.y + 8 : this.y - 10,
      scaleY: fainted ? 0.4 : 0.8,
      duration: fainted ? 300 : 220,
      onComplete: () => this.destroy(),
    });
  }

  destroy(fromScene?: boolean): void {
    this.hpBar.destroy();
    super.destroy(fromScene);
  }

  private advance(distance: number): void {
    let remaining = distance;
    while (remaining > 0 && this.nextWaypoint < WAYPOINTS.length) {
      const target = WAYPOINTS[this.nextWaypoint];
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const dist = Math.hypot(dx, dy);
      // Los sprites miran a la izquierda: se voltean al ir a la derecha
      if (Math.abs(dx) > 0.5 && this.sprite.flipX !== dx > 0) {
        this.sprite.setFlipX(dx > 0);
        this.sprite.x = this.anchorX;
      }
      if (dist <= remaining) {
        this.setPosition(target.x, target.y);
        remaining -= dist;
        this.distanceTravelled += dist;
        this.nextWaypoint++;
      } else {
        this.x += (dx / dist) * remaining;
        this.y += (dy / dist) * remaining;
        this.distanceTravelled += remaining;
        remaining = 0;
      }
    }
    if (this.nextWaypoint >= WAYPOINTS.length) this.reachedEnd = true;
  }

  private updateHpBar(dt: number): void {
    this.hpBar.setPosition(Math.round(this.x), Math.round(this.y + this.barOffsetY));

    if (this.trailHp > this.hp) {
      if (this.drainDelay > 0) this.drainDelay -= dt;
      else this.trailHp = Math.max(this.hp, this.trailHp - this.maxHp * DRAIN_SPEED * dt);
      this.hpDirty = true;
    }
    if (!this.hpDirty) return;
    this.hpDirty = false;

    const w = this.barWidth;
    const x = -w / 2;
    const ratio = this.hp / this.maxHp;
    const trail = this.trailHp / this.maxHp;
    const g = this.hpBar;
    g.clear();
    g.fillStyle(0x181818).fillRoundedRect(x - 2, -2, w + 4, 9, 2);
    g.fillStyle(0x485048).fillRect(x, 0, w, 5);
    g.fillStyle(0xf8f8f8).fillRect(x, 0, w * trail, 5);
    g.fillStyle(hpColor(ratio)).fillRect(x, 0, w * ratio, 5);
    g.fillStyle(0xffffff, 0.45).fillRect(x, 0, w * ratio, 1);
  }
}
