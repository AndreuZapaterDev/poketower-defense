import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../config';
import { audio } from '../audio/Audio';
import { DIFFICULTIES, DIFFICULTY_IDS, MAPS, mapById } from '../data/map';
import { TOWERS } from '../data/towers';
import { currentTeam, isCompleted, isMapCompleted, ownedPokemon } from '../progress';
import { exportAccount, loadBestWave, loadDevUnlockAll, loadPoints, loadTrainerName, saveDevUnlockAll } from '../save';
import { Button } from '../ui/Button';
import { loadSavedGame } from '../savedGame';
import { BADGES, type BadgeDef } from '../data/badges';
import { iconAnim, iconKey } from '../data/sprites';
import { DialogBox } from '../ui/DialogBox';
import {
  INK,
  WHITE,
  MENU_HEADER_H,
  POKEBALL_CURSOR,
  addMenuCursor,
  addMenuFooter,
  addMenuHeader,
  drawMenuBackground,
  drawPanel,
  textStyle,
  fitCamera,
} from '../ui/theme';

type IconKind = 'play' | 'team' | 'upgrades' | 'pokeshop' | 'itemshop' | 'options' | 'save';

interface MenuItem {
  label: string;
  icon: IconKind;
  description: string;
  /** Escena a la que lleva; sin escena ni acción, la sección aún no existe */
  scene?: string;
  /** Acción que se ejecuta en el propio menú, sin cambiar de escena */
  action?: 'saveAccount';
}

const ITEMS: MenuItem[] = [
  {
    label: 'JUGAR',
    icon: 'play',
    scene: 'MapSelect',
    description: 'Elige un mapa y una dificultad, ¡y no dejes pasar a los Pokémon salvajes!',
  },
  {
    label: 'EQUIPO',
    icon: 'team',
    scene: 'Team',
    description: 'Elige en el PC qué Pokémon llevas a las partidas: solo esos saldrán en la tienda.',
  },
  {
    label: 'MEJORAS',
    icon: 'upgrades',
    scene: 'Upgrades',
    description: 'Gasta los puntos que ganas jugando en mejoras para todas las partidas.',
  },
  {
    label: 'TIENDA DE POKéMON',
    icon: 'pokeshop',
    scene: 'PokemonShop',
    description: 'Consigue nuevos Pokémon con tus puntos. Solo puedes usar en las partidas los que tengas.',
  },
  {
    label: 'TIENDA DE OBJETOS',
    icon: 'itemshop',
    scene: 'ItemShop',
    description: 'Compra Tablas con tus puntos: potencian a tus Pokémon de su tipo en todas las partidas.',
  },
  {
    label: 'OPCIONES',
    icon: 'options',
    scene: 'Options',
    description: 'Ajusta el volumen de la música y de los efectos.',
  },
  {
    label: 'GUARDAR CUENTA',
    icon: 'save',
    action: 'saveAccount',
    description: 'Descarga un archivo con el estado de tu cuenta: récords y opciones.',
  },
];

const LIST_X = 40;
const LIST_Y = MENU_HEADER_H + 24;
const LIST_W = 480;
const ROW_H = 44;
const LIST_PAD = 14;
const DIALOG_H = 84;

/** Menú general: punto de partida para jugar, el equipo, las tiendas y la cuenta */
export class MainMenuScene extends Phaser.Scene {
  private selected = 0;
  private leaving = false;
  private cursor!: Phaser.GameObjects.Container;
  private rowHighlight!: Phaser.GameObjects.Graphics;
  private dialog!: DialogBox;

  constructor() {
    super('MainMenu');
  }

  create(): void {
    fitCamera(this);
    this.selected = 0;
    this.leaving = false;
    const W = GAME_W;
    const H = GAME_H;

    drawMenuBackground(this);
    addMenuHeader(this, 'POKéTOWER DEFENSE');
    if (import.meta.env.DEV) this.addDevUnlockButton();
    addMenuFooter(this, [
      ['FLECHAS', 'Elegir'],
      ['ENTER', 'Aceptar'],
      ['ESC', 'Salir'],
    ]);

    this.createList();
    this.createTrainerCard(LIST_X + LIST_W + 24, LIST_Y, W - 40 - (LIST_X + LIST_W + 24), this.listHeight());
    this.dialog = new DialogBox(this, LIST_X, H - 40 - 16 - DIALOG_H, W - 2 * LIST_X, DIALOG_H);
    this.refresh();

    this.input.setDefaultCursor(POKEBALL_CURSOR);
    const keyboard = this.input.keyboard;
    for (const key of ['LEFT', 'UP']) keyboard?.on(`keydown-${key}`, () => this.move(-1));
    for (const key of ['RIGHT', 'DOWN']) keyboard?.on(`keydown-${key}`, () => this.move(1));
    keyboard?.on('keydown-ENTER', () => this.open(ITEMS[this.selected]));
    keyboard?.on('keydown-ESC', () => this.go('Title'));
    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  // ---------------------------------------------------------------- construcción

  private listHeight(): number {
    return LIST_PAD * 2 + ITEMS.length * ROW_H;
  }

  private createList(): void {
    const h = this.listHeight();
    drawPanel(this.add.graphics(), LIST_X, LIST_Y, LIST_W, h);
    this.rowHighlight = this.add.graphics();
    this.cursor = addMenuCursor(this);

    ITEMS.forEach((item, i) => {
      const y = this.rowY(i);
      const enabled = !!(item.scene || item.action);
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

  /**
   * Ficha de entrenador, como la de los juegos: tus puntos, los Pokémon que tienes, los mapas
   * superados, tu mejor oleada, el equipo que llevas y las medallas de los gimnasios
   */
  private createTrainerCard(x: number, y: number, w: number, h: number): void {
    drawPanel(this.add.graphics(), x, y, w, h);
    const g = this.add.graphics();
    // Tarjeta azul con franjas, como la ficha de entrenador
    g.fillStyle(0x305890).fillRoundedRect(x + 10, y + 10, w - 20, h - 20, 10);
    g.fillStyle(0x6898e0).fillRoundedRect(x + 12, y + 12, w - 24, h - 24, 9);
    for (let sy = y + 50; sy < y + h - 80; sy += 16) g.fillStyle(0x78a8e8).fillRect(x + 12, sy, w - 24, 8);
    g.fillStyle(0x305890).fillRect(x + 12, y + 42, w - 24, 3);
    this.add.text(x + 26, y + 28, 'FICHA DE ENTRENADOR', textStyle(16, WHITE, '#203860')).setOrigin(0, 0.5);
    this.add.image(x + w - 34, y + 28, 'pokeball').setScale(1.6);

    // Datos
    const options = MAPS.flatMap((def) => DIFFICULTY_IDS.map((d) => [def.id, d] as const));
    const done = options.filter(([id, d]) => isCompleted(id, d)).length;
    const best = Math.max(0, ...options.map(([id, d]) => loadBestWave(id, d)));
    const rows: [string, string][] = [
      ['NOMBRE', loadTrainerName() || '-'],
      ['PUNTOS', String(loadPoints())],
      ['POKéMON', `${ownedPokemon().size}/${TOWERS.length}`],
      ['MAPAS SUPERADOS', `${done}/${options.length}`],
      ['MEJOR OLEADA', best ? String(best) : '-'],
    ];
    rows.forEach(([label, value], i) => {
      const ry = y + 58 + i * 18;
      this.add.text(x + 26, ry, label, textStyle(8, WHITE, '#203860')).setOrigin(0, 0.5);
      this.add.text(x + w - 26, ry, value, textStyle(8, '#fff0a0', '#203860')).setOrigin(1, 0.5);
    });

    // Equipo actual
    const teamY = y + 158;
    this.add.text(x + 26, teamY, 'EQUIPO', textStyle(8, WHITE, '#203860')).setOrigin(0, 0.5);
    currentTeam().forEach((id, i) => {
      const def = TOWERS.find((t) => t.id === id);
      if (!def) return;
      const icon = this.add.sprite(x + 104 + i * 44, teamY - 2, iconKey(def.stages[0].sprite)).setScale(0.6);
      icon.play({ key: iconAnim(def.stages[0].sprite), startFrame: i % 2 });
    });

    // Medallas: una por gimnasio completado; las demás, hueco vacío
    const stripY = y + h - 74;
    g.fillStyle(0x203860).fillRoundedRect(x + 20, stripY, w - 40, 54, 8);
    this.add.text(x + 32, stripY + 12, 'MEDALLAS', textStyle(8, WHITE, null)).setOrigin(0, 0.5);
    const step = (w - 64) / BADGES.length;
    BADGES.forEach((badge, i) => {
      const bx = x + 32 + step * (i + 0.5);
      const by = stripY + 34;
      const earned = !!badge.mapId && isMapCompleted(badge.mapId);
      drawBadge(g, bx, by, earned ? badge : null);
    });
  }

  /**
   * Solo en desarrollo (npm run dev): interruptor en la cabecera para abrir todos los mapas sin
   * tener que completarlos. No cambia los récords; al apagarlo vuelven los desbloqueos normales.
   */
  private addDevUnlockButton(): void {
    const label = () => (loadDevUnlockAll() ? 'DEV: MAPAS\nABIERTOS' : 'DEV: ABRIR\nTODOS MAPAS');
    const button = new Button(this, 16, 12, 136, 36, label(), () => {
      saveDevUnlockAll(!loadDevUnlockAll());
      button.setText(label()).setVariant(loadDevUnlockAll() ? 'green' : 'gray');
    }, { variant: loadDevUnlockAll() ? 'green' : 'gray' });
    button.setDepth(45);
  }

  // ---------------------------------------------------------------- estado

  private rowY(i: number): number {
    return LIST_Y + LIST_PAD + i * ROW_H + ROW_H / 2;
  }

  private select(index: number): void {
    if (this.selected === index) return;
    this.selected = index;
    audio.play('click');
    this.refresh();
  }

  private move(step: number): void {
    this.select((this.selected + step + ITEMS.length) % ITEMS.length);
  }

  private refresh(): void {
    const item = ITEMS[this.selected];
    const y = this.rowY(this.selected);
    this.cursor.setPosition(LIST_X + 18, y);
    this.rowHighlight.clear().fillStyle(0xd8e8f8).fillRoundedRect(LIST_X + 8, y - ROW_H / 2 + 3, LIST_W - 16, ROW_H - 6, 6);

    let text = item.scene || item.action ? item.description : `${item.description}\n¡Disponible próximamente!`;
    // Recuerda la partida guardada al pasar por JUGAR
    const saved = item.scene === 'MapSelect' ? loadSavedGame() : null;
    if (saved) {
      const where = `${mapById(saved.mapId).name} - ${DIFFICULTIES[saved.difficulty].label}`;
      text = `Tienes una partida guardada en ${where} (oleada ${saved.waveIndex + 2}). ¡Elígela para continuar!`;
    }
    this.typeText(text);
  }

  /** Escribe en el cuadro de diálogo, letra a letra */
  private typeText(text: string): void {
    this.dialog.say(text);
  }

  private open(item: MenuItem): void {
    if (item.scene) {
      audio.play('click');
      this.go(item.scene);
    } else if (item.action === 'saveAccount') {
      const saved = exportAccount();
      audio.play(saved ? 'click' : 'error');
      this.typeText(saved ? '¡Cuenta guardada! Revisa tus descargas.' : 'No se ha podido guardar la cuenta.');
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
    case 'upgrades':
      // Flecha amarilla hacia arriba
      g.fillStyle(0x303030).fillTriangle(cx, cy - 13, cx - 12, cy + 1, cx + 12, cy + 1).fillRect(cx - 6, cy - 1, 12, 13);
      g.fillStyle(0xf8c838).fillTriangle(cx, cy - 10, cx - 9, cy, cx + 9, cy).fillRect(cx - 4, cy - 1, 8, 11);
      g.fillStyle(0xfff0a0).fillRect(cx - 2, cy - 6, 2, 14);
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
    case 'save':
      // Disquete
      g.fillStyle(0x303030).fillRoundedRect(cx - 11, cy - 11, 22, 22, 3);
      g.fillStyle(0x3c64c8).fillRoundedRect(cx - 10, cy - 10, 20, 20, 2);
      g.fillStyle(0xd0d8e8).fillRect(cx - 6, cy - 10, 12, 7);
      g.fillStyle(0x303030).fillRect(cx + 1, cy - 9, 3, 5);
      g.fillStyle(0xf8f8f8).fillRect(cx - 7, cy + 2, 14, 8);
      break;
  }
}

/** Medalla de la ficha de entrenador (octógono con brillo); con `badge` null, hueco vacío */
function drawBadge(g: Phaser.GameObjects.Graphics, cx: number, cy: number, badge: BadgeDef | null): void {
  const r = 12;
  const points = Array.from({ length: 8 }, (_, i) => {
    const a = Math.PI / 8 + (i * Math.PI) / 4;
    return new Phaser.Math.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  });
  if (!badge) {
    g.lineStyle(2, 0x5070a8).strokePoints(points, true);
    return;
  }
  g.fillStyle(0x101828).fillPoints(points.map((p) => new Phaser.Math.Vector2(p.x + 1, p.y + 2)), true);
  g.fillStyle(badge.color).fillPoints(points, true);
  g.fillStyle(badge.shine).fillTriangle(cx - 6, cy - 6, cx + 2, cy - 8, cx - 8, cy + 2);
  g.lineStyle(2, 0x101828).strokePoints(points, true);
}
