import Phaser from 'phaser';
import { audio } from '../audio/Audio';
import { GAME_W, MAP_H, MAP_W } from '../config';
import { DIFFICULTIES, DIFFICULTY_IDS, MAPS, mapTextureKey, type Difficulty, type MapDef } from '../data/map';
import { WAVES } from '../data/waves';
import { loadBestWave } from '../save';
import { Button, type ButtonVariant } from '../ui/Button';
import {
  MENU_HEADER_H,
  POKEBALL_CURSOR,
  addMenuFooter,
  addMenuHeader,
  drawMenuBackground,
  drawPanel,
  textStyle,
  fitCamera,
} from '../ui/theme';
import type { GameSceneData } from './GameScene';

const BUTTON_VARIANTS: Record<Difficulty, ButtonVariant> = { easy: 'green', hard: 'red' };
const CARD_Y = MENU_HEADER_H + 18;
const CARD_GAP = 32;
const PAD = 16;
const BUTTON_H = 40;

/** Una opción jugable: un mapa con una dificultad */
interface Option {
  map: MapDef;
  difficulty: Difficulty;
}

export class MapSelectScene extends Phaser.Scene {
  private options: Option[] = [];
  private selected = 0;
  private starting = false;
  private cardHighlights: Phaser.GameObjects.Graphics[] = [];
  private buttonHighlights: Phaser.GameObjects.Graphics[] = [];

  constructor() {
    super('MapSelect');
  }

  create(): void {
    fitCamera(this);
    this.options = MAPS.flatMap((map) => DIFFICULTY_IDS.map((difficulty) => ({ map, difficulty })));
    this.selected = 0;
    this.starting = false;
    this.cardHighlights = [];
    this.buttonHighlights = [];
    const W = GAME_W;

    drawMenuBackground(this);
    addMenuHeader(this, 'ELIGE UN MAPA', () => this.back());
    addMenuFooter(this, [
      ['FLECHAS', 'Elegir'],
      ['ENTER', 'Jugar'],
      ['ESC', 'Volver'],
    ]);

    const cardW = Math.min(420, (W - 2 * PAD - CARD_GAP * (MAPS.length - 1)) / MAPS.length);
    const totalW = cardW * MAPS.length + CARD_GAP * (MAPS.length - 1);
    MAPS.forEach((def, i) => this.addCard(def, i, (W - totalW) / 2 + i * (cardW + CARD_GAP), CARD_Y, cardW));
    this.refreshHighlight();

    this.input.setDefaultCursor(POKEBALL_CURSOR);
    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-LEFT', () => this.move(-1));
    keyboard?.on('keydown-RIGHT', () => this.move(1));
    keyboard?.on('keydown-ENTER', () => this.play(this.options[this.selected]));
    keyboard?.on('keydown-ESC', () => this.back());
    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  private addCard(def: MapDef, mapIndex: number, x: number, y: number, w: number): void {
    const previewW = w - 2 * PAD;
    const previewH = (previewW * MAP_H) / MAP_W;
    const previewBottom = y + PAD + previewH;
    const cardH = PAD + previewH + 112;

    const highlight = this.add.graphics();
    highlight.lineStyle(4, 0xffcb05).strokeRoundedRect(x - 4, y - 4, w + 8, cardH + 8, 10);
    this.cardHighlights.push(highlight);
    drawPanel(this.add.graphics(), x, y, w, cardH);

    // Vista previa: la misma textura del mapa, reducida
    this.add.image(x + PAD, y + PAD, mapTextureKey(def.id)).setOrigin(0).setScale(previewW / MAP_W);
    this.add.text(x + PAD, previewBottom + 12, def.name, textStyle(16));

    // Un botón por dificultad, con su récord debajo
    const buttonW = (previewW - 12) / DIFFICULTY_IDS.length;
    DIFFICULTY_IDS.forEach((difficulty, j) => {
      const optionIndex = mapIndex * DIFFICULTY_IDS.length + j;
      const { label, startLives, startMoney } = DIFFICULTIES[difficulty];
      const bx = x + PAD + j * (buttonW + 12);
      const by = previewBottom + 40;

      const ring = this.add.graphics();
      ring.lineStyle(3, 0xffcb05).strokeRoundedRect(bx - 3, by - 3, buttonW + 6, BUTTON_H + 6, 8);
      this.buttonHighlights.push(ring);
      new Button(
        this,
        bx,
        by,
        buttonW,
        BUTTON_H,
        `${label}\n${startLives} VIDAS  $${startMoney}`,
        () => this.play(this.options[optionIndex]),
        { variant: BUTTON_VARIANTS[difficulty], onHover: () => this.select(optionIndex) },
      );

      const best = loadBestWave(def.id, difficulty);
      const done = best >= WAVES.length;
      const record = done ? '¡COMPLETADO!' : best > 0 ? `RECORD ${best}/${WAVES.length}` : 'SIN JUGAR';
      this.add
        .text(bx + buttonW / 2, by + BUTTON_H + 14, record, textStyle(8, done ? '#e0a000' : undefined))
        .setOrigin(0.5);
    });
  }

  private select(index: number): void {
    if (this.selected === index) return;
    this.selected = index;
    this.refreshHighlight();
  }

  private move(step: number): void {
    this.select((this.selected + step + this.options.length) % this.options.length);
    audio.play('click');
  }

  private refreshHighlight(): void {
    const mapIndex = Math.floor(this.selected / DIFFICULTY_IDS.length);
    this.cardHighlights.forEach((h, i) => h.setVisible(i === mapIndex));
    this.buttonHighlights.forEach((h, i) => h.setVisible(i === this.selected));
  }

  private play({ map, difficulty }: Option): void {
    if (this.starting) return;
    this.starting = true;
    audio.unlock();
    audio.play('evolve');
    this.cameras.main.flash(200, 255, 255, 255);
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
      this.scene.start('Game', { mapId: map.id, difficulty } satisfies GameSceneData),
    );
  }

  private back(): void {
    if (this.starting) return;
    this.scene.start('MainMenu');
  }
}
