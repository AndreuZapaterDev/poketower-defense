import Phaser from 'phaser';
import { GAME_H, MAP_W, SIDEBAR_W } from '../config';
import { TOWERS, type TowerDef } from '../data/towers';
import { TYPE_NAMES, strongAgainst, uselessAgainst, type PokeType } from '../data/types';
import { TARGET_LABELS, type Tower } from '../objects/Tower';
import { Button } from './Button';
import { ShopCard } from './ShopCard';
import { WHITE, addTypeBadge, caps, drawPanel, textStyle } from './theme';

export interface SidebarHandlers {
  onBuy(def: TowerDef): void;
  onEvolve(): void;
  onSell(): void;
  onCycleTarget(): void;
  onNextWave(): void;
  onTogglePause(): void;
  onToggleSpeed(): void;
  onToggleMute(): void;
  onReset(): void;
}

export interface HudState {
  money: number;
  lives: number;
  wave: number;
  totalWaves: number;
  waveActive: boolean;
  canStartWave: boolean;
  speed: number;
  paused: boolean;
  muted: boolean;
  placing: TowerDef | null;
}

const DEPTH = 100;
const X0 = MAP_W;
const PAD = 8;
const INNER_W = SIDEBAR_W - PAD * 2;
const SHOP_Y = 120;
const CARD_H = 42;
const CARD_STEP = 46;
const INFO_Y = SHOP_Y + TOWERS.length * CARD_STEP + 6;
const INFO_H = 148;
const INFO_X = X0 + PAD + 10;
const INFO_W = INNER_W - 20;
const RED_SHADOW = '#902020';
const HELP_TEXT =
  'Elige un Pokémon de la tienda y colócalo junto al camino.\n\nTECLAS\n1-5      comprar\nESPACIO  luchar\nP pausa  V velocidad\nM sonido ESC cancelar\nR reiniciar';

const typeList = (types: PokeType[]) => types.map((t) => caps(TYPE_NAMES[t])).join(' ');

export class Sidebar {
  private readonly scene: Phaser.Scene;
  private readonly moneyText: Phaser.GameObjects.Text;
  private readonly livesText: Phaser.GameObjects.Text;
  private readonly waveText: Phaser.GameObjects.Text;
  private readonly shopCards: ShopCard[];
  private readonly info: Phaser.GameObjects.Container;
  private readonly killsText: Phaser.GameObjects.Text;
  private readonly expLabel: Phaser.GameObjects.Text;
  private readonly expBar: Phaser.GameObjects.Graphics;
  private readonly targetBtn: Button;
  private readonly evolveBtn: Button;
  private readonly sellBtn: Button;
  private readonly waveBtn: Button;
  private readonly pauseBtn: Button;
  private readonly speedBtn: Button;
  private readonly muteBtn: Button;
  private selected: Tower | null = null;
  private hovered: TowerDef | null = null;
  private infoKey = '';

  constructor(scene: Phaser.Scene, handlers: SidebarHandlers) {
    this.scene = scene;
    const g = scene.add.graphics().setDepth(DEPTH);

    // Carcasa roja estilo Pokédex
    g.fillStyle(0xc83030).fillRect(X0, 0, SIDEBAR_W, GAME_H);
    g.fillStyle(0x902020).fillRect(X0, 0, 4, GAME_H);
    g.fillStyle(0xe84848).fillRect(X0 + 4, 0, SIDEBAR_W - 4, 42);
    g.fillStyle(0x902020).fillRect(X0 + 4, 42, SIDEBAR_W - 4, 3);
    scene.add.image(X0 + 22, 21, 'pokeball').setScale(1.5).setDepth(DEPTH);
    scene.add.text(X0 + 38, 8, 'POKéTOWER', textStyle(16, WHITE, RED_SHADOW)).setDepth(DEPTH);
    scene.add.text(X0 + 39, 28, 'DEFENSE', textStyle(8, '#ffd858', RED_SHADOW)).setDepth(DEPTH);
    new Button(scene, X0 + SIDEBAR_W - 56, 10, 24, 24, '', handlers.onReset, {
      variant: 'gray',
      icon: 'icon-reset',
    }).setDepth(DEPTH);
    this.muteBtn = new Button(scene, X0 + SIDEBAR_W - 30, 10, 24, 24, '', handlers.onToggleMute, {
      variant: 'gray',
      icon: 'icon-sound',
    }).setDepth(DEPTH);

    // Estado de la partida
    drawPanel(g, X0 + PAD, 52, INNER_W, 50);
    scene.add.image(X0 + 26, 68, 'coin').setDepth(DEPTH);
    this.moneyText = scene.add.text(X0 + 38, 61, '', textStyle(16)).setDepth(DEPTH);
    scene.add.image(X0 + 140, 68, 'pokeball').setDepth(DEPTH);
    this.livesText = scene.add.text(X0 + 152, 61, '', textStyle(16)).setDepth(DEPTH);
    this.waveText = scene.add.text(X0 + 18, 84, '', textStyle(8)).setDepth(DEPTH);

    // Tienda
    scene.add.text(X0 + PAD + 4, 108, 'TIENDA', textStyle(8, WHITE, RED_SHADOW)).setDepth(DEPTH);
    this.shopCards = TOWERS.map((def, i) =>
      new ShopCard(scene, X0 + PAD, SHOP_Y + i * CARD_STEP, INNER_W, CARD_H, def, i, {
        onClick: () => handlers.onBuy(def),
        onHover: () => {
          this.hovered = def;
          this.renderInfo();
        },
        onOut: () => {
          if (this.hovered !== def) return;
          this.hovered = null;
          this.renderInfo();
        },
      }).setDepth(DEPTH),
    );

    // Ficha del Pokémon seleccionado
    drawPanel(g, X0 + PAD, INFO_Y, INNER_W, INFO_H);
    this.info = scene.add.container(INFO_X, INFO_Y + 10).setDepth(DEPTH);
    this.killsText = scene.add.text(INFO_X + INFO_W, INFO_Y + 27, '', textStyle(8)).setOrigin(1, 0).setDepth(DEPTH);
    this.expLabel = scene.add.text(INFO_X, INFO_Y + 40, 'EXP', textStyle(8, '#3870c8', '#c8d8f0')).setDepth(DEPTH);
    this.expBar = scene.add.graphics().setDepth(DEPTH);
    this.targetBtn = new Button(scene, INFO_X - 2, INFO_Y + 118, INFO_W + 4, 22, '', handlers.onCycleTarget, {
      variant: 'blue',
    }).setDepth(DEPTH);

    this.evolveBtn = new Button(scene, X0 + PAD, 508, 140, 32, '', handlers.onEvolve, { variant: 'green' }).setDepth(
      DEPTH,
    );
    this.sellBtn = new Button(scene, X0 + PAD + 144, 508, INNER_W - 144, 32, '', handlers.onSell, {
      variant: 'gray',
    }).setDepth(DEPTH);

    this.waveBtn = new Button(scene, X0 + PAD, 544, 112, 28, '', handlers.onNextWave, { variant: 'blue' }).setDepth(
      DEPTH,
    );
    this.pauseBtn = new Button(scene, X0 + PAD + 116, 544, 52, 28, '', handlers.onTogglePause, {
      variant: 'gray',
      icon: 'icon-pause',
    }).setDepth(DEPTH);
    this.speedBtn = new Button(scene, X0 + PAD + 172, 544, INNER_W - 172, 28, '', handlers.onToggleSpeed, {
      variant: 'gray',
    }).setDepth(DEPTH);
  }

  update(state: HudState, selected: Tower | null): void {
    this.moneyText.setText(`${state.money}`);
    this.livesText.setText(`${state.lives}`);
    this.waveText.setText(`OLEADA ${state.wave}/${state.totalWaves}`);

    TOWERS.forEach((def, i) => this.shopCards[i].setStatus(state.money >= def.stages[0].cost, state.placing === def));

    this.waveBtn.setText(state.waveActive ? 'EN COMBATE' : '¡LUCHAR!').setEnabled(state.canStartWave);
    this.pauseBtn.setIcon(state.paused ? 'icon-play' : 'icon-pause');
    this.speedBtn.setText(`x${state.speed}`);
    this.muteBtn.setIcon(state.muted ? 'icon-mute' : 'icon-sound');

    this.selected = selected;
    this.evolveBtn.setVisible(!!selected);
    this.sellBtn.setVisible(!!selected);
    if (selected) {
      if (selected.canEvolve) {
        const next = selected.def.stages[selected.stage + 1];
        const verb = next.sprite !== selected.stats.sprite ? 'EVOLUCIONAR' : 'ENTRENAR';
        this.evolveBtn.setText(`${verb}\n$${next.cost}`).setEnabled(state.money >= next.cost);
      } else {
        this.evolveBtn.setText('NIVEL MAX.').setEnabled(false);
      }
      this.sellBtn.setText(`VENDER\n$${selected.sellValue}`);
      this.killsText.setText(`KO ${selected.kills}`);
      this.drawExp(selected);
      this.targetBtn.setText(`OBJETIVO: ${TARGET_LABELS[selected.targetMode]}`);
    }
    this.renderInfo();
  }

  /** Posición del icono de una tarjeta de la tienda (de ahí sale la Poké Ball) */
  cardPosition(def: TowerDef): { x: number; y: number } {
    const i = TOWERS.indexOf(def);
    return { x: X0 + PAD + 24, y: SHOP_Y + i * CARD_STEP + CARD_H / 2 };
  }

  private drawExp(tower: Tower): void {
    const x = INFO_X + 28;
    const y = INFO_Y + 40;
    const w = INFO_W - 28;
    const ratio = Math.min(1, tower.exp / tower.expToNext);
    this.expBar.clear();
    this.expBar.fillStyle(0x404858).fillRoundedRect(x - 2, y - 1, w + 4, 10, 3);
    this.expBar.fillStyle(0xd8e0e8).fillRect(x, y + 1, w, 6);
    this.expBar.fillStyle(0x40a0f8).fillRect(x, y + 1, w * ratio, 6);
    this.expBar.fillStyle(0xffffff, 0.4).fillRect(x, y + 1, w * ratio, 2);
  }

  private renderInfo(): void {
    const tower = this.selected;
    const showingTower = !!tower && !this.hovered;
    this.killsText.setVisible(showingTower);
    this.expLabel.setVisible(showingTower);
    this.expBar.setVisible(showingTower);
    this.targetBtn.setVisible(showingTower);

    const def = this.hovered ?? tower?.def ?? null;
    const stageIndex = this.hovered ? 0 : (tower?.stage ?? 0);
    const level = this.hovered ? def?.stages[0].level : tower?.level;
    const key = def ? `${this.hovered ? 'shop' : 'tower'}-${def.id}-${stageIndex}-${level}` : 'help';
    if (key === this.infoKey) return;
    this.infoKey = key;
    this.info.removeAll(true);

    const add = this.scene.add;
    if (!def) {
      this.info.add(add.text(0, 0, HELP_TEXT, { ...textStyle(8), wordWrap: { width: INFO_W } }).setLineSpacing(4));
      return;
    }

    const s = def.stages[stageIndex];
    const damage = this.hovered || !tower ? s.damage : tower.damage;
    const strong = strongAgainst(def.type);
    const immune = uselessAgainst(def.type);
    let matchups = strong.length ? `EFICAZ: ${typeList(strong)}` : '';
    if (immune.length) matchups += `\nINMUNES: ${typeList(immune)}`;

    this.info.add([
      add.text(0, 0, s.name.toUpperCase(), textStyle(8)),
      add.text(INFO_W, 0, `Nv${level}`, textStyle(8)).setOrigin(1, 0),
      addTypeBadge(this.scene, 0, 14, def.type),
      add
        .text(0, 42, `ATQ ${damage}   ALC ${s.range}\nVEL ${(1000 / s.fireRate).toFixed(1)}/s`, textStyle(8))
        .setLineSpacing(6),
      add
        .text(0, 70, def.description, { ...textStyle(8, '#3060a8', '#c8d8f0'), wordWrap: { width: INFO_W } })
        .setLineSpacing(4),
      add
        .text(0, 96, matchups, { ...textStyle(8, '#a03030', '#f0d0d0'), wordWrap: { width: INFO_W } })
        .setLineSpacing(4),
    ]);
  }
}
