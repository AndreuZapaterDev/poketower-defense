import Phaser from 'phaser';
import { audio } from '../audio/Audio';
import { battleSprite } from '../data/sprites';
import { WAVES } from '../data/waves';
import { loadBestWave } from '../save';
import { POKEBALL_CURSOR, WHITE, drawPanel, textStyle } from '../ui/theme';

const STARTERS = ['bulbasaur', 'charmander', 'squirtle'];

export class TitleScene extends Phaser.Scene {
  private starting = false;

  constructor() {
    super('Title');
  }

  create(): void {
    this.starting = false;
    const { width: W, height: H } = this.scale;
    const horizon = H * 0.6;

    // Cielo, nubes, colinas y hierba
    const g = this.add.graphics();
    g.fillGradientStyle(0x58a8f0, 0x58a8f0, 0xb8e0f8, 0xb8e0f8, 1).fillRect(0, 0, W, horizon);
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

    // Logo
    const logo = this.add
      .text(W / 2, 96, 'POKéTOWER', { ...textStyle(48, '#ffcb05', '#1d2c5e'), stroke: '#3c5aa6', strokeThickness: 10 })
      .setOrigin(0.5);
    logo.setShadow(4, 5, '#1d2c5e', 0, true, true);
    this.add
      .text(W / 2, 156, 'DEFENSE', { ...textStyle(24, WHITE, '#1d2c5e'), stroke: '#3c5aa6', strokeThickness: 8 })
      .setOrigin(0.5);
    this.tweens.add({ targets: logo, y: 102, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const best = loadBestWave();
    if (best > 0) {
      const record = best >= WAVES.length ? '¡RUTA 1 COMPLETADA!' : `RECORD: OLEADA ${best}/${WAVES.length}`;
      this.add.text(W / 2, 196, record, textStyle(8, WHITE, '#1d2c5e')).setOrigin(0.5);
    }

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

  private startGame(): void {
    if (this.starting) return;
    this.starting = true;
    audio.unlock();
    audio.play('evolve');
    this.cameras.main.flash(200, 255, 255, 255);
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Game'));
  }
}
