import Phaser from 'phaser';
import type { Enemy } from './Enemy';

/** target es null si el objetivo murió antes de que llegara el proyectil */
export type HitHandler = (target: Enemy | null, x: number, y: number) => void;

export interface ProjectileOptions {
  texture: string;
  target: Enemy;
  speed: number;
  /** Radianes por segundo; 0 = orientar según la dirección de vuelo */
  spin?: number;
  scale?: number;
  onHit: HitHandler;
  /** Se llama en cada fotograma de vuelo, para dibujar la estela */
  onTrail?: (x: number, y: number) => void;
}

export class Projectile extends Phaser.GameObjects.Image {
  done = false;

  private readonly opts: ProjectileOptions;
  private targetX: number;
  private targetY: number;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: ProjectileOptions) {
    super(scene, x, y, opts.texture);
    this.opts = opts;
    this.targetX = opts.target.x;
    this.targetY = opts.target.aimY;
    this.setScale(opts.scale ?? 1).setDepth(30);
    scene.add.existing(this);
  }

  tick(dt: number): void {
    if (this.done) return;
    const { target, speed, spin = 0, onHit, onTrail } = this.opts;
    if (target.alive) {
      this.targetX = target.x;
      this.targetY = target.aimY;
    }
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.hypot(dx, dy);
    const step = speed * dt;
    if (dist <= step) {
      this.done = true;
      onHit(target.alive ? target : null, this.targetX, this.targetY);
      return;
    }
    this.x += (dx / dist) * step;
    this.y += (dy / dist) * step;
    this.rotation = spin ? this.rotation + spin * dt : Math.atan2(dy, dx);
    onTrail?.(this.x, this.y);
  }
}
