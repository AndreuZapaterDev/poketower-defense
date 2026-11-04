import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../config';
import { audio } from '../audio/Audio';
import { LETTER_DELAY } from '../ui/DialogBox';
import { loadTextSpeed, loadTrainerName, saveIntroSeen, saveTrainerName } from '../save';
import { POKEBALL_CURSOR, addMenuCursor, caps, drawPanel, fitCamera, textStyle } from '../ui/theme';

/** Imágenes de public/assets/intro */
export const INTRO_IMAGES = {
  'intro-bg': 'assets/intro/introbg.png',
  'intro-base': 'assets/intro/introbase.png',
  'intro-oak': 'assets/intro/introOak.png',
  'intro-boy': 'assets/intro/introBoy.png',
  'intro-marill': 'assets/intro/introMarill.png',
} as const;

/** Nombres que se ofrecen, como en los juegos; el último deja escribir uno */
const PRESET_NAMES = ['ROJO', 'ASH', 'JAIME'];
const OTHER_NAME = 'OTRO NOMBRE';
const MAX_NAME = 10;
/** Escala de los personajes y las plataformas (las imágenes son de GBA, pequeñas) */
const ART_SCALE = 1.6;
const DIALOG_H = 112;

/** Un paso del guion: una animación opcional (que avisa al acabar) y el texto que dice Oak */
interface Step {
  before?: (done: () => void) => void;
  text: () => string;
  /** Al terminar el texto, se elige el nombre del entrenador */
  askName?: boolean;
}

/**
 * Introducción al estilo de los juegos: el Profesor Oak da la bienvenida, enseña un Pokémon,
 * explica de qué va el juego y pregunta el nombre del entrenador. Sale sola la primera vez que
 * se pulsa empezar (luego se puede ver desde OPCIONES); con ESC se salta.
 */
export class IntroScene extends Phaser.Scene {
  private steps: Step[] = [];
  private stepIndex = -1;
  private name = '';
  /** Texto completo del mensaje actual y si aún se está escribiendo */
  private fullText = '';
  private typing: Phaser.Time.TimerEvent | null = null;
  private busy = false;
  private finished = false;
  private oak!: Phaser.GameObjects.Image;
  private boy!: Phaser.GameObjects.Image;
  private marill!: Phaser.GameObjects.Image;
  private oakBase!: Phaser.GameObjects.Image;
  private sideBase!: Phaser.GameObjects.Image;
  private text!: Phaser.GameObjects.Text;
  private arrow!: Phaser.GameObjects.Graphics;
  private nameMenu: Phaser.GameObjects.Container | null = null;
  private nameIndex = 0;
  private nameCursor: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('Intro');
  }

  create(): void {
    fitCamera(this);
    this.stepIndex = -1;
    this.name = loadTrainerName() || PRESET_NAMES[0];
    this.typing = null;
    this.busy = false;
    this.finished = false;
    this.nameMenu = null;
    this.nameCursor = null;
    const W = GAME_W;
    const H = GAME_H;
    const cx = W / 2;
    const groundY = Math.round(H * 0.6);

    // Fondo de la intro estirado a lo ancho (son franjas horizontales, no se nota)
    this.add.image(0, 0, 'intro-bg').setOrigin(0).setDisplaySize(W, H);
    this.oakBase = this.add.image(cx, groundY, 'intro-base').setScale(ART_SCALE * 1.3);
    this.sideBase = this.add.image(cx + 170, groundY, 'intro-base').setScale(ART_SCALE).setAlpha(0);
    this.oak = this.add.image(cx, groundY + 8, 'intro-oak').setOrigin(0.5, 1).setScale(ART_SCALE).setAlpha(0);
    this.boy = this.add.image(cx, groundY + 8, 'intro-boy').setOrigin(0.5, 1).setScale(ART_SCALE).setAlpha(0);
    this.marill = this.add.image(cx + 170, groundY + 6, 'intro-marill').setOrigin(0.5, 1).setScale(0);

    // Cuadro de texto grande, como en los juegos
    const dy = H - DIALOG_H - 12;
    drawPanel(this.add.graphics(), 12, dy, W - 24, DIALOG_H);
    this.text = this.add
      .text(36, dy + 22, '', { ...textStyle(16), wordWrap: { width: W - 120 } })
      .setLineSpacing(12);
    this.arrow = this.add.graphics({ x: W - 52, y: dy + DIALOG_H - 28 });
    this.arrow.fillStyle(0xe04040).fillTriangle(0, 0, 14, 0, 7, 8).setVisible(false);
    this.tweens.add({ targets: this.arrow, y: this.arrow.y + 4, duration: 320, yoyo: true, repeat: -1 });
    this.add
      .text(W - 16, 12, 'ESC: SALTAR', textStyle(8, '#406060', null))
      .setOrigin(1, 0)
      .setAlpha(0.8);

    this.steps = this.script();
    this.input.setDefaultCursor(POKEBALL_CURSOR);
    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (!over.length) this.advance();
    });
    const keyboard = this.input.keyboard;
    for (const key of ['ENTER', 'SPACE', 'Z']) keyboard?.on(`keydown-${key}`, () => this.advance());
    keyboard?.on('keydown-UP', () => this.moveName(-1));
    keyboard?.on('keydown-DOWN', () => this.moveName(1));
    keyboard?.on('keydown-ESC', () => this.finish());

    this.cameras.main.fadeIn(800, 0, 0, 0);
    this.time.delayedCall(500, () => this.next());
  }

  // ---------------------------------------------------------------- guion

  private script(): Step[] {
    const cx = GAME_W / 2;
    return [
      { before: (done) => this.fadeIn(this.oak, done), text: () => '¡Hola! ¡Perdona por la espera!' },
      { text: () => '¡Bienvenido al mundo de POKéTOWER DEFENSE!' },
      { text: () => 'Me llamo OAK, pero la gente me llama PROFESOR POKéMON.' },
      {
        before: (done) => this.showPokemon(done),
        text: () => 'Este mundo está habitado por unas criaturas llamadas POKéMON.',
      },
      { text: () => 'Últimamente, los POKéMON salvajes andan revueltos y recorren las rutas en manada...' },
      { text: () => 'Tu misión es colocar a tus POKéMON junto al camino para frenarlos antes de que lleguen al final.' },
      {
        text: () =>
          'Cada POKéMON ataca a su manera. ¡Fíjate en los tipos: el agua apaga el fuego y la planta puede con la roca!',
      },
      { text: () => 'Con cada POKéMON derrotado ganas dinero para traer más compañeros y hacerlos evolucionar.' },
      {
        text: () => 'Al terminar cada mapa ganas puntos: úsalos en MEJORAS y en las tiendas para conseguir más POKéMON.',
      },
      { text: () => 'Y si vences en los gimnasios, ¡conseguirás sus MEDALLAS!' },
      {
        before: (done) => this.showPlayer(done),
        text: () => 'Pero antes, háblame de ti. ¿Cómo te llamas?',
        askName: true,
      },
      { text: () => `¡Así que te llamas ${this.name}! Encantado.` },
      {
        before: (done) => {
          this.tweens.add({ targets: this.boy, x: cx, duration: 400, ease: 'Sine.easeInOut', onComplete: done });
        },
        text: () => `¡${this.name}! ¡Tu propia leyenda POKéMON está a punto de comenzar!`,
      },
      { text: () => '¡Te espera un mundo de sueños y aventuras con los POKéMON! ¡Adelante!' },
    ];
  }

  private fadeIn(target: Phaser.GameObjects.Image, done: () => void): void {
    this.tweens.add({ targets: target, alpha: 1, duration: 600, onComplete: done });
  }

  /** Oak se aparta, lanza una Poké Ball y sale Marill en la otra plataforma */
  private showPokemon(done: () => void): void {
    const cx = GAME_W / 2;
    this.tweens.add({ targets: [this.oak, this.oakBase], x: cx - 170, duration: 450, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: this.sideBase, alpha: 1, duration: 450 });
    this.time.delayedCall(500, () => {
      const target = { x: this.marill.x, y: this.marill.y - 40 };
      const ball = this.add.image(cx - 130, this.oak.y - 180, 'pokeball').setScale(2);
      audio.play('click');
      this.tweens.add({ targets: ball, x: target.x, duration: 500 });
      this.tweens.add({
        targets: ball,
        y: { from: ball.y, to: target.y },
        duration: 500,
        ease: 'Quad.easeIn',
        onComplete: () => {
          ball.destroy();
          this.cameras.main.flash(150, 255, 255, 255);
          audio.play('recall');
          this.marill.setTintFill(0xffffff);
          this.tweens.add({
            targets: this.marill,
            scale: ART_SCALE,
            duration: 300,
            ease: 'Back.easeOut',
            onComplete: () => {
              this.marill.clearTint();
              this.tweens.add({ targets: this.marill, y: this.marill.y - 10, duration: 160, yoyo: true, repeat: 1 });
              done();
            },
          });
        },
      });
    });
  }

  /** Marill vuelve a su Poké Ball, Oak se va y aparece el entrenador */
  private showPlayer(done: () => void): void {
    const cx = GAME_W / 2;
    this.marill.setTintFill(0xff6060);
    this.tweens.add({ targets: this.marill, scale: 0, duration: 300 });
    this.tweens.add({ targets: [this.oak, this.sideBase], alpha: 0, duration: 450 });
    this.tweens.add({ targets: this.oakBase, x: cx, duration: 450, delay: 300 });
    this.time.delayedCall(800, () => {
      this.boy.setX(cx);
      this.fadeIn(this.boy, done);
    });
  }

  // ---------------------------------------------------------------- texto

  private next(): void {
    this.stepIndex++;
    const step = this.steps[this.stepIndex];
    if (!step) {
      this.finish();
      return;
    }
    this.busy = true;
    const speak = () => {
      this.busy = false;
      this.say(step.text());
    };
    if (step.before) step.before(speak);
    else speak();
  }

  /** Escribe el mensaje letra a letra a la velocidad elegida en OPCIONES */
  private say(message: string): void {
    this.fullText = message;
    this.typing?.remove();
    this.text.setText('');
    this.arrow.setVisible(false);
    let shown = 0;
    this.typing = this.time.addEvent({
      delay: LETTER_DELAY[loadTextSpeed()],
      repeat: Math.max(0, message.length - 1),
      callback: () => {
        shown++;
        this.text.setText(message.slice(0, shown));
        if (shown >= message.length) this.onTextDone();
      },
    });
  }

  private onTextDone(): void {
    this.typing = null;
    if (this.steps[this.stepIndex]?.askName) this.openNameMenu();
    else this.arrow.setVisible(true);
  }

  /** Clic, ENTER o ESPACIO: completa el texto que se está escribiendo o pasa al siguiente */
  private advance(): void {
    if (this.finished || this.busy) return;
    if (this.nameMenu) {
      this.pickName(this.nameIndex);
      return;
    }
    if (this.typing) {
      this.typing.remove();
      this.text.setText(this.fullText);
      this.onTextDone();
      return;
    }
    audio.play('click');
    this.next();
  }

  // ---------------------------------------------------------------- nombre

  /** Lista de nombres, como en los juegos, a la derecha encima del cuadro de texto */
  private openNameMenu(): void {
    const options = [...PRESET_NAMES, OTHER_NAME];
    const w = 250;
    const rowH = 34;
    const h = options.length * rowH + 24;
    const x = GAME_W - w - 24;
    const y = GAME_H - DIALOG_H - 24 - h;
    const parts: Phaser.GameObjects.GameObject[] = [drawPanel(this.add.graphics(), 0, 0, w, h)];
    options.forEach((label, i) => {
      const ry = 12 + i * rowH + rowH / 2;
      parts.push(this.add.text(44, ry, label, textStyle(16)).setOrigin(0, 0.5));
      parts.push(
        this.add
          .zone(8, ry - rowH / 2, w - 16, rowH)
          .setOrigin(0)
          .setInteractive({ useHandCursor: true })
          .on('pointerover', () => this.setNameIndex(i))
          .on('pointerdown', () => this.pickName(i)),
      );
    });
    this.nameCursor = addMenuCursor(this);
    parts.push(this.nameCursor);
    this.nameMenu = this.add.container(x, y, parts);
    this.nameIndex = Math.max(0, PRESET_NAMES.indexOf(this.name));
    this.setNameIndex(this.nameIndex);
  }

  private setNameIndex(i: number): void {
    this.nameIndex = i;
    this.nameCursor?.setPosition(22, 12 + i * 34 + 17);
  }

  private moveName(step: number): void {
    if (!this.nameMenu) return;
    const count = PRESET_NAMES.length + 1;
    audio.play('click');
    this.setNameIndex((this.nameIndex + step + count) % count);
  }

  private pickName(i: number): void {
    let name = PRESET_NAMES[i];
    if (!name) {
      // Nombre propio: el cuadro del navegador funciona con teclado y en el móvil
      const typed = window.prompt('¿Cómo te llamas?', this.name) ?? '';
      name = caps(typed)
        .replace(/[^A-Z0-9 ]/g, '')
        .trim()
        .slice(0, MAX_NAME);
      if (!name) return;
    }
    this.name = name;
    saveTrainerName(name);
    audio.play('click');
    this.nameMenu?.destroy();
    this.nameMenu = null;
    this.nameCursor = null;
    this.next();
  }

  // ---------------------------------------------------------------- final

  /** El entrenador encoge (como en los juegos) y se pasa al menú; ESC salta aquí directamente */
  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    saveIntroSeen();
    if (!loadTrainerName()) saveTrainerName(this.name || PRESET_NAMES[0]);
    this.typing?.remove();
    this.tweens.add({ targets: this.boy, scale: ART_SCALE * 0.3, y: this.boy.y - 60, duration: 900, ease: 'Quad.easeIn' });
    this.cameras.main.fadeOut(1000, 255, 255, 255);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('MainMenu'));
  }
}
