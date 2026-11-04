import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../config';
import {
  ICON_FRAME,
  WALK_DIRS,
  WALK_FRAMES,
  allSpriteKeys,
  frontAnim,
  frontKey,
  frontStrips,
  iconAnim,
  iconKey,
  iconPath,
  walkAnim,
  walkKey,
  walkSheets,
} from '../data/sprites';
import { difficultyById } from '../data/map';
import { ITEMS, itemKey, itemPath } from '../data/items';
import { INTRO_IMAGES } from './IntroScene';
import { fitCamera } from '../ui/theme';
import { buildTextures } from '../world/textures';
import type { GameSceneData } from './GameScene';

// Fotogramas por segundo de las animaciones frontales (más bajo = más pausado)
const FRONT_FRAME_RATE = 10;
const WALK_FRAME_RATE = 8;

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    fitCamera(this);
    this.drawLoadingBar();
    for (const key of allSpriteKeys()) {
      this.load.spritesheet(iconKey(key), iconPath(key), { frameWidth: ICON_FRAME, frameHeight: ICON_FRAME });
    }
    for (const item of ITEMS) this.load.image(itemKey(item), itemPath(item));
    for (const [key, path] of Object.entries(INTRO_IMAGES)) this.load.image(key, path);
  }

  create(): void {
    for (const key of allSpriteKeys()) {
      this.anims.create({
        key: iconAnim(key),
        frames: this.anims.generateFrameNumbers(iconKey(key), { start: 0, end: 1 }),
        frameRate: 3,
        repeat: -1,
      });
    }
    this.registerFrontStrips();
    this.registerWalkSheets();
    buildTextures(this);
    // Atajo de desarrollo: http://localhost:9000/#game (o #game=gimnasioplateada:hard, o con :resume para seguir la partida guardada) salta los menús
    const [hash, args = ''] = window.location.hash.split('=');
    const [mapId, difficulty, extra] = args.split(':');
    // y #scene=MapSelect (o cualquier otra escena) abre ese menú directamente
    if (hash === '#game') this.scene.start('Game', { mapId, difficulty: difficultyById(difficulty), resume: extra === 'resume' } satisfies GameSceneData);
    else if (hash === '#scene' && this.scene.get(args)) this.scene.start(args);
    else this.scene.start('Title');
  }

  /** Convierte las tiras frontales (cargadas en main.ts) en texturas con fotogramas y animaciones */
  private registerFrontStrips(): void {
    for (const [sprite, strip] of frontStrips) {
      const key = frontKey(sprite);
      if (this.textures.exists(key)) continue;
      const texture = this.textures.addCanvas(key, strip.canvas);
      if (!texture) continue;
      for (let i = 0; i < strip.count; i++) {
        texture.add(i, 0, (i % strip.cols) * strip.size, Math.floor(i / strip.cols) * strip.size, strip.size, strip.size);
      }
      this.anims.create({
        key: frontAnim(sprite),
        frames: Array.from({ length: strip.count }, (_, i) => ({ key, frame: i })),
        frameRate: FRONT_FRAME_RATE,
        repeat: -1,
      });
    }
  }

  /** Convierte las hojas de andar (cargadas en main.ts) en texturas con una animación por dirección */
  private registerWalkSheets(): void {
    for (const [sprite, sheet] of walkSheets) {
      const key = walkKey(sprite);
      if (this.textures.exists(key)) continue;
      this.textures.addSpriteSheet(key, sheet.image, { frameWidth: sheet.size, frameHeight: sheet.size });
      WALK_DIRS.forEach((dir, row) => {
        this.anims.create({
          key: walkAnim(sprite, dir),
          frames: this.anims.generateFrameNumbers(key, { start: row * WALK_FRAMES, end: row * WALK_FRAMES + WALK_FRAMES - 1 }),
          frameRate: WALK_FRAME_RATE,
          repeat: -1,
        });
      });
    }
  }

  private drawLoadingBar(): void {
    const width = GAME_W;
    const height = GAME_H;
    const w = 320;
    const x = (width - w) / 2;
    const y = height / 2;
    const g = this.add.graphics();
    g.fillStyle(0x404858).fillRoundedRect(x - 4, y - 4, w + 8, 20, 6);
    const bar = this.add.graphics();
    this.load.on('progress', (p: number) => {
      bar.clear().fillStyle(0xe04040).fillRoundedRect(x, y, w * p, 12, 4);
    });
  }
}
