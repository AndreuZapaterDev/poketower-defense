import Phaser from 'phaser';
import { MAP_H, MAP_W } from '../config';
import { loadTextSpeed } from '../save';
import { LETTER_DELAY } from './DialogBox';
import { drawPanel, textStyle } from './theme';

const MAX_QUEUE = 3;
const HOLD_TIME = 1600;
// Si hay mensajes esperando se escribe más rápido y se pasa antes, para no ir con retraso
const RUSH_CHAR_DELAY = 8;
const RUSH_HOLD_TIME = 500;

/** Cuadro de diálogo inferior con efecto máquina de escribir */
export class MessageBox {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly text: Phaser.GameObjects.Text;
  private readonly arrow: Phaser.GameObjects.Text;
  private queue: string[] = [];
  private busy = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const w = MAP_W - 16;
    const h = 62;
    const g = drawPanel(scene.add.graphics(), 0, 0, w, h);
    this.text = scene.add
      .text(16, 14, '', { ...textStyle(16), wordWrap: { width: w - 40 } })
      .setLineSpacing(8);
    this.arrow = scene.add.text(w - 24, h - 24, '▼', textStyle(8, '#e04040', '#f0c0c0')).setVisible(false);
    scene.tweens.add({ targets: this.arrow, y: '+=3', duration: 300, yoyo: true, repeat: -1 });
    this.container = scene.add.container(8, MAP_H - h - 6, [g, this.text, this.arrow]).setDepth(150).setVisible(false);
  }

  show(message: string): void {
    this.queue.push(message);
    if (this.queue.length > MAX_QUEUE) this.queue.shift();
    if (!this.busy) this.next();
  }

  private next(): void {
    const message = this.queue.shift();
    if (message === undefined) {
      this.busy = false;
      this.container.setVisible(false);
      return;
    }
    this.busy = true;
    this.container.setVisible(true);
    this.arrow.setVisible(false);
    this.text.setText('');

    let shown = 0;
    const rush = () => this.queue.length > 0;
    this.scene.time.addEvent({
      // Velocidad elegida en OPCIONES (VELOC. TEXTO); si hay mensajes esperando, más deprisa
      delay: rush() ? Math.min(RUSH_CHAR_DELAY, LETTER_DELAY[loadTextSpeed()]) : LETTER_DELAY[loadTextSpeed()],
      repeat: message.length - 1,
      callback: () => {
        shown++;
        this.text.setText(message.slice(0, shown));
        if (shown < message.length) return;
        this.arrow.setVisible(true);
        this.scene.time.delayedCall(rush() ? RUSH_HOLD_TIME : HOLD_TIME, () => this.next());
      },
    });
  }
}
