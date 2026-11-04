import Phaser from 'phaser';
import { loadTextSpeed, type TextSpeed } from '../save';
import { drawPanel, textStyle } from './theme';

/** Milisegundos por letra según la opción VELOCIDAD DEL TEXTO */
export const LETTER_DELAY: Record<TextSpeed, number> = { slow: 40, medium: 18, fast: 5 };

/**
 * Cuadro de diálogo de los menús, como los de los juegos: el texto se escribe letra a letra (a la
 * velocidad elegida en OPCIONES) y al terminar parpadea una flecha roja.
 */
export class DialogBox {
  private readonly scene: Phaser.Scene;
  private readonly text: Phaser.GameObjects.Text;
  private readonly arrow: Phaser.GameObjects.Graphics;
  private typing: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number) {
    this.scene = scene;
    drawPanel(scene.add.graphics(), x, y, w, h);
    this.text = scene.add
      .text(x + 24, y + 20, '', { ...textStyle(8), wordWrap: { width: w - 72 } })
      .setLineSpacing(10);
    this.arrow = scene.add.graphics({ x: x + w - 32, y: y + h - 22 });
    this.arrow.fillStyle(0xe04040).fillTriangle(0, 0, 12, 0, 6, 7).setVisible(false);
    scene.tweens.add({ targets: this.arrow, y: this.arrow.y + 3, duration: 350, yoyo: true, repeat: -1 });
  }

  /** Escribe el texto letra a letra (corta lo que se estuviera escribiendo) */
  say(message: string): void {
    this.typing?.remove();
    this.text.setText('');
    this.arrow.setVisible(false);
    let shown = 0;
    this.typing = this.scene.time.addEvent({
      delay: LETTER_DELAY[loadTextSpeed()],
      repeat: Math.max(0, message.length - 1),
      callback: () => {
        shown++;
        this.text.setText(message.slice(0, shown));
        if (shown >= message.length) this.arrow.setVisible(true);
      },
    });
  }
}
