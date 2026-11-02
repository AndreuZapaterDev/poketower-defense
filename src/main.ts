import '@fontsource/press-start-2p';
import Phaser from 'phaser';
import { GAME_H, GAME_W } from './config';
import { loadFrontStrips } from './data/sprites';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { TitleScene } from './scenes/TitleScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#000000',
  pixelArt: true,
  // El sonido se genera con Web Audio propio (src/audio/Audio.ts)
  audio: { noAudio: true },
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, TitleScene, GameScene],
};

// Phaser dibuja el texto en canvas: la fuente tiene que estar cargada antes de arrancar.
// Las animaciones frontales se cargan aquí para recolocar las tiras más anchas (ver sprites.ts).
Promise.all([document.fonts.load('16px "Press Start 2P"').catch(() => undefined), loadFrontStrips()])
  .then(() => {
    const game = new Phaser.Game(config);
    // Solo en desarrollo: permite inspeccionar el juego desde la consola (window.game)
    if (import.meta.env.DEV) Object.assign(window, { game });
  });
