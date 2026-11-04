import Phaser from 'phaser';
import { GAME_H, MAP_W, SIDEBAR_W, TILE } from '../config';
import { ALL_SKILLS } from '../data/skills';
import { iconKey } from '../data/sprites';
import { priceOf, type TowerDef } from '../data/towers';
import { SIDEBAR_SHOP_SLOTS } from '../data/team';
import { TYPE_COLORS, TYPE_NAMES, strongAgainst, uselessAgainst, type PokeType } from '../data/types';
import { TARGET_LABELS, type Tower } from '../objects/Tower';
import { Button } from './Button';
import { ShopCard } from './ShopCard';
import { INK, WHITE, addTypeBadge, caps, drawPanel, textStyle } from './theme';

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
  /** Al pulsar un Pokémon en la pestaña de daño */
  onSelectTower(tower: Tower): void;
  /** Abre el árbol de habilidades del Pokémon seleccionado */
  onOpenSkills(): void;
}

/** Pestañas de la barra lateral: la tienda o la clasificación de daño */
export type SidebarTab = 'shop' | 'damage';
const TABS: { id: SidebarTab; label: string }[] = [
  { id: 'shop', label: 'TIENDA' },
  { id: 'damage', label: 'DAÑO' },
];

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
  /** Ids de los Pokémon que tiene la cuenta; el resto sale bloqueado en la tienda */
  owned: ReadonlySet<string>;
}

const DEPTH = 100;
const X0 = MAP_W;
const PAD = 8;
const INNER_W = SIDEBAR_W - PAD * 2;
const SHOP_Y = 120;
const INFO_H = 148;
/** La ficha del Pokémon termina justo encima de los botones de evolucionar y vender */
const INFO_BOTTOM = 504;
/** Las tarjetas de la tienda se reparten el sitio que queda encima de la ficha (como mucho 46 px cada una) */
const CARD_STEP = Math.min(46, Math.floor((INFO_BOTTOM - INFO_H - 6 - SHOP_Y) / SIDEBAR_SHOP_SLOTS));
const CARD_H = CARD_STEP - 4;
const INFO_Y = SHOP_Y + SIDEBAR_SHOP_SLOTS * CARD_STEP + 6;
const INFO_X = X0 + PAD + 10;
const INFO_W = INNER_W - 20;
const RED_SHADOW = '#902020';
const helpText = (teamSize: number) =>
  `Elige un Pokémon de la tienda y colócalo junto al camino.\n\nTECLAS\n1-${teamSize}      comprar\nESPACIO  luchar\nP pausa  V velocidad\nM sonido ESC cancelar\nR reiniciar TAB daño\nH habilidades`;
const TAB_Y = 104;
const TAB_H = 16;
/** Recuadro de la pestaña de daño: ocupa el sitio de la tienda y de la ficha */
const DMG_Y = SHOP_Y - 2;
const DMG_H = INFO_Y + INFO_H - DMG_Y;
const DMG_ROWS_Y = 32;
const DMG_ROW_H = 34;
const DMG_ROWS = Math.floor((DMG_H - DMG_ROWS_Y - 6) / DMG_ROW_H);

/** 12345 -> "12345"; 123456 -> "123.5K" */
const formatDamage = (n: number) => (n < 100000 ? String(Math.round(n)) : `${(n / 1000).toFixed(1)}K`);

const typeList = (types: PokeType[]) => types.map((t) => caps(TYPE_NAMES[t])).join(' ');

export class Sidebar {
  private readonly scene: Phaser.Scene;
  private readonly moneyText: Phaser.GameObjects.Text;
  private readonly livesText: Phaser.GameObjects.Text;
  private readonly waveText: Phaser.GameObjects.Text;
  private readonly shopCards: ShopCard[];
  /** Pokémon del equipo, en el orden de la tienda (y de las teclas 1, 2, 3...) */
  private readonly defs: TowerDef[];
  /** Pista en el hueco que queda bajo el equipo, si no llena la tienda */
  private readonly teamHint: Phaser.GameObjects.Text;
  private readonly info: Phaser.GameObjects.Container;
  private readonly killsText: Phaser.GameObjects.Text;
  private readonly expLabel: Phaser.GameObjects.Text;
  private readonly expBar: Phaser.GameObjects.Graphics;
  private readonly targetBtn: Button;
  private readonly skillsBtn: Button;
  private readonly evolveBtn: Button;
  private readonly sellBtn: Button;
  private readonly waveBtn: Button;
  private readonly pauseBtn: Button;
  private readonly speedBtn: Button;
  private readonly muteBtn: Button;
  private selected: Tower | null = null;
  private hovered: TowerDef | null = null;
  private infoKey = '';
  private tab: SidebarTab = 'shop';
  private readonly tabGfx: Phaser.GameObjects.Graphics;
  private readonly tabLabels: Phaser.GameObjects.Text[] = [];
  private readonly damagePanel: Phaser.GameObjects.Container;
  private readonly damageTotal: Phaser.GameObjects.Text;
  private readonly damageEmpty: Phaser.GameObjects.Text;
  private readonly damageRows: DamageRow[] = [];

  constructor(scene: Phaser.Scene, handlers: SidebarHandlers, team: TowerDef[]) {
    this.scene = scene;
    this.defs = team.slice(0, SIDEBAR_SHOP_SLOTS);
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

    // Pestañas: tienda y clasificación de daño
    this.tabGfx = scene.add.graphics().setDepth(DEPTH);
    const tabW = INNER_W / TABS.length;
    TABS.forEach(({ id, label }, i) => {
      const x = X0 + PAD + i * tabW;
      this.tabLabels.push(
        scene.add.text(x + tabW / 2, TAB_Y + TAB_H / 2 + 1, label, textStyle(8, WHITE, RED_SHADOW)).setOrigin(0.5).setDepth(DEPTH),
      );
      scene.add
        .zone(x, TAB_Y, tabW, TAB_H)
        .setOrigin(0)
        .setDepth(DEPTH)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.setTab(id));
    });
    this.shopCards = this.defs.map((def, i) =>
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

    this.teamHint = scene.add
      .text(X0 + PAD + INNER_W / 2, SHOP_Y + this.defs.length * CARD_STEP + CARD_H / 2, 'Cambia tu equipo en\nEQUIPO, en el menú', {
        ...textStyle(8, WHITE, RED_SHADOW),
        align: 'center',
      })
      .setLineSpacing(4)
      .setOrigin(0.5)
      .setDepth(DEPTH)
      .setVisible(this.defs.length < SIDEBAR_SHOP_SLOTS);

    // Ficha del Pokémon seleccionado
    drawPanel(g, X0 + PAD, INFO_Y, INNER_W, INFO_H);
    this.info = scene.add.container(INFO_X, INFO_Y + 10).setDepth(DEPTH);
    this.killsText = scene.add.text(INFO_X + INFO_W, INFO_Y + 27, '', textStyle(8)).setOrigin(1, 0).setDepth(DEPTH);
    this.expLabel = scene.add.text(INFO_X, INFO_Y + 40, 'EXP', textStyle(8, '#3870c8', '#c8d8f0')).setDepth(DEPTH);
    this.expBar = scene.add.graphics().setDepth(DEPTH);
    this.skillsBtn = new Button(scene, INFO_X - 2, INFO_Y + 84, INFO_W + 4, 28, '', handlers.onOpenSkills, {
      variant: 'green',
    }).setDepth(DEPTH);
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

    // Pestaña de daño: total arriba y una fila por Pokémon, de más a menos daño
    const panelBg = drawPanel(scene.add.graphics(), 0, 0, INNER_W, DMG_H);
    const totalLabel = scene.add.text(12, 15, 'DAÑO TOTAL', textStyle(8, '#d03030', null)).setOrigin(0, 0.5);
    this.damageTotal = scene.add.text(INNER_W - 12, 15, '0', textStyle(8)).setOrigin(1, 0.5);
    const line = scene.add.graphics().fillStyle(0xe8c0c0).fillRect(10, 25, INNER_W - 20, 2);
    this.damageEmpty = scene.add
      .text(INNER_W / 2, DMG_H / 2, 'Coloca Pokémon junto al camino para ver cuánto daño hace cada uno.', {
        ...textStyle(8),
        align: 'center',
        wordWrap: { width: INNER_W - 32 },
      })
      .setLineSpacing(6)
      .setOrigin(0.5);
    for (let i = 0; i < DMG_ROWS; i++) {
      this.damageRows.push(new DamageRow(scene, 6, DMG_ROWS_Y + i * DMG_ROW_H, INNER_W - 12, handlers.onSelectTower));
    }
    this.damagePanel = scene.add
      .container(X0 + PAD, DMG_Y, [panelBg, totalLabel, this.damageTotal, line, this.damageEmpty, ...this.damageRows])
      .setDepth(DEPTH + 1);
    this.setTab('shop');
  }

  /** Cambia de pestaña (también con la tecla TAB) */
  setTab(tab: SidebarTab): void {
    this.tab = tab;
    const tabW = INNER_W / TABS.length;
    this.tabGfx.clear();
    TABS.forEach(({ id }, i) => {
      const x = X0 + PAD + i * tabW;
      const active = id === tab;
      const radius = { tl: 5, tr: 5, bl: 0, br: 0 };
      this.tabGfx.fillStyle(active ? 0x404858 : 0x902020).fillRoundedRect(x + 1, TAB_Y, tabW - 2, TAB_H + 4, radius);
      this.tabGfx.fillStyle(active ? 0xf8f8f8 : 0xb03030).fillRoundedRect(x + 3, TAB_Y + 2, tabW - 6, TAB_H + 2, radius);
      this.tabLabels[i].setColor(active ? INK : '#f0c0c0').setShadow(1, 1, active ? '#d0d0c8' : RED_SHADOW, 0, false, true);
    });
    const shop = tab === 'shop';
    this.shopCards.forEach((card) => card.setVisible(shop));
    this.teamHint.setVisible(shop && this.defs.length < SIDEBAR_SHOP_SLOTS);
    this.damagePanel.setVisible(!shop);
    this.infoKey = '';
    this.renderInfo();
  }

  toggleTab(): void {
    this.setTab(this.tab === 'shop' ? 'damage' : 'shop');
  }

  /** Actualiza la clasificación de daño (solo si se está viendo) */
  refreshDamage(towers: Tower[]): void {
    if (this.tab !== 'damage') return;
    const ranked = [...towers].sort((a, b) => b.damageDealt - a.damageDealt);
    const max = Math.max(1, ...ranked.map((t) => t.damageDealt));
    const total = ranked.reduce((sum, t) => sum + t.damageDealt, 0);
    this.damageTotal.setText(formatDamage(total));
    this.damageEmpty.setVisible(!ranked.length);
    // Si no caben todos, la última fila dice cuántos faltan
    const overflow = ranked.length > DMG_ROWS ? ranked.length - (DMG_ROWS - 1) : 0;
    this.damageRows.forEach((row, i) => {
      if (overflow && i === DMG_ROWS - 1) row.showMore(overflow);
      else row.show(ranked[i] ?? null, i + 1, max, ranked[i] === this.selected);
    });
  }

  update(state: HudState, selected: Tower | null): void {
    this.moneyText.setText(`${state.money}`);
    this.livesText.setText(`${state.lives}`);
    this.waveText.setText(`OLEADA ${state.wave}/${state.totalWaves}`);

    this.defs.forEach((def, i) =>
      this.shopCards[i].setStatus(state.money >= priceOf(def.stages[0]), state.placing === def, !state.owned.has(def.id)),
    );

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
        this.evolveBtn.setText(`${verb}\n$${priceOf(next)}`).setEnabled(state.money >= priceOf(next));
      } else {
        this.evolveBtn.setText('NIVEL MAX.').setEnabled(false);
      }
      this.sellBtn.setText(`VENDER\n$${selected.sellValue}`);
      this.killsText.setText(`KO ${selected.kills}`);
      this.drawExp(selected);
      this.targetBtn.setText(`OBJETIVO: ${TARGET_LABELS[selected.targetMode]}`);
      const free = selected.freeSkillPoints;
      this.skillsBtn
        .setText(free ? `HABILIDADES\n¡${free} PUNTO${free > 1 ? 'S' : ''} LIBRE${free > 1 ? 'S' : ''}!` : `HABILIDADES (${selected.skills.size}/${ALL_SKILLS.length})`)
        .setVariant(free ? 'green' : 'gray');
    }
    this.renderInfo();
  }

  /** Posición del icono de una tarjeta de la tienda (de ahí sale la Poké Ball) */
  cardPosition(def: TowerDef): { x: number; y: number } {
    const i = Math.max(0, this.defs.indexOf(def));
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
    const showingTower = !!tower && !this.hovered && this.tab === 'shop';
    this.info.setVisible(this.tab === 'shop');
    this.killsText.setVisible(showingTower);
    this.expLabel.setVisible(showingTower);
    this.expBar.setVisible(showingTower);
    this.targetBtn.setVisible(showingTower);
    this.skillsBtn.setVisible(showingTower);

    const def = this.hovered ?? tower?.def ?? null;
    const stageIndex = this.hovered ? 0 : (tower?.stage ?? 0);
    const level = this.hovered ? def?.stages[0].level : tower?.level;
    const skillCount = this.hovered ? 0 : (tower?.skills.size ?? 0);
    const key = def ? `${this.hovered ? 'shop' : 'tower'}-${def.id}-${stageIndex}-${level}-${skillCount}` : 'help';
    if (key === this.infoKey) return;
    this.infoKey = key;
    this.info.removeAll(true);

    const add = this.scene.add;
    if (!def) {
      this.info.add(add.text(0, 0, helpText(this.defs.length), { ...textStyle(8), wordWrap: { width: INFO_W } }).setLineSpacing(4));
      return;
    }

    const s = def.stages[stageIndex];
    // Con un Pokémon colocado, sus valores reales (con niveles y habilidades)
    const placed = this.hovered ? null : tower;
    const damage = placed ? placed.damage : s.damage;
    const range = placed ? Math.round((placed.range / TILE) * 10) / 10 : s.rangeTiles;
    const perSecond = 1000 / (placed ? placed.fireInterval : s.fireRate);
    const strong = strongAgainst(def.type);
    const immune = uselessAgainst(def.type);
    let matchups = strong.length ? `EFICAZ: ${typeList(strong)}` : '';
    if (immune.length) matchups += `\nINMUNES: ${typeList(immune)}`;

    this.info.add([
      add.text(0, 0, s.name.toUpperCase(), textStyle(8)),
      add.text(INFO_W, 0, `Nv${level}`, textStyle(8)).setOrigin(1, 0),
      addTypeBadge(this.scene, 0, 14, def.type),
      add
        .text(0, 42, `ATQ ${damage}   ALC ${range}\nVEL ${perSecond.toFixed(1)}/s`, textStyle(8))
        .setLineSpacing(6),
    ]);
    // La descripción y los tipos, solo en la tienda: en un Pokémon colocado van sus botones
    if (placed) return;
    this.info.add([
      add
        .text(0, 70, def.description, { ...textStyle(8, '#3060a8', '#c8d8f0'), wordWrap: { width: INFO_W } })
        .setLineSpacing(4),
      add
        .text(0, 96, matchups, { ...textStyle(8, '#a03030', '#f0d0d0'), wordWrap: { width: INFO_W } })
        .setLineSpacing(4),
    ]);
  }
}

/** Fila de la pestaña de daño: posición, icono, nombre, nivel, KO, barra y daño total */
class DamageRow extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly icon: Phaser.GameObjects.Sprite;
  private readonly rank: Phaser.GameObjects.Text;
  private readonly label: Phaser.GameObjects.Text;
  private readonly detail: Phaser.GameObjects.Text;
  private readonly damage: Phaser.GameObjects.Text;
  private readonly more: Phaser.GameObjects.Text;
  private readonly boxW: number;
  private tower: Tower | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, onSelect: (tower: Tower) => void) {
    super(scene, x, y);
    this.boxW = w;
    const h = DMG_ROW_H - 2;
    this.bg = scene.add.graphics();
    this.rank = scene.add.text(9, h / 2, '', textStyle(8, '#7080a0', null)).setOrigin(0.5);
    this.icon = scene.add.sprite(32, h / 2, '__DEFAULT').setScale(0.5);
    this.label = scene.add.text(52, 5, '', textStyle(8));
    this.damage = scene.add.text(w - 6, 5, '', textStyle(8)).setOrigin(1, 0);
    this.bar = scene.add.graphics();
    this.detail = scene.add.text(w - 6, 19, '', textStyle(8, '#7080a0', null)).setOrigin(1, 0);
    this.more = scene.add.text(w / 2, h / 2, '', textStyle(8, '#7080a0', null)).setOrigin(0.5);
    const zone = scene.add
      .zone(0, 0, w, h)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (this.tower) onSelect(this.tower);
      });
    this.add([this.bg, this.rank, this.icon, this.label, this.damage, this.bar, this.detail, this.more, zone]);
  }

  private get parts() {
    return [this.rank, this.icon, this.label, this.damage, this.detail, this.bar];
  }

  show(tower: Tower | null, rank: number, max: number, selected: boolean): void {
    this.tower = tower;
    this.setVisible(!!tower);
    if (!tower) return;
    const h = DMG_ROW_H - 2;
    const w = this.boxW;
    this.more.setVisible(false);
    this.parts.forEach((o) => o.setVisible(true));
    this.bg.clear().fillStyle(selected ? 0xd8e8f8 : rank % 2 ? 0xffffff : 0xf0f2f6).fillRoundedRect(0, 0, w, h, 4);
    if (selected) this.bg.lineStyle(2, 0x3c64c8).strokeRoundedRect(1, 1, w - 2, h - 2, 4);
    this.rank.setText(String(rank)).setColor(rank === 1 && tower.damageDealt > 0 ? '#d09000' : '#7080a0');
    const texture = iconKey(tower.stats.sprite);
    if (this.icon.texture.key !== texture && this.scene.textures.exists(texture)) this.icon.setTexture(texture, 0);
    this.label.setText(tower.stats.name.toUpperCase());
    this.damage.setText(formatDamage(tower.damageDealt));
    this.detail.setText(`Nv${tower.level} KO ${tower.kills}`);
    // Barra proporcional al que más daño ha hecho, del color de su tipo
    const barX = 52;
    const barW = w - barX - this.detail.width - 18;
    const fill = Math.round(barW * (tower.damageDealt / max));
    this.bar.clear().fillStyle(0x404858).fillRect(barX - 1, 20, barW + 2, 8);
    this.bar.fillStyle(0xd8e0e8).fillRect(barX, 21, barW, 6);
    if (fill > 0) this.bar.fillStyle(TYPE_COLORS[tower.def.type]).fillRect(barX, 21, fill, 6);
  }

  /** Última fila cuando no caben todos: "Y 3 MAS..." */
  showMore(count: number): void {
    this.tower = null;
    this.setVisible(true);
    this.bg.clear();
    this.parts.forEach((o) => o.setVisible(false));
    this.more.setVisible(true).setText(`Y ${count} MAS...`);
  }
}
