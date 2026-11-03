import Phaser from 'phaser';
import { audio } from '../audio/Audio';
import { battleSprite } from '../data/sprites';
import { TOWERS } from '../data/towers';
import { TYPE_COLORS } from '../data/types';
import {
  INK,
  MENU_HEADER_H,
  POKEBALL_CURSOR,
  addMenuCursor,
  addMenuFooter,
  addMenuHeader,
  darken,
  drawMenuBackground,
  drawPanel,
  textStyle,
} from '../ui/theme';

type IconKind = 'play' | 'team' | 'user' | 'pokeshop' | 'itemshop' | 'options';

interface MenuItem {
  label: string;
  icon: IconKind;
  description: string;
  /** Pokémon de la tienda que se muestra al lado (id de TOWERS) */
  showcase: string;
  /** Escena a la que lleva; sin escena, la sección aún no existe */
  scene?: string;
}

const ITEMS: MenuItem[] = [
  {
    label: 'JUGAR',
    icon: 'play',
    showcase: 'charmander',
    scene: 'MapSelect',
    description: 'Elige un mapa y una dificultad, ¡y defiende el Centro Pokémon de los Pokémon salvajes!',
  },
  {
    label: 'EQUIPO',
    icon: 'team',
    showcase: 'bulbasaur',
    description: 'Prepara el equipo de Pokémon que llevarás a cada partida.',
  },
  {
    label: 'USUARIO',
    icon: 'user',
    showcase: 'squirtle',
    description: 'Tu ficha de entrenador: progreso, récords y cuenta.',
  },
  {
    label: 'TIENDA DE POKéMON',
    icon: 'pokeshop',
    showcase: 'growlithe',
    description: 'Consigue nuevos Pokémon para tu equipo.',
  },
  {
    label: 'TIENDA DE OBJETOS',
    icon: 'itemshop',
    showcase: 'mankey',
    description: 'Objetos que te ayudarán durante las partidas.',
  },
  {
    label: 'OPCIONES',
    icon: 'options',
    showcase: 'squirtle',
    scene: 'Options',
    description: 'Ajusta el volumen de la música y de los efectos.',
  },
];

const LIST_X = 40;
const LIST_Y = MENU_HEADER_H + 24;
const LIST_W = 480;
const ROW_H = 52;
const LIST_PAD = 14;
const DIALOG_H = 84;
/** Milisegundos por letra del texto del cuadro de diálogo */
const TYPE_SPEED = 18;

/** Menú general: punto de partida para jugar, el equipo, las tiendas y la cuenta */
export class MainMenuScene extends Phaser.Scene {
  private selected = 0;
  private leaving = false;
  private cursor!: Phaser.GameObjects.Container;
  private rowHighlight!: Phaser.GameObjects.Graphics;
  private showcase!: Phaser.GameObjects.Sprite;
  private platform!: Phaser.GameObjects.Graphics;
  private dialogText!: Phaser.GameObjects.Text;
  private dialogArrow!: Phaser.GameObjects.Graphics;
  private typing: Phaser.Time.TimerEvent | null = null;
  private pop: Phaser.Tweens.Tween | null = null;

  constructor() {
    super('MainMenu');
  }

  create(): void {
    this.selected = 0;
    this.leaving = false;
    this.typing = null;
    this.pop = null;
    const { width: W, height: H } = this.scale;

    drawMenuBackground(this);
    addMenuHeader(this, 'POKéTOWER DEFENSE');
    addMenuFooter(this, [
      ['FLECHAS', 'Elegir'],
      ['ENTER', 'Aceptar'],
      ['ESC', 'Salir'],
    ]);

    this.createList();
    this.createShowcase(LIST_X + LIST_W + 24, W - 40);
    this.createDialog(LIST_X, H - 40 - 16 - DIALOG_H, W - 2 * LIST_X);
    this.refresh(false);

    this.input.setDefaultCursor(POKEBALL_CURSOR);
    const keyboard = this.input.keyboard;
    for (const key of ['LEFT', 'UP']) keyboard?.on(`keydown-${key}`, () => this.move(-1));
    for (const key of ['RIGHT', 'DOWN']) keyboard?.on(`keydown-${key}`, () => this.move(1));
    keyboard?.on('keydown-ENTER', () => this.open(ITEMS[this.selected]));
    keyboard?.on('keydown-ESC', () => this.go('Title'));
    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  // ---------------------------------------------------------------- construcción

  private createList(): void {
    const h = LIST_PAD * 2 + ITEMS.length * ROW_H;
    drawPanel(this.add.graphics(), LIST_X, LIST_Y, LIST_W, h);
    this.rowHighlight = this.add.graphics();
    this.cursor = addMenuCursor(this);

    ITEMS.forEach((item, i) => {
      const y = this.rowY(i);
      const enabled = !!item.scene;
      drawMenuIcon(this.add.graphics(), item.icon, LIST_X + 52, y);
      this.add
        .text(LIST_X + 80, y, item.label, textStyle(16, enabled ? INK : '#909090'))
        .setOrigin(0, 0.5);
      if (!enabled) {
        // Etiqueta "PRONTO" para las secciones que aún no existen
        const tagBg = this.add.graphics();
        const tag = this.add.text(0, 0, 'PRONTO', textStyle(8, '#f8f8f8', null)).setOrigin(0.5);
        const tw = tag.width + 10;
        const tx = LIST_X + LIST_W - 20 - tw;
        tagBg.fillStyle(0x909090).fillRoundedRect(tx, y - 8, tw, 16, 4);
        tag.setPosition(tx + tw / 2, y);
      }
      this.add
        .zone(LIST_X + 8, y - ROW_H / 2, LIST_W - 16, ROW_H)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => this.select(i))
        .on('pointerdown', () => this.open(item));
    });
  }

  /** Pokémon de muestra sobre una plataforma del color de su tipo */
  private createShowcase(left: number, right: number): void {
    const cx = (left + right) / 2;
    const cy = LIST_Y + 250;
    this.platform = this.add.graphics({ x: cx, y: cy });
    this.add.image(cx, cy - 2, 'shadow').setScale(3, 1.4).setAlpha(0.25);
    this.showcase = this.add.sprite(cx, cy + 4, 'px').setOrigin(0.5, 1);
    this.tweens.add({ targets: this.showcase, y: cy - 4, duration: 600, yoyo: true, repeat: -1, ease: 'Quad.easeOut' });
  }

  private createDialog(x: number, y: number, w: number): void {
    drawPanel(this.add.graphics(), x, y, w, DIALOG_H);
    this.dialogText = this.add
      .text(x + 24, y + 22, '', { ...textStyle(8), wordWrap: { width: w - 72 } })
      .setLineSpacing(10);
    // Flecha roja que parpadea cuando el texto termina de escribirse
    this.dialogArrow = this.add.graphics({ x: x + w - 32, y: y + DIALOG_H - 24 });
    this.dialogArrow.fillStyle(0xe04040).fillTriangle(0, 0, 12, 0, 6, 7);
    this.tweens.add({ targets: this.dialogArrow, y: this.dialogArrow.y + 3, duration: 350, yoyo: true, repeat: -1 });
  }

  // ---------------------------------------------------------------- estado

  private rowY(i: number): number {
    return LIST_Y + LIST_PAD + i * ROW_H + ROW_H / 2;
  }

  private select(index: number): void {
    if (this.selected === index) return;
    this.selected = index;
    audio.play('click');
    this.refresh(true);
  }

  private move(step: number): void {
    this.select((this.selected + step + ITEMS.length) % ITEMS.length);
  }

  private refresh(animate: boolean): void {
    const item = ITEMS[this.selected];
    const y = this.rowY(this.selected);
    this.cursor.setPosition(LIST_X + 18, y);
    this.rowHighlight.clear().fillStyle(0xd8e8f8).fillRoundedRect(LIST_X + 8, y - ROW_H / 2 + 3, LIST_W - 16, ROW_H - 6, 6);

    // Pokémon de muestra y plataforma de su tipo
    const tower = TOWERS.find((t) => t.id === item.showcase) ?? TOWERS[0];
    const sprite = tower.stages[0].sprite;
    const look = battleSprite(sprite);
    const scale = 110 / look.size;
    this.pop?.stop();
    this.showcase.setTexture(look.texture).setScale(scale).setFlipX(true);
    this.showcase.play({ key: look.anim, startFrame: 0 });
    const color = TYPE_COLORS[tower.type];
    this.platform
      .clear()
      .fillStyle(darken(color, 35))
      .fillEllipse(0, 0, 200, 56)
      .fillStyle(color)
      .fillEllipse(0, -3, 184, 44)
      .fillStyle(0xffffff, 0.35)
      .fillEllipse(-20, -8, 100, 14);
    if (animate) {
      this.pop = this.tweens.add({ targets: this.showcase, scale: { from: 0, to: scale }, duration: 220, ease: 'Back.easeOut' });
    }

    this.typeText(item.scene ? item.description : `${item.description}\n¡Disponible próximamente!`);
  }

  /** Escribe el texto letra a letra, como los diálogos de los juegos */
  private typeText(text: string): void {
    this.typing?.remove();
    this.dialogText.setText('');
    this.dialogArrow.setVisible(false);
    let shown = 0;
    this.typing = this.time.addEvent({
      delay: TYPE_SPEED,
      repeat: text.length - 1,
      callback: () => {
        shown++;
        this.dialogText.setText(text.slice(0, shown));
        if (shown >= text.length) this.dialogArrow.setVisible(true);
      },
    });
  }

  private open(item: MenuItem): void {
    if (item.scene) {
      audio.play('click');
      this.go(item.scene);
    } else {
      audio.play('error');
      this.cameras.main.shake(120, 0.004);
    }
  }

  private go(scene: string): void {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(scene));
  }
}

/** Iconos sencillos de 24 px para cada opción del menú */
function drawMenuIcon(g: Phaser.GameObjects.Graphics, kind: IconKind, cx: number, cy: number): void {
  const ball = (x: number, y: number, r: number, top = 0xe04040) => {
    g.fillStyle(0x303030).fillCircle(x, y, r);
    g.fillStyle(0xf8f8f8).fillCircle(x, y, r - 1.5);
    g.fillStyle(top).slice(x, y, r - 1.5, Math.PI, 0, false).fillPath();
    g.fillStyle(0x303030).fillRect(x - r, y - 1, r * 2, 2).fillCircle(x, y, r * 0.35);
    g.fillStyle(0xf8f8f8).fillCircle(x, y, r * 0.18);
  };
  switch (kind) {
    case 'play':
      ball(cx, cy, 11);
      break;
    case 'team':
      ball(cx - 7, cy + 4, 7);
      ball(cx + 7, cy + 4, 7, 0x3c64c8);
      ball(cx, cy - 6, 7, 0x38a058);
      break;
    case 'user':
      // Ficha de entrenador
      g.fillStyle(0x303030).fillRoundedRect(cx - 12, cy - 9, 24, 18, 3);
      g.fillStyle(0xf8d878).fillRoundedRect(cx - 11, cy - 8, 22, 16, 2);
      g.fillStyle(0x3c64c8).fillCircle(cx - 5, cy - 1, 4).fillRect(cx - 9, cy + 3, 8, 4);
      g.fillStyle(0x806030).fillRect(cx + 1, cy - 4, 8, 2).fillRect(cx + 1, cy, 6, 2);
      break;
    case 'pokeshop':
      ball(cx - 3, cy + 1, 10);
      g.fillStyle(0x303030).fillCircle(cx + 7, cy - 6, 6);
      g.fillStyle(0xf8c838).fillCircle(cx + 7, cy - 6, 5);
      g.fillStyle(0x806010).fillRect(cx + 6, cy - 9, 2, 6);
      break;
    case 'itemshop':
      // Mochila
      g.fillStyle(0x303030).fillRoundedRect(cx - 10, cy - 8, 20, 20, 5);
      g.fillStyle(0xd88838).fillRoundedRect(cx - 9, cy - 7, 18, 18, 4);
      g.fillStyle(0xb06820).fillRect(cx - 9, cy - 1, 18, 3);
      g.fillStyle(0x303030).fillRect(cx - 5, cy - 12, 10, 3).fillRect(cx - 5, cy - 12, 2, 6).fillRect(cx + 3, cy - 12, 2, 6);
      g.fillStyle(0xf8c838).fillRect(cx - 2, cy, 4, 4);
      break;
    case 'options':
      // Engranaje
      g.fillStyle(0x303030);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.fillCircle(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9, 3.5);
      }
      g.fillStyle(0x303030).fillCircle(cx, cy, 9);
      g.fillStyle(0x9098a8).fillCircle(cx, cy, 7.5);
      g.fillStyle(0x303030).fillCircle(cx, cy, 3);
      break;
  }
}
