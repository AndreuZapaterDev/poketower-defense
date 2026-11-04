import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../config';
import { audio } from '../audio/Audio';
import { loadIntroSeen } from '../save';
import { battleSprite, iconAnim, iconKey } from '../data/sprites';
import { POKEBALL_CURSOR, WHITE, drawPanel, drawPineRow, fitCamera, textStyle } from '../ui/theme';

const STARTERS = ['bulbasaur', 'charmander', 'squirtle'];

export class TitleScene extends Phaser.Scene {
  private starting = false;

  constructor() {
    super('Title');
  }

  create(): void {
    fitCamera(this);
    this.starting = false;
    const W = GAME_W;
    const H = GAME_H;
    const horizon = H * 0.6;

    // Cielo, bosque en el horizonte, colinas y hierba
    this.add.graphics().fillGradientStyle(0x58a8f0, 0x58a8f0, 0xb8e0f8, 0xb8e0f8, 1).fillRect(0, 0, W, horizon);
    this.addPokeballHalo(W / 2, 122);
    const forest = this.add.graphics();
    drawPineRow(forest, W, horizon - 30, 0x4c8c58, 50, 90, 'title-back');
    drawPineRow(forest, W, horizon - 4, 0x3c7848, 40, 70, 'title-front');
    const g = this.add.graphics();
    g.fillStyle(0x68b058).fillEllipse(W * 0.2, horizon, W * 0.7, 140);
    g.fillStyle(0x78c060).fillEllipse(W * 0.8, horizon + 10, W * 0.8, 160);
    g.fillStyle(0x88c870).fillRect(0, horizon, W, H - horizon);
    const rng = new Phaser.Math.RandomDataGenerator(['title']);
    g.fillStyle(0x68a850);
    for (let i = 0; i < 70; i++) {
      const x = rng.between(0, W);
      const y = rng.between(horizon + 10, H - 6);
      g.fillRect(x, y, 2, 5).fillRect(x + 4, y, 2, 5).fillRect(x + 2, y + 3, 2, 4);
    }
    for (const [cx, cy, s] of [
      [140, 70, 1],
      [W - 180, 110, 1.3],
      [W / 2 + 60, 40, 0.8],
    ]) {
      const cloud = this.add.graphics({ x: cx, y: cy });
      cloud.fillStyle(0xffffff, 0.9).fillEllipse(0, 0, 90 * s, 30 * s).fillEllipse(-25 * s, -10 * s, 50 * s, 30 * s);
      cloud.fillEllipse(25 * s, -12 * s, 60 * s, 36 * s);
      this.tweens.add({ targets: cloud, x: cx + 30, duration: 6000 + s * 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    this.addFlyingPidgey();

    // Logo
    const logo = this.add
      .text(W / 2, 96, 'POKéTOWER', { ...textStyle(48, '#ffcb05', '#1d2c5e'), stroke: '#3c5aa6', strokeThickness: 10 })
      .setOrigin(0.5);
    logo.setShadow(4, 5, '#1d2c5e', 0, true, true);
    this.add
      .text(W / 2, 156, 'DEFENSE', { ...textStyle(24, WHITE, '#1d2c5e'), stroke: '#3c5aa6', strokeThickness: 8 })
      .setOrigin(0.5);
    this.tweens.add({ targets: logo, y: 102, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Iniciales
    STARTERS.forEach((key, i) => {
      const x = W / 2 + (i - 1) * 170;
      const y = horizon + 80;
      this.add.image(x, y, 'shadow').setScale(2.8, 2).setAlpha(0.25);
      const look = battleSprite(key);
      const sprite = this.add.sprite(x, y + 4, look.texture).setOrigin(0.5, 1).setScale(90 / look.size);
      sprite.play({ key: look.anim, startFrame: Math.floor((look.frames * i) / 3) });
      if (i === 2) sprite.setFlipX(true);
      this.tweens.add({ targets: sprite, y: y - 8, duration: 500, yoyo: true, repeat: -1, delay: i * 160, ease: 'Quad.easeOut' });
    });

    // Aviso para empezar
    const panelW = 420;
    const panel = drawPanel(this.add.graphics(), (W - panelW) / 2, H - 92, panelW, 48);
    const prompt = this.add.text(W / 2, H - 68, 'PULSA PARA EMPEZAR', textStyle(16)).setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.2, duration: 550, yoyo: true, repeat: -1 });
    this.add.container(0, 0, [panel, prompt]);

    this.add
      .text(W / 2, H - 20, 'Fan game sin ánimo de lucro · Pokémon © Nintendo / Game Freak', textStyle(8, WHITE, '#305028'))
      .setOrigin(0.5)
      .setAlpha(0.8);

    this.input.setDefaultCursor(POKEBALL_CURSOR);
    this.input.once('pointerdown', () => this.startGame());
    this.input.keyboard?.once('keydown', () => this.startGame());
  }

  /** Poké Ball grande y translúcida que gira despacio detrás del logo */
  private addPokeballHalo(x: number, y: number): void {
    const r = 130;
    const g = this.add.graphics({ x, y }).setAlpha(0.22);
    g.fillStyle(0xffffff).slice(0, 0, r, Math.PI, 0, false).fillPath();
    g.fillStyle(0xffffff, 0.5).slice(0, 0, r, 0, Math.PI, false).fillPath();
    g.fillStyle(0x3c5aa6).fillRect(-r, -6, r * 2, 12).fillCircle(0, 0, 34);
    g.fillStyle(0xffffff).fillCircle(0, 0, 22);
    this.tweens.add({ targets: g, angle: 360, duration: 40000, repeat: -1 });
  }

  /** De vez en cuando, un Pidgey cruza el cielo aleteando */
  private addFlyingPidgey(): void {
    if (!this.textures.exists(iconKey('pidgey'))) return;
    const bird = this.add.sprite(-40, 0, iconKey('pidgey')).setFlipX(true).play(iconAnim('pidgey'));
    bird.anims.timeScale = 3;
    const fly = (delay: number) => {
      const y = Phaser.Math.Between(40, 200);
      bird.setPosition(-40, y);
      this.tweens.add({ targets: bird, x: GAME_W + 40, duration: 9000, delay, onComplete: () => fly(Phaser.Math.Between(4000, 9000)) });
      this.tweens.add({ targets: bird, y: y - 24, duration: 900, delay, yoyo: true, repeat: 4, ease: 'Sine.easeInOut' });
    };
    fly(1500);
  }

  private startGame(): void {
    if (this.starting) return;
    this.starting = true;
    audio.unlock();
    // En pantallas táctiles el juego se ve mucho mejor a pantalla completa
    if (window.matchMedia('(pointer: coarse)').matches && !this.scale.isFullscreen) {
      try {
        this.scale.startFullscreen();
      } catch {
        // el navegador no lo permite: se sigue jugando igual
      }
    }
    audio.play('click');
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
      // La primera vez, el Profesor Oak explica el juego
      this.scene.start(loadIntroSeen() ? 'MainMenu' : 'Intro'),
    );
  }
}
