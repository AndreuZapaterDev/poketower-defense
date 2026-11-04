import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../config';
import { audio } from '../audio/Audio';
import { TEXT_SPEEDS, loadTextSpeed, saveTextSpeed, type TextSpeed, type VolumeChannel } from '../save';
import { DialogBox } from '../ui/DialogBox';
import { VolumeSlider } from '../ui/VolumeSlider';
import {
  MENU_FOOTER_H,
  MENU_HEADER_H,
  POKEBALL_CURSOR,
  addMenuCursor,
  addMenuFooter,
  addMenuHeader,
  drawMenuBackground,
  drawPanel,
  fitCamera,
  textStyle,
} from '../ui/theme';

const PANEL_W = 760;
const ROW_H = 60;
const LABEL_X = 92;
const DIALOG_H = 72;
const CHOSEN = '#e04040';
const NOT_CHOSEN = '#a0a0a8';

type RowIcon = 'text' | 'music' | 'sfx' | 'mute' | 'intro';

/**
 * Fila de opciones: un volumen (con `channel`), una elección entre varias (`choices`) o un
 * acceso a otra pantalla (`scene`, con el botón VER)
 */
interface OptionRow {
  icon: RowIcon;
  label: string;
  /** Lo que explica el cuadro de diálogo al elegir la fila */
  help: string;
  channel?: VolumeChannel;
  choices?: { labels: string[]; get(): number; set(index: number): void };
  scene?: string;
}

const TEXT_SPEED_LABELS: Record<TextSpeed, string> = { slow: 'LENTA', medium: 'MEDIA', fast: 'RAPIDA' };

const ROWS: OptionRow[] = [
  {
    icon: 'text',
    label: 'VELOC. TEXTO',
    help: 'Así de rápido se escriben los textos de los cuadros de diálogo, en los menús y en la partida.',
    choices: {
      labels: TEXT_SPEEDS.map((s) => TEXT_SPEED_LABELS[s]),
      get: () => TEXT_SPEEDS.indexOf(loadTextSpeed()),
      set: (i) => saveTextSpeed(TEXT_SPEEDS[i]),
    },
  },
  { icon: 'music', label: 'MUSICA', help: 'Volumen de la melodía de fondo.', channel: 'music' },
  { icon: 'sfx', label: 'EFECTOS', help: 'Volumen de los ataques, los KO, la victoria...', channel: 'sfx' },
  {
    icon: 'mute',
    label: 'SONIDO',
    help: 'Apaga o enciende todo el sonido de golpe (en la partida, también con la tecla M).',
    choices: {
      labels: ['ACTIVADO', 'SILENCIO'],
      get: () => (audio.isMuted ? 1 : 0),
      set: (i) => {
        if ((i === 1) !== audio.isMuted) audio.toggleMute();
      },
    },
  },
  {
    icon: 'intro',
    label: 'INTRODUCCION',
    help: 'Vuelve a ver la presentación del Profesor Oak, que explica de qué va el juego.',
    scene: 'Intro',
  },
];

/** Opciones del juego, al estilo del menú de opciones de los juegos: cada fila con su valor */
export class OptionsScene extends Phaser.Scene {
  private selected = 0;
  private sliders: (VolumeSlider | null)[] = [];
  /** Textos de cada valor de las filas de elección (null en las de volumen) */
  private choiceTexts: (Phaser.GameObjects.Text[] | null)[] = [];
  private highlight!: Phaser.GameObjects.Graphics;
  private cursor!: Phaser.GameObjects.Container;
  private dialog!: DialogBox;
  private panel = { x: 0, y: 0 };

  constructor() {
    super('Options');
  }

  create(): void {
    fitCamera(this);
    this.selected = 0;
    this.sliders = [];
    this.choiceTexts = [];
    const W = GAME_W;
    const H = GAME_H;

    drawMenuBackground(this);
    addMenuHeader(this, 'OPCIONES', () => this.back());
    addMenuFooter(this, [
      ['ARRIBA/ABAJO', 'Elegir'],
      ['IZQ/DCHA', 'Cambiar'],
      ['ESC', 'Volver'],
    ]);

    const dialogY = H - MENU_FOOTER_H - 12 - DIALOG_H;
    const panelH = ROWS.length * ROW_H + 28;
    const px = (W - PANEL_W) / 2;
    const py = MENU_HEADER_H + Math.max(12, (dialogY - MENU_HEADER_H - panelH) / 2);
    this.panel = { x: px, y: py };
    drawPanel(this.add.graphics(), px, py, PANEL_W, panelH);
    this.highlight = this.add.graphics();
    this.cursor = addMenuCursor(this);

    ROWS.forEach((row, i) => {
      const y = this.rowY(i);
      drawOptionIcon(this.add.graphics({ x: px + 62, y }), row.icon);
      this.add.text(px + LABEL_X, y, row.label, textStyle(16)).setOrigin(0, 0.5);
      this.add
        .zone(px + 8, y - ROW_H / 2, PANEL_W - 16, ROW_H)
        .setOrigin(0)
        .setInteractive()
        .on('pointerover', () => this.select(i));
      const right = px + PANEL_W - 36;
      if (row.channel) {
        this.choiceTexts.push(null);
        this.sliders.push(
          new VolumeSlider(this, right - VolumeSlider.width(), y - VolumeSlider.height / 2, row.channel, {
            onHover: () => this.select(i),
          }),
        );
      } else if (row.choices) {
        this.sliders.push(null);
        this.choiceTexts.push(this.addChoices(row, i, right, y));
      } else if (row.scene) {
        this.sliders.push(null);
        this.choiceTexts.push(null);
        const scene = row.scene;
        this.add
          .text(right, y, 'VER >', textStyle(16, CHOSEN))
          .setOrigin(1, 0.5)
          .setInteractive({ useHandCursor: true })
          .on('pointerdown', () => this.openScene(scene));
      }
    });

    this.dialog = new DialogBox(this, px, dialogY, PANEL_W, DIALOG_H);
    this.refresh();
    this.dialog.say(ROWS[0].help);

    this.input.setDefaultCursor(POKEBALL_CURSOR);
    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-UP', () => this.select((this.selected + ROWS.length - 1) % ROWS.length));
    keyboard?.on('keydown-DOWN', () => this.select((this.selected + 1) % ROWS.length));
    keyboard?.on('keydown-LEFT', () => this.adjust(-1));
    keyboard?.on('keydown-RIGHT', () => this.adjust(1));
    keyboard?.on('keydown-ENTER', () => {
      const scene = ROWS[this.selected].scene;
      if (scene) this.openScene(scene);
    });
    keyboard?.on('keydown-ESC', () => this.back());

    // Se oye la música mientras se ajusta; al salir se para, como en el resto de menús
    audio.unlock();
    audio.setBattle(false);
    audio.startMusic();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audio.stopMusic());
    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  /** Valores de una fila de elección, alineados a la derecha; se pulsan para elegirlos */
  private addChoices(row: OptionRow, rowIndex: number, right: number, y: number): Phaser.GameObjects.Text[] {
    const labels = row.choices!.labels;
    const texts: Phaser.GameObjects.Text[] = [];
    let x = right;
    for (let i = labels.length - 1; i >= 0; i--) {
      const text = this.add.text(x, y, labels[i], textStyle(16, NOT_CHOSEN)).setOrigin(1, 0.5);
      text.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.select(rowIndex);
        this.choose(rowIndex, i);
      });
      texts.unshift(text);
      x -= text.width + 28;
    }
    return texts;
  }

  private rowY(i: number): number {
    return this.panel.y + 14 + ROW_H / 2 + i * ROW_H;
  }

  private openScene(scene: string): void {
    audio.play('click');
    this.scene.start(scene);
  }

  /** Flechas en la fila elegida: cambian el volumen o pasan al valor de al lado */
  private adjust(step: number): void {
    const row = ROWS[this.selected];
    if (row.scene) {
      if (step > 0) this.openScene(row.scene);
      return;
    }
    const slider = this.sliders[this.selected];
    if (slider) {
      slider.change(step);
      return;
    }
    if (!row.choices) return;
    const next = Phaser.Math.Clamp(row.choices.get() + step, 0, row.choices.labels.length - 1);
    this.choose(this.selected, next);
  }

  private choose(rowIndex: number, choice: number): void {
    const row = ROWS[rowIndex];
    if (!row.choices || row.choices.get() === choice) return;
    row.choices.set(choice);
    audio.play('click');
    this.refresh();
    // Con la nueva velocidad, el ejemplo se escribe otra vez para que se note
    this.dialog.say(row.help);
  }

  private select(index: number): void {
    if (this.selected === index) return;
    this.selected = index;
    this.refresh();
    this.dialog.say(ROWS[index].help);
  }

  private refresh(): void {
    const { x } = this.panel;
    const y = this.rowY(this.selected);
    this.cursor.setPosition(x + 22, y);
    this.highlight.clear().fillStyle(0xd8e8f8).fillRoundedRect(x + 10, y - ROW_H / 2 + 4, PANEL_W - 20, ROW_H - 8, 6);
    ROWS.forEach((row, i) => {
      const texts = this.choiceTexts[i];
      if (!texts || !row.choices) return;
      const chosen = row.choices.get();
      texts.forEach((t, j) => t.setColor(j === chosen ? CHOSEN : NOT_CHOSEN));
    });
  }

  private back(): void {
    this.scene.start('MainMenu');
  }
}

/** Iconos de 24 px de cada fila: bocadillo de texto, nota musical, altavoz y altavoz tachado */
function drawOptionIcon(g: Phaser.GameObjects.Graphics, icon: RowIcon): void {
  const ink = 0x404858;
  if (icon === 'text') {
    g.fillStyle(ink).fillRoundedRect(-13, -10, 26, 18, 4).fillTriangle(-6, 7, 0, 7, -8, 13);
    g.fillStyle(0xf8f8f8).fillRoundedRect(-11, -8, 22, 14, 3);
    g.fillStyle(ink).fillRect(-7, -4, 14, 2).fillRect(-7, 0, 9, 2);
    return;
  }
  if (icon === 'intro') {
    // Poké Ball
    g.fillStyle(ink).fillCircle(0, 0, 12);
    g.fillStyle(0xe04040).slice(0, 0, 10, Math.PI, 0, false).fillPath();
    g.fillStyle(0xf8f8f8).slice(0, 0, 10, 0, Math.PI, false).fillPath();
    g.fillStyle(ink).fillRect(-10, -1, 20, 3).fillCircle(0, 0, 4);
    g.fillStyle(0xf8f8f8).fillCircle(0, 0, 2);
    return;
  }
  if (icon === 'music') {
    g.fillStyle(ink).fillEllipse(-6, 8, 10, 8).fillEllipse(8, 5, 10, 8);
    g.fillRect(-2, -10, 3, 18).fillRect(12, -13, 3, 18);
    g.fillRect(-2, -12, 17, 4);
    return;
  }
  // Altavoz
  g.fillStyle(ink).fillRect(-12, -5, 7, 10).fillTriangle(-6, -5, 4, -12, 4, 12).fillTriangle(-6, 5, 4, -12, 4, 12);
  if (icon === 'sfx') {
    g.lineStyle(3, ink);
    g.beginPath().arc(4, 0, 7, -0.9, 0.9).strokePath();
    g.beginPath().arc(4, 0, 13, -0.9, 0.9).strokePath();
  } else {
    g.lineStyle(3, 0xd03030).lineBetween(8, -7, 18, 7).lineBetween(18, -7, 8, 7);
  }
}
