import '@fontsource/press-start-2p';
import Phaser from 'phaser';
import { GAME_H, GAME_W, RENDER_ZOOM } from './config';
import { loadFrontStrips, loadWalkSheets } from './data/sprites';
import { loadTilesets } from './world/tileset';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { IntroScene } from './scenes/IntroScene';
import { ItemShopScene } from './scenes/ItemShopScene';
import { PokemonShopScene } from './scenes/PokemonShopScene';
import { TeamScene } from './scenes/TeamScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { MapSelectScene } from './scenes/MapSelectScene';
import { OptionsScene } from './scenes/OptionsScene';
import { TitleScene } from './scenes/TitleScene';
import { UpgradesScene } from './scenes/UpgradesScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W * RENDER_ZOOM,
  height: GAME_H * RENDER_ZOOM,
  backgroundColor: '#000000',
  pixelArt: true,
  // El sonido se genera con Web Audio propio (src/audio/Audio.ts)
  audio: { noAudio: true },
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, TitleScene, IntroScene, MainMenuScene, MapSelectScene, UpgradesScene, TeamScene, PokemonShopScene, ItemShopScene, OptionsScene, GameScene],
};

// Phaser dibuja el texto en canvas: la fuente tiene que estar cargada antes de arrancar.
// Las animaciones frontales se cargan aquí para recolocar las tiras más anchas (ver sprites.ts).
// Las de andar, para saber antes de crear los enemigos qué Pokémon tienen hoja.
Promise.all([
  document.fonts.load('16px "Press Start 2P"').catch(() => undefined),
  loadFrontStrips(),
  loadWalkSheets(),
  loadTilesets(),
])
  .then(() => {
    const game = new Phaser.Game(config);
    // Solo en desarrollo: permite inspeccionar el juego desde la consola (window.game)
    if (import.meta.env.DEV) Object.assign(window, { game });
  });
