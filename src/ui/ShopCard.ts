import Phaser from 'phaser';
import { iconAnim, iconKey } from '../data/sprites';
import { priceOf, type TowerDef } from '../data/towers';
import { addTypeBadge, textStyle } from './theme';

export interface ShopCardHandlers {
  onClick(): void;
  onHover(): void;
  onOut(): void;
}

export class ShopCard extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly boxW: number;
  private readonly boxH: number;
  private hovered = false;
  private affordable = true;
  private highlighted = false;
  /** Pokémon que aún no se ha comprado en la tienda de Pokémon: se ve gris y con candado */
  private locked = false;
  private readonly price: Phaser.GameObjects.Text;
  private readonly lock: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    w: number,
    h: number,
    def: TowerDef,
    index: number,
    handlers: ShopCardHandlers,
  ) {
    super(scene, x, y);
    this.boxW = w;
    this.boxH = h;
    const first = def.stages[0];

    this.bg = scene.add.graphics();
    // En tarjetas bajas (equipo grande) todo se aprieta un poco
    const top = h >= 40 ? 8 : 4;
    const icon = scene.add.sprite(24, h / 2, iconKey(first.sprite), 0).setScale(Math.min(0.68, (h - 2) / 64));
    icon.play({ key: iconAnim(first.sprite), startFrame: Phaser.Math.Between(0, 1) });
    const name = scene.add.text(48, top, first.name.toUpperCase(), textStyle(8));
    const badge = addTypeBadge(scene, 48, top + 13, def.type);
    const price = scene.add.text(w - 10, top, `$${priceOf(first)}`, textStyle(8)).setOrigin(1, 0);
    this.price = price;
    // Candado pequeño en el sitio del precio
    this.lock = scene.add.graphics({ x: w - 18, y: top + 6 }).setVisible(false);
    this.lock.lineStyle(3, 0x404858).beginPath().arc(0, -2, 5, Math.PI, 0).strokePath();
    this.lock.fillStyle(0x404858).fillRoundedRect(-7, -2, 14, 11, 2).fillStyle(0xf0c040).fillRect(-5, 0, 10, 7);
    const hotkey = scene.add.text(w - 10, h - 4, `[${index + 1}]`, textStyle(8, '#9098a8', null)).setOrigin(1, 1);

    const zone = scene.add.zone(0, 0, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    zone
      .on('pointerover', () => {
        this.hovered = true;
        this.draw();
        handlers.onHover();
      })
      .on('pointerout', () => {
        this.hovered = false;
        this.draw();
        handlers.onOut();
      })
      .on('pointerdown', () => handlers.onClick());

    this.add([this.bg, icon, name, badge, price, this.lock, hotkey, zone]);
    this.draw();
    scene.add.existing(this);
  }

  setStatus(affordable: boolean, active: boolean, locked = false): void {
    if (affordable === this.affordable && active === this.highlighted && locked === this.locked) return;
    this.affordable = affordable;
    this.highlighted = active;
    this.locked = locked;
    this.price.setVisible(!locked);
    this.lock.setVisible(locked);
    this.draw();
  }

  private draw(): void {
    const { boxW: w, boxH: h } = this;
    const border = this.highlighted ? 0xf8c030 : this.hovered && this.affordable ? 0xe04040 : 0x404858;
    this.bg.clear();
    this.bg.fillStyle(border).fillRoundedRect(0, 0, w, h, 6);
    this.bg.fillStyle(this.highlighted ? 0xfff4c8 : 0xf8f8f8).fillRoundedRect(2, 2, w - 4, h - 4, 5);
    this.setAlpha(this.locked ? 0.4 : this.affordable ? 1 : 0.5);
  }
}
