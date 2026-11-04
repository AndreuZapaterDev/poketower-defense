import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../config';
import { audio } from '../audio/Audio';
import { pokemonPrice } from '../data/pokemonShop';
import { battleSprite, iconAnim, iconKey } from '../data/sprites';
import { TOWERS, type TowerDef } from '../data/towers';
import { TYPE_COLORS } from '../data/types';
import { buyPokemon, ownedPokemon, pokemonBlockReason } from '../progress';
import { loadPoints } from '../save';
import { Button } from '../ui/Button';
import { DialogBox } from '../ui/DialogBox';
import {
  MENU_FOOTER_H,
  MENU_HEADER_H,
  POKEBALL_CURSOR,
  addMenuCursor,
  addMenuFooter,
  addMenuHeader,
  addTypeBadge,
  darken,
  drawMenuBackground,
  drawPanel,
  fitCamera,
  textStyle,
} from '../ui/theme';

const MARGIN = 24;
const LIST_W = 330;
const TOP = MENU_HEADER_H + 16;
const DIALOG_H = 80;
const POINTS_H = 40;
const ROW_H = 58;
const GOLD = '#d09000';
/** Altura con que se dibuja el Pokémon del escaparate */
const SHOWCASE_SIZE = 110;

const GREETING = '¡Bienvenido! Aquí consigues nuevos Pokémon. Solo puedes llevar a la batalla los que tengas.';

interface Row {
  def: TowerDef;
  y: number;
  price: Phaser.GameObjects.Text;
}

/** Tienda de Pokémon: se compran con los puntos de la cuenta y solo se juega con los que se tienen */
export class PokemonShopScene extends Phaser.Scene {
  private rows: Row[] = [];
  private selected = 0;
  private confirming = false;
  private listX = 0;
  private highlight!: Phaser.GameObjects.Graphics;
  private cursor!: Phaser.GameObjects.Container;
  private pointsText!: Phaser.GameObjects.Text;
  /** Objetos del escaparate que cambian con el Pokémon elegido */
  private showcase: Phaser.GameObjects.GameObject[] = [];
  private showcaseArea = { x: 0, y: 0, w: 0, h: 0 };
  private buyButton!: Button;

  private dialog!: DialogBox;

  constructor() {
    super('PokemonShop');
  }

  create(): void {
    fitCamera(this);
    this.rows = [];
    this.selected = 0;
    this.confirming = false;
    this.showcase = [];
    const W = GAME_W;
    const H = GAME_H;

    drawMenuBackground(this);
    addMenuHeader(this, 'TIENDA DE POKéMON', () => this.back());
    addMenuFooter(this, [
      ['FLECHAS', 'Elegir'],
      ['ENTER', 'Comprar'],
      ['ESC', 'Volver'],
    ]);

    const dialogY = H - MENU_FOOTER_H - 12 - DIALOG_H;
    const bodyH = dialogY - 12 - TOP;
    this.createList(MARGIN, TOP, bodyH);
    const sx = MARGIN + LIST_W + 16;
    this.createShowcase(sx, TOP, W - MARGIN - sx, bodyH);
    this.dialog = new DialogBox(this, MARGIN, dialogY, W - MARGIN * 2, DIALOG_H);

    this.refresh();
    this.typeText(GREETING);

    this.input.setDefaultCursor(POKEBALL_CURSOR);
    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-UP', () => this.move(-1));
    keyboard?.on('keydown-DOWN', () => this.move(1));
    keyboard?.on('keydown-ENTER', () => this.buy());
    keyboard?.on('keydown-ESC', () => (this.confirming ? this.cancelConfirm() : this.back()));
    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  // ---------------------------------------------------------------- construcción

  private createList(x: number, y: number, h: number): void {
    this.listX = x;
    drawPanel(this.add.graphics(), x, y, LIST_W, h);
    this.add.text(x + 18, y + POINTS_H / 2 + 4, 'PUNTOS', textStyle(8, '#7080a0', null)).setOrigin(0, 0.5);
    this.pointsText = this.add.text(x + LIST_W - 18, y + POINTS_H / 2 + 4, '', textStyle(16, GOLD)).setOrigin(1, 0.5);
    this.add.graphics().fillStyle(0xe8c0c0).fillRect(x + 12, y + POINTS_H + 4, LIST_W - 24, 2);
    this.highlight = this.add.graphics();
    this.cursor = addMenuCursor(this);

    TOWERS.forEach((def, i) => {
      const ry = y + POINTS_H + 10 + i * ROW_H;
      const first = def.stages[0];
      const icon = this.add.sprite(x + 50, ry + ROW_H / 2, iconKey(first.sprite)).setScale(0.75);
      icon.play({ key: iconAnim(first.sprite), startFrame: i % 2 });
      this.add.text(x + 84, ry + 18, first.name.toUpperCase(), textStyle(8));
      addTypeBadge(this, x + 84, ry + 32, def.type);
      const price = this.add.text(x + LIST_W - 16, ry + ROW_H / 2, '', textStyle(8)).setOrigin(1, 0.5);
      this.add
        .zone(x + 8, ry, LIST_W - 16, ROW_H)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => this.select(i))
        .on('pointerdown', () => this.select(i));
      this.rows.push({ def, y: ry, price });
    });
  }

  private createShowcase(x: number, y: number, w: number, h: number): void {
    drawPanel(this.add.graphics(), x, y, w, h);
    this.showcaseArea = { x, y, w, h };
    this.buyButton = new Button(this, x + w - 230, y + h - 56, 210, 40, '', () => this.buy(), { variant: 'blue' });
  }


  // ---------------------------------------------------------------- estado

  private refresh(): void {
    const owned = ownedPokemon();
    this.pointsText.setText(String(loadPoints()));
    for (const row of this.rows) {
      const price = pokemonPrice(row.def.id);
      if (owned.has(row.def.id)) row.price.setText(price ? 'TUYO' : 'INICIAL').setColor('#38a058');
      else row.price.setText(`${price} PTS`).setColor(pokemonBlockReason(row.def.id) === 'points' ? '#c04040' : '#404040');
    }
    const row = this.rows[this.selected];
    this.cursor.setPosition(this.listX + 18, row.y + ROW_H / 2);
    this.highlight.clear().fillStyle(0xd8e8f8).fillRoundedRect(this.listX + 8, row.y + 3, LIST_W - 16, ROW_H - 6, 6);
    this.drawShowcase(row.def);

    const reason = pokemonBlockReason(row.def.id);
    const price = pokemonPrice(row.def.id);
    if (this.confirming) this.buyButton.setText('¡SI, LO QUIERO!').setVariant('green').setEnabled(true);
    else if (reason === 'owned') this.buyButton.setText(price ? '¡YA ES TUYO!' : 'INICIAL: YA ES TUYO').setVariant('gray').setEnabled(false);
    else this.buyButton.setText(`CONSEGUIR\n${price} PTS`).setVariant('blue').setEnabled(reason === null);
  }

  /** Escaparate: el Pokémon en su plataforma, sus datos y su línea evolutiva */
  private drawShowcase(def: TowerDef): void {
    this.showcase.forEach((o) => o.destroy());
    this.showcase = [];
    const keep = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.showcase.push(o);
      return o;
    };
    const { x, y, w, h } = this.showcaseArea;
    const first = def.stages[0];
    const color = TYPE_COLORS[def.type];
    const owned = ownedPokemon().has(def.id);

    // Fondo de combate a la izquierda con el Pokémon sobre su plataforma
    const stageW = Math.min(250, w * 0.45);
    const bg = keep(this.add.graphics());
    bg.fillGradientStyle(0xd8ecf8, 0xd8ecf8, 0xf0f8f0, 0xf0f8f0, 1).fillRect(x + 14, y + 14, stageW, h - 28);
    bg.fillStyle(0xc8e8b8).fillRect(x + 14, y + h - 100, stageW, 86);
    bg.lineStyle(2, 0xa8b8d0).strokeRect(x + 14, y + 14, stageW, h - 28);
    const cx = x + 14 + stageW / 2;
    const cy = y + h - 70;
    bg.fillStyle(darken(color, 35)).fillEllipse(cx, cy, 190, 50).fillStyle(color).fillEllipse(cx, cy - 3, 174, 40);
    bg.fillStyle(0xffffff, 0.35).fillEllipse(cx - 20, cy - 8, 90, 12);
    const look = battleSprite(first.sprite);
    const sprite = keep(this.add.sprite(cx, cy + 4, look.texture).setOrigin(0.5, 1).setScale(SHOWCASE_SIZE / look.size));
    sprite.play({ key: look.anim, startFrame: 0 });
    if (!owned) sprite.setTint(0x9098a8);
    this.tweens.add({ targets: sprite, y: cy - 4, duration: 600, yoyo: true, repeat: -1, ease: 'Quad.easeOut' });

    // Datos a la derecha
    const tx = x + 14 + stageW + 20;
    const tw = x + w - 20 - tx;
    keep(this.add.text(tx, y + 26, first.name.toUpperCase(), textStyle(16)).setOrigin(0, 0.5));
    keep(addTypeBadge(this, tx, y + 44, def.type));
    const rate = (1000 / first.fireRate).toFixed(1);
    keep(
      this.add
        .text(tx, y + 72, `ATAQUE    ${first.damage}\nALCANCE   ${first.rangeTiles} casillas\nVELOCIDAD ${rate} ataques/s`, textStyle(8))
        .setLineSpacing(8),
    );
    keep(
      this.add
        .text(tx, y + 128, def.description, { ...textStyle(8, '#3060a8', '#c8d8f0'), wordWrap: { width: tw } })
        .setLineSpacing(6),
    );

    // Línea evolutiva: cada forma distinta con el nivel al que se consigue
    keep(this.add.text(tx, y + 172, 'EVOLUCIONES', textStyle(8, '#d03030', null)));
    const forms = def.stages.filter((s, i) => i === 0 || s.sprite !== def.stages[i - 1].sprite);
    const step = Math.min(84, tw / forms.length);
    forms.forEach((form, i) => {
      const fx = tx + 24 + i * step;
      const icon = keep(this.add.sprite(fx, y + 204, iconKey(form.sprite)).setScale(0.62));
      icon.play({ key: iconAnim(form.sprite), startFrame: i % 2 });
      keep(this.add.text(fx, y + 230, `Nv${form.level}`, textStyle(8, '#7080a0', null)).setOrigin(0.5));
      if (i > 0) keep(this.add.text(fx - step / 2, y + 204, '>', textStyle(8, '#7080a0', null)).setOrigin(0.5));
    });
  }

  private select(index: number): void {
    if (this.selected === index) return;
    this.selected = index;
    this.confirming = false;
    audio.play('click');
    this.refresh();
    const { def } = this.rows[index];
    const name = def.stages[0].name;
    const reason = pokemonBlockReason(def.id);
    const price = pokemonPrice(def.id);
    this.typeText(
      reason === 'owned'
        ? price
          ? `${name} ya es parte de tu equipo.`
          : `${name} es uno de los Pokémon iniciales: lo tienes desde el principio.`
        : reason === 'points'
          ? `${name} cuesta ${price} puntos. Te faltan ${price - loadPoints()}.`
          : `${name} cuesta ${price} puntos. ¿Lo quieres en tu equipo?`,
    );
  }

  private move(step: number): void {
    const next = this.selected + step;
    if (next < 0 || next >= this.rows.length) return;
    this.select(next);
  }

  /** Comprar pide confirmación: el primer ENTER o clic pregunta, el segundo compra */
  private buy(): void {
    const { def } = this.rows[this.selected];
    const name = def.stages[0].name;
    const reason = pokemonBlockReason(def.id);
    if (reason) {
      audio.play('error');
      this.typeText(
        reason === 'points'
          ? 'Lo siento, no tienes suficientes puntos. ¡Juega más partidas para conseguirlos!'
          : `${name} ya es parte de tu equipo.`,
      );
      return;
    }
    if (!this.confirming) {
      this.confirming = true;
      audio.play('click');
      this.typeText(`${name}, ¿verdad? Son ${pokemonPrice(def.id)} puntos. ¿Lo quieres?`);
      this.refresh();
      return;
    }
    this.confirming = false;
    if (!buyPokemon(def.id)) {
      audio.play('error');
      this.refresh();
      return;
    }
    audio.play('evolve');
    this.cameras.main.flash(200, 255, 255, 255);
    this.typeText(`¡Aquí tienes! ¡${name} se ha unido a tu equipo! Ya puedes usarlo en las partidas.`);
    this.refresh();
  }

  private cancelConfirm(): void {
    this.confirming = false;
    this.typeText('¿Algo más?');
    this.refresh();
  }


  /** Escribe en el cuadro de diálogo, letra a letra */
  private typeText(text: string): void {
    this.dialog.say(text);
  }

  private back(): void {
    this.scene.start('MainMenu');
  }
}
