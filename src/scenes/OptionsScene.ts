import Phaser from 'phaser';
import { audio } from '../audio/Audio';
import type { VolumeChannel } from '../save';
import { VolumeSlider } from '../ui/VolumeSlider';
import {
  POKEBALL_CURSOR,
  addMenuCursor,
  addMenuFooter,
  addMenuHeader,
  drawMenuBackground,
  drawPanel,
  textStyle,
} from '../ui/theme';

const PANEL_W = 700;
const PANEL_H = 220;
const ROW_GAP = 72;

interface VolumeRow {
  channel: VolumeChannel;
  label: string;
  hint: string;
}

const ROWS: VolumeRow[] = [
  { channel: 'music', label: 'MUSICA', hint: 'Melodía de fondo' },
  { channel: 'sfx', label: 'EFECTOS', hint: 'Ataques, KO, victoria...' },
];

/** Opciones del juego: por ahora, el volumen de la música y el de los efectos por separado */
export class OptionsScene extends Phaser.Scene {
  private selected = 0;
  private sliders: VolumeSlider[] = [];
  private highlight!: Phaser.GameObjects.Graphics;
  private cursor!: Phaser.GameObjects.Container;
  private panelPos = { x: 0, y: 0 };

  constructor() {
    super('Options');
  }

  create(): void {
    this.selected = 0;
    this.sliders = [];
    const { width: W, height: H } = this.scale;

    drawMenuBackground(this);
    addMenuHeader(this, 'OPCIONES', () => this.back());
    addMenuFooter(this, [
      ['ARRIBA/ABAJO', 'Elegir'],
      ['IZQ/DCHA', 'Ajustar'],
      ['ESC', 'Volver'],
    ]);

    const px = (W - PANEL_W) / 2;
    const py = (H - PANEL_H) / 2;
    drawPanel(this.add.graphics(), px, py, PANEL_W, PANEL_H);
    this.add.text(px + 32, py + 24, 'SONIDO', textStyle(8, '#e04040'));
    this.highlight = this.add.graphics();
    this.cursor = addMenuCursor(this);
    ROWS.forEach((row, i) => {
      const y = this.rowY(py, i);
      this.add.text(px + 48, y - 6, row.label, textStyle(16)).setOrigin(0, 0.5);
      this.add.text(px + 48, y + 16, row.hint, textStyle(8)).setOrigin(0, 0.5);
      this.sliders.push(
        new VolumeSlider(this, px + 276, y - VolumeSlider.height / 2, row.channel, { onHover: () => this.select(i) }),
      );
    });
    this.panelPos = { x: px, y: py };
    this.refreshHighlight();

    this.input.setDefaultCursor(POKEBALL_CURSOR);
    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-UP', () => this.select((this.selected + ROWS.length - 1) % ROWS.length));
    keyboard?.on('keydown-DOWN', () => this.select((this.selected + 1) % ROWS.length));
    keyboard?.on('keydown-LEFT', () => this.sliders[this.selected].change(-1));
    keyboard?.on('keydown-RIGHT', () => this.sliders[this.selected].change(1));
    keyboard?.on('keydown-ESC', () => this.back());

    // Se oye la música mientras se ajusta; al salir se para, como en el resto de menús
    audio.unlock();
    audio.setBattle(false);
    audio.startMusic();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audio.stopMusic());
    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  private select(index: number): void {
    if (this.selected === index) return;
    this.selected = index;
    this.refreshHighlight();
  }

  private rowY(panelY: number, i: number): number {
    return panelY + 76 + i * ROW_GAP;
  }

  private refreshHighlight(): void {
    const { x, y: py } = this.panelPos;
    const y = this.rowY(py, this.selected);
    this.cursor.setPosition(x + 24, y - 6);
    this.highlight.clear().fillStyle(0xd8e8f8).fillRoundedRect(x + 12, y - 30, PANEL_W - 24, 60, 6);
  }

  private back(): void {
    this.scene.start('MainMenu');
  }
}
