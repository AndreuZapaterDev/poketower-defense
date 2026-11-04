import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../config';
import { audio } from '../audio/Audio';
import { ITEMS, itemKey, type ItemDef } from '../data/items';
import { buyItem, itemBlockReason, ownedItems } from '../progress';
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
  drawMenuBackground,
  drawPanel,
  fitCamera,
  textStyle,
} from '../ui/theme';

const MARGIN = 24;
const LEFT_W = 280;
const TOP = MENU_HEADER_H + 16;
const DIALOG_H = 80;
const LIST_COLS = 2;
const ROW_H = 36;
const LIST_PAD = 14;
const GOLD = '#d09000';

const GREETING = '¡Hola! ¿Qué deseas? Tenemos Tablas que potencian a tus Pokémon en todas las partidas.';

interface Row {
  item: ItemDef;
  x: number;
  y: number;
  price: Phaser.GameObjects.Text;
  name: Phaser.GameObjects.Text;
  icon: Phaser.GameObjects.Image;
}

/** Tienda de objetos al estilo de la Tienda Pokémon: se paga con los puntos de la cuenta */
export class ItemShopScene extends Phaser.Scene {
  private rows: Row[] = [];
  private selected = 0;
  private confirming = false;
  private colW = 0;
  private highlight!: Phaser.GameObjects.Graphics;
  private cursor!: Phaser.GameObjects.Container;
  private pointsText!: Phaser.GameObjects.Text;
  private bigIcon!: Phaser.GameObjects.Image;
  private itemName!: Phaser.GameObjects.Text;
  private badge: Phaser.GameObjects.Container | null = null;
  /** Centro de la etiqueta de tipo del objeto elegido */
  private badgePos = { x: 0, y: 0 };
  private stateText!: Phaser.GameObjects.Text;
  private buyButton!: Button;

  private dialog!: DialogBox;

  constructor() {
    super('ItemShop');
  }

  create(): void {
    fitCamera(this);
    this.rows = [];
    this.selected = 0;
    this.confirming = false;
    this.badge = null;
    const W = GAME_W;
    const H = GAME_H;

    drawMenuBackground(this);
    addMenuHeader(this, 'TIENDA DE OBJETOS', () => this.back());
    addMenuFooter(this, [
      ['FLECHAS', 'Elegir'],
      ['ENTER', 'Comprar'],
      ['ESC', 'Volver'],
    ]);

    const dialogY = H - MENU_FOOTER_H - 12 - DIALOG_H;
    this.createPointsBox(MARGIN, TOP);
    this.createItemBox(MARGIN, TOP + 68, dialogY - 12 - (TOP + 68));
    this.createList(MARGIN + LEFT_W + 16, TOP, W - MARGIN * 2 - LEFT_W - 16, dialogY - 12 - TOP);
    this.dialog = new DialogBox(this, MARGIN, dialogY, W - MARGIN * 2, DIALOG_H);

    this.refresh();
    this.typeText(GREETING);

    this.input.setDefaultCursor(POKEBALL_CURSOR);
    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-UP', () => this.move(-LIST_COLS));
    keyboard?.on('keydown-DOWN', () => this.move(LIST_COLS));
    keyboard?.on('keydown-LEFT', () => this.move(-1));
    keyboard?.on('keydown-RIGHT', () => this.move(1));
    keyboard?.on('keydown-ENTER', () => this.buy());
    keyboard?.on('keydown-ESC', () => (this.confirming ? this.cancelConfirm() : this.back()));
    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  // ---------------------------------------------------------------- construcción

  private createPointsBox(x: number, y: number): void {
    drawPanel(this.add.graphics(), x, y, LEFT_W, 56);
    this.add.text(x + 18, y + 28, 'PUNTOS', textStyle(8, '#7080a0', null)).setOrigin(0, 0.5);
    this.pointsText = this.add.text(x + LEFT_W - 18, y + 28, '', textStyle(16, GOLD)).setOrigin(1, 0.5);
  }

  /** Recuadro del objeto elegido: su imagen en grande, nombre, tipo y el botón de comprar */
  private createItemBox(x: number, y: number, h: number): void {
    drawPanel(this.add.graphics(), x, y, LEFT_W, h);
    const cx = x + LEFT_W / 2;
    // Pedestal bajo el objeto, como en un escaparate
    this.add.graphics().fillStyle(0xd8e0f0).fillEllipse(cx, y + 104, 150, 34).fillStyle(0xc0cce4).fillEllipse(cx, y + 106, 120, 20);
    this.bigIcon = this.add.image(cx, y + 64, '__DEFAULT').setScale(2.5);
    this.tweens.add({ targets: this.bigIcon, y: y + 58, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.itemName = this.add.text(cx, y + 142, '', textStyle(16)).setOrigin(0.5);
    this.stateText = this.add.text(cx, y + 194, '', textStyle(8, '#7080a0', null)).setOrigin(0.5);
    this.buyButton = new Button(this, x + 30, y + h - 56, LEFT_W - 60, 40, '', () => this.buy(), { variant: 'blue' });
    this.badgePos = { x: cx, y: y + 168 };
  }

  private createList(x: number, y: number, w: number, h: number): void {
    drawPanel(this.add.graphics(), x, y, w, h);
    this.colW = (w - LIST_PAD * 2 - 12) / LIST_COLS;
    this.highlight = this.add.graphics();
    this.cursor = addMenuCursor(this);
    ITEMS.forEach((item, i) => {
      const rx = x + LIST_PAD + (i % LIST_COLS) * (this.colW + 12);
      const ry = y + LIST_PAD + Math.floor(i / LIST_COLS) * ROW_H;
      const icon = this.add.image(rx + 30, ry + ROW_H / 2, itemKey(item)).setScale(0.55);
      const name = this.add.text(rx + 50, ry + ROW_H / 2, item.name, textStyle(8)).setOrigin(0, 0.5);
      const price = this.add.text(rx + this.colW - 8, ry + ROW_H / 2, '', textStyle(8)).setOrigin(1, 0.5);
      this.add
        .zone(rx, ry, this.colW, ROW_H)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => this.select(i))
        .on('pointerdown', () => this.select(i));
      this.rows.push({ item, x: rx, y: ry, price, name, icon });
    });
  }


  // ---------------------------------------------------------------- estado

  private refresh(): void {
    const owned = ownedItems();
    this.pointsText.setText(String(loadPoints()));
    for (const row of this.rows) {
      const reason = itemBlockReason(row.item.id);
      const soon = reason === 'soon';
      if (owned.has(row.item.id)) row.price.setText('TUYA').setColor('#38a058');
      else if (soon) row.price.setText('PRONTO').setColor('#a0a0a0');
      else row.price.setText(`${row.item.price} PTS`).setColor(reason === 'points' ? '#c04040' : '#404040');
      row.name.setColor(soon ? '#a0a0a0' : '#404040');
      row.icon.setAlpha(soon ? 0.45 : 1);
    }

    const row = this.rows[this.selected];
    this.cursor.setPosition(row.x + 6, row.y + ROW_H / 2);
    this.highlight.clear().fillStyle(0xd8e8f8).fillRoundedRect(row.x, row.y + 2, this.colW, ROW_H - 4, 6);

    const { item } = row;
    const reason = itemBlockReason(item.id);
    this.bigIcon.setTexture(itemKey(item)).setAlpha(reason === 'soon' ? 0.5 : 1);
    this.itemName.setText(item.name);
    this.badge?.destroy();
    this.badge = null;
    if (item.type) {
      this.badge = addTypeBadge(this, 0, 0, item.type);
      this.badge.setPosition(this.badgePos.x - this.badge.getBounds().width / 2, this.badgePos.y - 7);
    }
    this.stateText.setText(
      reason === 'owned' ? '¡YA LA TIENES!' : reason === 'soon' ? 'SIN POKEMON DE ESTE TIPO' : `PRECIO: ${item.price} PUNTOS`,
    );
    if (this.confirming) this.buyButton.setText('¡SI, COMPRAR!').setVariant('green').setEnabled(true);
    else if (reason === 'owned') this.buyButton.setText('COMPRADA').setVariant('gray').setEnabled(false);
    else if (reason === 'soon') this.buyButton.setText('PRONTO').setVariant('gray').setEnabled(false);
    else this.buyButton.setText(`COMPRAR\n${item.price} PTS`).setVariant('blue').setEnabled(reason === null);
  }

  private select(index: number): void {
    if (this.selected === index) return;
    this.selected = index;
    this.confirming = false;
    audio.play('click');
    this.refresh();
    const { item } = this.rows[index];
    const reason = itemBlockReason(item.id);
    let text = item.description;
    if (reason === 'soon') text += ' Aún no hay Pokémon de este tipo en la tienda.';
    else if (reason === 'points') text += ` Te faltan ${item.price - loadPoints()} puntos.`;
    this.typeText(text);
  }

  private move(step: number): void {
    const next = this.selected + step;
    if (next < 0 || next >= this.rows.length) return;
    this.select(next);
  }

  /** Comprar pide confirmación: el primer ENTER o clic pregunta, el segundo compra */
  private buy(): void {
    const { item } = this.rows[this.selected];
    const reason = itemBlockReason(item.id);
    if (reason) {
      audio.play('error');
      this.typeText(
        reason === 'points'
          ? 'Lo siento, no tienes suficientes puntos. ¡Juega más partidas para conseguirlos!'
          : reason === 'owned'
            ? 'Ya tienes esa Tabla. ¡Sus efectos ya te ayudan en todas las partidas!'
            : 'Esa Tabla aún no sirve: no hay Pokémon de su tipo en la tienda. ¡Pronto!',
      );
      return;
    }
    if (!this.confirming) {
      this.confirming = true;
      audio.play('click');
      this.typeText(`${item.name}, ¿verdad? Son ${item.price} puntos. ¿La quieres?`);
      this.refresh();
      return;
    }
    this.confirming = false;
    if (!buyItem(item.id)) {
      audio.play('error');
      this.refresh();
      return;
    }
    audio.play('coin');
    this.tweens.add({ targets: this.bigIcon, scale: { from: 3.2, to: 2.5 }, duration: 260, ease: 'Back.easeOut' });
    this.typeText('¡Aquí tienes! Gracias por tu compra.');
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
