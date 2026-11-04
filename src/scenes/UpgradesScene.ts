import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../config';
import { audio } from '../audio/Audio';
import { UPGRADE_BRANCHES, blockReason, spentPoints, upgradeById, type UpgradeDef } from '../data/upgrades';
import { buyUpgrade, refundUpgrades, upgradeLevels } from '../progress';
import { loadPoints } from '../save';
import { Button } from '../ui/Button';
import {
  MENU_FOOTER_H,
  MENU_HEADER_H,
  POKEBALL_CURSOR,
  addMenuFooter,
  addMenuHeader,
  addSectionLabel,
  drawMenuBackground,
  drawPanel,
  fitCamera,
  textStyle,
} from '../ui/theme';

const MARGIN = 24;
const MAX_COL_W = 440;
const TOP_Y = MENU_HEADER_H + 14;
const NODE_Y = TOP_Y + 72;
const NODE_H = 84;
const NODE_GAP = 20;
const DETAIL_H = 64;
/** Ancho del botón de mejorar (más estrecho en tarjetas estrechas, con tres ramas o más) */
const buyWidth = (nodeW: number) => (nodeW < 380 ? 96 : 112);
const GOLD = '#d09000';

/** Tarjeta de una mejora del árbol */
interface Node {
  def: UpgradeDef;
  col: number;
  row: number;
  container: Phaser.GameObjects.Container;
  ring: Phaser.GameObjects.Graphics;
  pips: Phaser.GameObjects.Graphics;
  effect: Phaser.GameObjects.Text;
  button: Button;
}

/** Árbol de mejoras de la cuenta: se compran con los puntos que se ganan en las partidas */
export class UpgradesScene extends Phaser.Scene {
  private nodes: Node[] = [];
  private selected = 0;
  private pointsText!: Phaser.GameObjects.Text;
  private detailTitle!: Phaser.GameObjects.Text;
  private detailText!: Phaser.GameObjects.Text;
  private refundButton!: Button;
  private confirmingRefund = false;
  private refundTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super('Upgrades');
  }

  create(): void {
    fitCamera(this);
    this.nodes = [];
    this.selected = 0;
    this.confirmingRefund = false;
    this.refundTimer = null;
    const W = GAME_W;

    drawMenuBackground(this);
    addMenuHeader(this, 'MEJORAS', () => this.back());
    addMenuFooter(this, [
      ['FLECHAS', 'Elegir'],
      ['ENTER', 'Mejorar'],
      ['ESC', 'Volver'],
    ]);

    // Una columna por rama, repartidas a lo ancho
    const cols = UPGRADE_BRANCHES.length;
    const colW = Math.min(MAX_COL_W, (W - MARGIN * (cols + 1)) / cols);
    const totalW = colW * cols + MARGIN * (cols - 1);
    const left = (W - totalW) / 2;

    // Puntos disponibles y botón para devolverlos
    drawPanel(this.add.graphics(), left, TOP_Y, totalW, 44);
    this.add.text(left + 18, TOP_Y + 22, 'PUNTOS', textStyle(8, '#7080a0', null)).setOrigin(0, 0.5);
    this.pointsText = this.add.text(left + 80, TOP_Y + 22, '', textStyle(16, GOLD)).setOrigin(0, 0.5);
    this.add
      .text(left + 200, TOP_Y + 22, 'Se ganan jugando. Las mejoras sirven en todas las partidas.', textStyle(8))
      .setOrigin(0, 0.5)
      .setVisible(totalW > 760);
    this.refundButton = new Button(this, left + totalW - 160, TOP_Y + 8, 148, 28, '', () => this.refund(), { variant: 'gray' });

    UPGRADE_BRANCHES.forEach((branch, col) => {
      const x = left + col * (colW + MARGIN);
      addSectionLabel(this, x + 4, NODE_Y - 16, colW - 8, branch.name);
      // Línea que une las mejoras de la rama, por detrás de las tarjetas
      const line = this.add.graphics();
      line.fillStyle(0x404858).fillRect(x + 28, NODE_Y + NODE_H / 2, 6, (branch.upgrades.length - 1) * (NODE_H + NODE_GAP));
      branch.upgrades.forEach((def, row) => this.addNode(def, col, row, x, NODE_Y + row * (NODE_H + NODE_GAP), colW));
    });

    const detailY = GAME_H - MENU_FOOTER_H - 10 - DETAIL_H;
    drawPanel(this.add.graphics(), left, detailY, totalW, DETAIL_H);
    this.detailTitle = this.add.text(left + 18, detailY + 18, '', textStyle(8, '#d03030', null)).setOrigin(0, 0.5);
    this.detailText = this.add
      .text(left + 18, detailY + 32, '', { ...textStyle(8), wordWrap: { width: totalW - 36 } })
      .setLineSpacing(6);

    this.refresh();

    this.input.setDefaultCursor(POKEBALL_CURSOR);
    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-UP', () => this.move(0, -1));
    keyboard?.on('keydown-DOWN', () => this.move(0, 1));
    keyboard?.on('keydown-LEFT', () => this.move(-1, 0));
    keyboard?.on('keydown-RIGHT', () => this.move(1, 0));
    keyboard?.on('keydown-ENTER', () => this.buy(this.nodes[this.selected]));
    keyboard?.on('keydown-ESC', () => this.back());
    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  private addNode(def: UpgradeDef, col: number, row: number, x: number, y: number, w: number): void {
    const index = this.nodes.length;
    const ring = this.add.graphics();
    ring.lineStyle(4, 0xffcb05).strokeRoundedRect(x - 4, y - 4, w + 8, NODE_H + 8, 10);
    this.tweens.add({ targets: ring, alpha: 0.45, duration: 500, yoyo: true, repeat: -1 });

    const bg = drawPanel(this.add.graphics(), 0, 0, w, NODE_H);
    // Círculo de la rama con el número de la mejora
    const dot = this.add.graphics().fillStyle(0x404858).fillCircle(31, NODE_H / 2, 15).fillStyle(0xe04040).fillCircle(31, NODE_H / 2, 12);
    const num = this.add.text(31, NODE_H / 2, String(row + 1), textStyle(8, '#f8f8f8', null)).setOrigin(0.5);
    const buyW = buyWidth(w);
    // Sitio para los textos, entre el círculo y el botón
    const textW = w - buyW - 14 - 56 - 6;
    const name = this.add.text(56, 18, def.name, textStyle(16)).setOrigin(0, 0.5);
    if (name.width > textW) name.setStyle(textStyle(8));
    const pips = this.add.graphics();
    const effect = this.add.text(56, 32, '', { ...textStyle(8), wordWrap: { width: textW } }).setLineSpacing(3);
    const zone = this.add
      .zone(0, 0, w - buyW - 20, NODE_H)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => this.select(index));
    const button = new Button(this, w - buyW - 14, (NODE_H - 40) / 2, buyW, 40, '', () => this.buy(this.nodes[index]), {
      variant: 'green',
      onHover: () => this.select(index),
    });
    const container = this.add.container(x, y, [bg, dot, num, name, pips, effect, zone, button]);
    this.nodes.push({ def, col, row, container, ring, pips, effect, button });
  }

  private refresh(): void {
    const levels = upgradeLevels();
    const points = loadPoints();
    this.pointsText.setText(String(points));
    const spent = spentPoints(levels);
    this.refundButton
      .setText(this.confirmingRefund ? '¿SEGURO?' : spent ? `DEVOLVER ${spent}` : 'DEVOLVER')
      .setVariant(this.confirmingRefund ? 'red' : 'gray')
      .setEnabled(spent > 0);

    this.nodes.forEach((node, i) => {
      const { def } = node;
      const level = levels[def.id];
      const max = def.costs.length;
      const reason = blockReason(def.id, levels, points);
      node.container.setAlpha(reason === 'locked' ? 0.55 : 1);
      node.ring.setVisible(i === this.selected);

      // Un cuadrito por nivel, relleno hasta el nivel actual
      const pipX = 56 + 0;
      node.pips.clear();
      for (let p = 0; p < max; p++) {
        node.pips.fillStyle(0x404858).fillRect(pipX + p * 18, 62, 14, 12);
        node.pips.fillStyle(p < level ? 0xffcb05 : 0xd8e0e8).fillRect(pipX + p * 18 + 2, 64, 10, 8);
      }
      const now = level ? def.effectText(level) : 'NADA';
      node.effect.setText(level < max ? `${now} -> ${def.effectText(level + 1)}` : `${now} (MAX)`);

      if (reason === 'max') node.button.setText('MAXIMO').setVariant('gray').setEnabled(false);
      else if (reason === 'locked') node.button.setText('BLOQUEADA').setVariant('gray').setEnabled(false);
      else node.button.setText(`MEJORAR\n${def.costs[level]} PTS`).setVariant('green').setEnabled(reason === null);
    });
    this.refreshDetail();
  }

  private refreshDetail(): void {
    const { def } = this.nodes[this.selected];
    const levels = upgradeLevels();
    const level = levels[def.id];
    this.detailTitle.setText(`${def.name} - NIVEL ${level}/${def.costs.length}`);
    const reason = blockReason(def.id, levels, loadPoints());
    let extra = '';
    if (reason === 'locked' && def.requires) extra = ` Antes necesitas ${upgradeById(def.requires).name} a nivel 1.`;
    else if (reason === 'points') extra = ` Te faltan ${def.costs[level] - loadPoints()} puntos.`;
    else if (reason === 'max') extra = ' Ya está al máximo.';
    this.detailText.setText(def.description + extra);
  }

  private select(index: number): void {
    if (this.selected === index) return;
    this.selected = index;
    this.nodes.forEach((n, i) => n.ring.setVisible(i === index));
    this.refreshDetail();
  }

  /** Flechas: arriba y abajo dentro de la rama, izquierda y derecha entre ramas */
  private move(dc: number, dr: number): void {
    const current = this.nodes[this.selected];
    const cols = UPGRADE_BRANCHES.length;
    const col = (current.col + dc + cols) % cols;
    const rows = UPGRADE_BRANCHES[col].upgrades.length;
    const row = Phaser.Math.Clamp(current.row + dr, 0, rows - 1);
    const index = this.nodes.findIndex((n) => n.col === col && n.row === row);
    if (index >= 0 && index !== this.selected) {
      audio.play('click');
      this.select(index);
    }
  }

  private buy(node: Node): void {
    this.select(this.nodes.indexOf(node));
    if (!buyUpgrade(node.def.id)) {
      audio.play('error');
      this.cameras.main.shake(100, 0.003);
      return;
    }
    audio.play('levelup');
    this.tweens.add({ targets: node.container, scale: { from: 1.03, to: 1 }, duration: 200, ease: 'Back.easeOut' });
    this.refresh();
  }

  /** Devuelve todos los puntos gastados; pide confirmación con un segundo clic */
  private refund(): void {
    if (!this.confirmingRefund) {
      this.confirmingRefund = true;
      this.refundTimer = this.time.delayedCall(3000, () => {
        this.confirmingRefund = false;
        this.refresh();
      });
      this.refresh();
      return;
    }
    this.refundTimer?.remove();
    this.confirmingRefund = false;
    refundUpgrades();
    audio.play('coin');
    this.refresh();
  }

  private back(): void {
    this.scene.start('MainMenu');
  }
}
