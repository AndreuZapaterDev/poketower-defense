import Phaser from 'phaser';
import { textStyle } from '../ui/theme';

type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;
type EmitterConfig = Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;

const DEPTH = 45;
const FIRE_TINTS = [0xfff0a0, 0xffc040, 0xff8020, 0xf04010];

/** Efectos visuales de ataques y golpes. Los emisores se crean bajo demanda y se reutilizan. */
export class Effects {
  private readonly scene: Phaser.Scene;
  private readonly emitters = new Map<string, Emitter>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  private emitter(key: string, texture: string, config: EmitterConfig, depth = DEPTH): Emitter {
    let emitter = this.emitters.get(key);
    if (!emitter) {
      emitter = this.scene.add.particles(0, 0, texture, { ...config, emitting: false }).setDepth(depth);
      this.emitters.set(key, emitter);
    }
    return emitter;
  }

  // ------------------------------------------------------------ genéricos

  burst(x: number, y: number, color: number, count = 4): void {
    this.emitter(`burst-${color}`, 'px', {
      speed: { min: 30, max: 90 },
      lifespan: 300,
      scale: { start: 1, end: 0 },
      tint: color,
    }).explode(count, x, y);
  }

  superEffective(x: number, y: number): void {
    this.emitter('stars', 'star', {
      speed: { min: 60, max: 150 },
      lifespan: 450,
      scale: { start: 1.1, end: 0 },
      rotate: { start: 0, end: 180 },
      tint: [0xfff060, 0xffffff, 0xffc030],
    }).explode(6, x, y);
  }

  /** Fogonazo en la boca de la torre al atacar */
  muzzle(x: number, y: number, color: number): void {
    const flash = this.scene.add
      .image(x, y, 'flare')
      .setTint(color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH)
      .setScale(0.8);
    this.fade(flash, 140, { scale: 2.4 });
  }

  /** Estela de un proyectil en vuelo */
  trail(kind: 'fire' | 'water', x: number, y: number): void {
    if (kind === 'fire') {
      this.emitter('trail-fire', 'flare', {
        speed: { min: 0, max: 18 },
        lifespan: 260,
        scale: { start: 0.9, end: 0 },
        alpha: { start: 0.9, end: 0 },
        tint: FIRE_TINTS,
        blendMode: 'ADD',
      }).explode(2, x, y);
    } else {
      this.emitter('trail-water', 'bubble', {
        speed: { min: 0, max: 25 },
        lifespan: 320,
        scale: { start: 0.55, end: 0 },
        alpha: { start: 0.9, end: 0 },
      }).explode(1, x, y);
    }
  }

  // ------------------------------------------------------------ fuego

  fireExplosion(x: number, y: number, power: number): void {
    const size = 1 + power * 0.35;
    const glow = this.scene.add
      .image(x, y, 'flare')
      .setTint(0xffa040)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH)
      .setScale(0.6);
    this.fade(glow, 260, { scale: 3.2 * size });
    this.ring(x, y, 22 * size, 0xff8030, 3);
    this.emitter('fire-burst', 'flare', {
      speed: { min: 50, max: 150 },
      lifespan: { min: 250, max: 420 },
      scale: { start: 1.3, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: FIRE_TINTS,
      blendMode: 'ADD',
    }).explode(Math.round(8 + power * 5), x, y);
    this.emitter('embers', 'px', {
      speed: { min: 20, max: 70 },
      lifespan: 700,
      scale: { start: 0.8, end: 0 },
      gravityY: -90,
      tint: [0xffe060, 0xff9030],
    }).explode(5, x, y);
  }

  /** Chorro de fuego en cono hacia `angle` */
  flameJet(x: number, y: number, angle: number, range: number, power: number): void {
    const deg = Phaser.Math.RadToDeg(angle);
    const lifespan = 330;
    const jet = this.emitter('flame-jet', 'flare', {
      lifespan,
      scale: { start: 0.5, end: 2.6 },
      alpha: { start: 1, end: 0 },
      tint: FIRE_TINTS,
      blendMode: 'ADD',
    });
    jet.setEmitterAngle({ min: deg - 8, max: deg + 8 });
    jet.setParticleSpeed((range / lifespan) * 1000 * 0.95);
    jet.explode(22 + power * 8, x, y);

    const core = this.emitter('flame-core', 'flare', {
      lifespan: 220,
      scale: { start: 0.4, end: 1.2 },
      alpha: { start: 1, end: 0 },
      tint: 0xffffc0,
      blendMode: 'ADD',
    });
    core.setEmitterAngle({ min: deg - 3, max: deg + 3 });
    core.setParticleSpeed((range / 220) * 1000 * 0.6);
    core.explode(10, x, y);
  }

  // ------------------------------------------------------------ agua

  splash(x: number, y: number, radius: number, power: number): void {
    const ring = this.scene.add
      .circle(x, y, radius, 0x88c8f8, 0.3)
      .setStrokeStyle(3, 0x3878d0)
      .setDepth(DEPTH)
      .setScale(0.2);
    this.fade(ring, 300, { scale: 1 });
    this.ring(x, y, radius * 0.7, 0xffffff, 2);
    this.emitter('droplets', 'drop', {
      speed: { min: 90, max: 190 },
      angle: { min: 200, max: 340 },
      gravityY: 520,
      lifespan: 550,
      scale: { start: 1.2, end: 0.5 },
    }).explode(10 + power * 4, x, y);
    this.emitter('foam', 'bubble', {
      speed: { min: 30, max: 90 },
      lifespan: 400,
      scale: { start: 0.8, end: 0 },
    }).explode(6, x, y);
  }

  // ------------------------------------------------------------ planta

  /** Látigo Cepa: una liana curva que sale de la torre y golpea al objetivo */
  vineWhip(x1: number, y1: number, x2: number, y2: number, power: number): void {
    const g = this.scene.add.graphics().setDepth(DEPTH);
    const angle = Phaser.Math.Angle.Between(x1, y1, x2, y2);
    const side = Math.random() < 0.5 ? -1 : 1;
    const bend = 26 * side;
    const mx = (x1 + x2) / 2 + Math.cos(angle + Math.PI / 2) * bend;
    const my = (y1 + y2) / 2 + Math.sin(angle + Math.PI / 2) * bend;
    const curve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(x1, y1),
      new Phaser.Math.Vector2(mx, my),
      new Phaser.Math.Vector2(x2, y2),
    );
    const points = curve.getPoints(18);
    const thick = 3 + power;

    const draw = (progress: number) => {
      const visible = points.slice(0, Math.max(2, Math.ceil(points.length * progress)));
      g.clear();
      g.lineStyle(thick + 3, 0x1c4818).strokePoints(visible);
      g.lineStyle(thick, 0x58b840).strokePoints(visible);
      g.lineStyle(1, 0xa8e888).strokePoints(visible);
      // Hojitas a lo largo de la liana
      for (let i = 4; i < visible.length; i += 5) {
        g.fillStyle(0x48a038).fillEllipse(visible[i].x + side * 3, visible[i].y - 3, 7, 4);
      }
    };

    const state = { p: 0 };
    this.scene.tweens.add({
      targets: state,
      p: 1,
      duration: 110,
      ease: 'Quad.easeOut',
      onUpdate: () => draw(state.p),
      onComplete: () => this.fade(g, 180, { delay: 60 }),
    });
  }

  leafBurst(x: number, y: number): void {
    this.emitter('leaves', 'leaf', {
      speed: { min: 50, max: 130 },
      rotate: { start: 0, end: 360 },
      lifespan: 550,
      scale: { start: 1, end: 0.3 },
      gravityY: 140,
    }).explode(6, x, y);
  }

  // ------------------------------------------------------------ lucha

  punchImpact(x: number, y: number, power: number): void {
    const size = 1 + power * 0.25;
    const spark = this.scene.add
      .image(x, y, 'hitspark')
      .setTint(0xfff4b0)
      .setDepth(DEPTH + 1)
      .setScale(0.3)
      .setAngle(Phaser.Math.Between(0, 45));
    this.fade(spark, 170, { scale: 1.3 * size, angle: spark.angle + 30 });
    this.ring(x, y, 26 * size, 0xffffff, 3);

    // Líneas de velocidad radiales, estilo cómic
    const lines = this.scene.add.graphics().setDepth(DEPTH);
    lines.lineStyle(2, 0xffffff);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.random() * 0.3;
      lines.lineBetween(x + Math.cos(a) * 12, y + Math.sin(a) * 12, x + Math.cos(a) * 26 * size, y + Math.sin(a) * 26 * size);
    }
    this.fade(lines, 160);
    this.burst(x, y, 0xfff0c0, 4);
  }

  // ------------------------------------------------------------ poké ball

  /** Destello al abrirse la Poké Ball y salir el Pokémon */
  pokeballOpen(x: number, y: number): void {
    const flash = this.scene.add
      .image(x, y, 'flare')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH + 2)
      .setScale(0.5);
    this.fade(flash, 320, { scale: 5 });
    this.ring(x, y, 34, 0xffffff, 3);
    this.emitter('ball-burst', 'px', {
      speed: { min: 60, max: 160 },
      lifespan: 420,
      scale: { start: 1.4, end: 0 },
      tint: [0xffffff, 0xff5050, 0xffffff],
    }).explode(16, x, y);
  }

  // ------------------------------------------------------------ otros

  /** Nube de humo al debilitarse un Pokémon */
  poof(x: number, y: number): void {
    this.emitter('poof', 'smoke', {
      speed: { min: 20, max: 70 },
      lifespan: 500,
      scale: { start: 0.6, end: 1.8 },
      alpha: { start: 0.8, end: 0 },
    }).explode(9, x, y);
  }

  sparkle(x: number, y: number): void {
    this.emitter('sparkle', 'star', {
      speed: { min: 20, max: 80 },
      lifespan: 700,
      scale: { start: 0.9, end: 0 },
      gravityY: -60,
      tint: [0xffffff, 0xfff8a0, 0xa0e0ff],
    }).explode(14, x, y);
  }

  floatText(x: number, y: number, message: string, color: string): void {
    const text = this.scene.add
      .text(x, y, message, textStyle(8, color, null))
      .setStroke('#303030', 3)
      .setOrigin(0.5)
      .setDepth(DEPTH + 10);
    this.fade(text, 700, { y: y - 22 });
  }

  private ring(x: number, y: number, radius: number, color: number, width: number): void {
    const ring = this.scene.add.circle(x, y, radius).setStrokeStyle(width, color).setDepth(DEPTH).setScale(0.2);
    this.fade(ring, 260, { scale: 1 });
  }

  private fade(target: Phaser.GameObjects.GameObject, duration: number, extra: object = {}): void {
    this.scene.tweens.add({ targets: target, alpha: 0, duration, ...extra, onComplete: () => target.destroy() });
  }
}
