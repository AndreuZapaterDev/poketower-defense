import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../config';
import { audio } from '../audio/Audio';
import { iconAnim, iconKey } from '../data/sprites';
import { MAX_TEAM_SIZE } from '../data/team';
import { TOWERS, type TowerDef } from '../data/towers';
import { currentTeam, ownedPokemon, setTeam, teamSize } from '../progress';
import { DialogBox } from '../ui/DialogBox';
import {
  MENU_FOOTER_H,
  MENU_HEADER_H,
  POKEBALL_CURSOR,
  addMenuFooter,
  addMenuHeader,
  addTypeBadge,
  drawMenuBackground,
  drawPanel,
  fitCamera,
  textStyle,
} from '../ui/theme';

const MARGIN = 24;
const PARTY_W = 270;
const TOP = MENU_HEADER_H + 16;
const DIALOG_H = 72;
/** Alto máximo de cada hueco del equipo (con 6 se hacen más bajos para que quepan) */
const MAX_SLOT_H = 64;
const BOX_COLS = 6;
const BOX_ROWS = 4;
const BOX_HEADER_H = 40;

/** Casilla elegida: un hueco del equipo o una casilla de la caja */
type Spot = { area: 'party'; index: number } | { area: 'box'; index: number };

/**
 * Equipo al estilo del PC de los juegos: a la izquierda el equipo que se lleva a las partidas y a
 * la derecha la caja con el resto de Pokémon. Pulsar uno lo pasa de un sitio al otro.
 */
export class TeamScene extends Phaser.Scene {
  private team: string[] = [];
  /** Huecos abiertos del equipo (el resto se abren con la mejora AMISTAD) */
  private size = 0;
  private slotH = MAX_SLOT_H;
  private spot: Spot = { area: 'party', index: 0 };
  /** Objetos que se rehacen al cambiar el equipo */
  private dynamic: Phaser.GameObjects.GameObject[] = [];
  private partyPos = { x: 0, y: 0 };
  private boxPos = { x: 0, y: 0, cell: 0 };
  private countText!: Phaser.GameObjects.Text;
  private hand!: Phaser.GameObjects.Container;

  private dialog!: DialogBox;

  constructor() {
    super('Team');
  }

  create(): void {
    fitCamera(this);
    this.team = currentTeam();
    this.size = teamSize();
    this.spot = { area: 'party', index: 0 };
    this.dynamic = [];
    const W = GAME_W;
    const H = GAME_H;

    drawMenuBackground(this);
    addMenuHeader(this, 'EQUIPO', () => this.back());
    addMenuFooter(this, [
      ['FLECHAS', 'Elegir'],
      ['ENTER', 'Mover'],
      ['ESC', 'Volver'],
    ]);

    const dialogY = H - MENU_FOOTER_H - 12 - DIALOG_H;
    const bodyH = dialogY - 12 - TOP;
    this.createParty(MARGIN, TOP, bodyH);
    const bx = MARGIN + PARTY_W + 16;
    this.createBox(bx, TOP, W - MARGIN - bx, bodyH);
    this.dialog = new DialogBox(this, MARGIN, dialogY, W - MARGIN * 2, DIALOG_H);
    this.hand = this.createHand();

    this.refresh();
    this.describe();

    this.input.setDefaultCursor(POKEBALL_CURSOR);
    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-UP', () => this.move(0, -1));
    keyboard?.on('keydown-DOWN', () => this.move(0, 1));
    keyboard?.on('keydown-LEFT', () => this.move(-1, 0));
    keyboard?.on('keydown-RIGHT', () => this.move(1, 0));
    keyboard?.on('keydown-ENTER', () => this.toggle());
    keyboard?.on('keydown-ESC', () => this.back());
    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  // ---------------------------------------------------------------- construcción

  /** Columna del equipo: un hueco con fondo de Poké Ball por cada Pokémon que cabe */
  private createParty(x: number, y: number, h: number): void {
    drawPanel(this.add.graphics(), x, y, PARTY_W, h);
    this.add.text(x + 18, y + 22, 'EQUIPO', textStyle(16)).setOrigin(0, 0.5);
    this.countText = this.add.text(x + PARTY_W - 18, y + 22, '', textStyle(8, '#7080a0', null)).setOrigin(1, 0.5);
    this.partyPos = { x: x + 12, y: y + 44 };
    this.slotH = Math.min(MAX_SLOT_H, Math.floor((h - 44 - 10 + 6) / MAX_TEAM_SIZE) - 6);
    const SLOT_H = this.slotH;
    for (let i = 0; i < MAX_TEAM_SIZE; i++) {
      const sy = this.partyPos.y + i * (SLOT_H + 6);
      this.add
        .zone(this.partyPos.x, sy, PARTY_W - 24, SLOT_H)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => this.setSpot({ area: 'party', index: i }))
        .on('pointerdown', () => {
          this.setSpot({ area: 'party', index: i });
          this.toggle();
        });
    }
  }

  /** Caja del PC: cabecera con su nombre y un fondo de pradera con la cuadrícula de Pokémon */
  private createBox(x: number, y: number, w: number, h: number): void {
    drawPanel(this.add.graphics(), x, y, w, h);
    const g = this.add.graphics();
    // Cabecera de la caja, como en el PC
    g.fillStyle(0x404858).fillRoundedRect(x + 12, y + 10, w - 24, BOX_HEADER_H - 6, 6);
    g.fillStyle(0x78b8f0).fillRoundedRect(x + 14, y + 12, w - 28, BOX_HEADER_H - 10, 5);
    this.add.text(x + w / 2, y + 10 + (BOX_HEADER_H - 6) / 2, 'CAJA 1', textStyle(16, '#f8f8f8', '#305080')).setOrigin(0.5);
    for (const side of [-1, 1]) {
      const ax = x + w / 2 + side * 90;
      const ay = y + 10 + (BOX_HEADER_H - 6) / 2;
      g.fillStyle(0xf8f8f8).fillTriangle(ax + side * 8, ay, ax - side * 4, ay - 7, ax - side * 4, ay + 7);
    }

    // Fondo de pradera: cuadros de dos verdes con briznas de hierba
    const top = y + BOX_HEADER_H + 8;
    const area = { x: x + 12, y: top, w: w - 24, h: y + h - 12 - top };
    g.fillStyle(0x404858).fillRect(area.x - 2, area.y - 2, area.w + 4, area.h + 4);
    const tile = 24;
    for (let ty = 0; ty < area.h; ty += tile) {
      for (let tx = 0; tx < area.w; tx += tile) {
        g.fillStyle(((tx + ty) / tile) % 2 ? 0x88c870 : 0x98d480);
        g.fillRect(area.x + tx, area.y + ty, Math.min(tile, area.w - tx), Math.min(tile, area.h - ty));
      }
    }
    const rng = new Phaser.Math.RandomDataGenerator(['pc-box']);
    g.fillStyle(0x68a850);
    for (let i = 0; i < 60; i++) {
      const gx = area.x + rng.between(4, area.w - 8);
      const gy = area.y + rng.between(4, area.h - 8);
      g.fillRect(gx, gy, 2, 4).fillRect(gx + 3, gy - 1, 2, 5);
    }

    const cell = Math.min(area.w / BOX_COLS, area.h / BOX_ROWS);
    this.boxPos = { x: area.x + (area.w - cell * BOX_COLS) / 2, y: area.y + (area.h - cell * BOX_ROWS) / 2, cell };
    for (let i = 0; i < BOX_COLS * BOX_ROWS; i++) {
      const { cx, cy } = this.boxCell(i);
      this.add
        .zone(cx - cell / 2, cy - cell / 2, cell, cell)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => this.setSpot({ area: 'box', index: i }))
        .on('pointerdown', () => {
          this.setSpot({ area: 'box', index: i });
          this.toggle();
        });
    }
  }

  /** La mano del PC que señala la casilla elegida */
  private createHand(): Phaser.GameObjects.Container {
    const g = this.add.graphics();
    g.fillStyle(0x303030).fillRoundedRect(-9, -2, 18, 16, 5).fillRect(-3, -14, 7, 14);
    g.fillStyle(0xf8f8f8).fillRoundedRect(-7, 0, 14, 12, 4).fillRect(-1, -12, 3, 13);
    g.fillStyle(0xd0d0c8).fillRect(-7, 9, 14, 3);
    const hand = this.add.container(0, 0, [g]).setDepth(30);
    this.tweens.add({ targets: g, y: 4, duration: 320, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return hand;
  }

  // ---------------------------------------------------------------- estado

  private boxCell(i: number) {
    const { x, y, cell } = this.boxPos;
    return { cx: x + (i % BOX_COLS) * cell + cell / 2, cy: y + Math.floor(i / BOX_COLS) * cell + cell / 2 };
  }

  private partySlot(i: number) {
    return { x: this.partyPos.x, y: this.partyPos.y + i * (this.slotH + 6), w: PARTY_W - 24 };
  }

  /**
   * Pokémon de la caja, seguidos desde la primera casilla: los que se tienen y no están en el
   * equipo. Los que aún no se tienen no salen (ni su silueta).
   */
  private boxPokemon(): TowerDef[] {
    const owned = ownedPokemon();
    return TOWERS.filter((t) => owned.has(t.id) && !this.team.includes(t.id));
  }

  /** Pokémon de la casilla elegida (null si está vacía) */
  private defAt(spot: Spot): TowerDef | null {
    if (spot.area === 'party') return TOWERS.find((t) => t.id === this.team[spot.index]) ?? null;
    return this.boxPokemon()[spot.index] ?? null;
  }

  private refresh(): void {
    this.dynamic.forEach((o) => o.destroy());
    this.dynamic = [];
    const keep = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.dynamic.push(o);
      return o;
    };
    this.countText.setText(`${this.team.length}/${this.size}`);

    // Huecos del equipo
    const SLOT_H = this.slotH;
    const iconScale = Math.min(0.8, (SLOT_H - 4) / 64);
    const nameY = SLOT_H >= 56 ? 18 : 11;
    for (let i = 0; i < MAX_TEAM_SIZE; i++) {
      const { x, y, w } = this.partySlot(i);
      const def = TOWERS.find((t) => t.id === this.team[i]);
      const g = keep(this.add.graphics());
      const chosen = this.spot.area === 'party' && this.spot.index === i;
      if (def) {
        g.fillStyle(chosen ? 0xe04040 : 0x404858).fillRoundedRect(x, y, w, SLOT_H, 10);
        g.fillStyle(chosen ? 0xf8c8c0 : 0xd8e8f8).fillRoundedRect(x + 3, y + 3, w - 6, SLOT_H - 6, 8);
        const icon = keep(this.add.sprite(x + 36, y + SLOT_H / 2, iconKey(def.stages[0].sprite)).setScale(iconScale));
        icon.play({ key: iconAnim(def.stages[0].sprite), startFrame: i % 2 });
        keep(this.add.text(x + 70, y + nameY, def.stages[0].name.toUpperCase(), textStyle(8)).setOrigin(0, 0.5));
        keep(addTypeBadge(this, x + 70, y + nameY + 11, def.type));
        keep(this.add.text(x + w - 12, y + nameY, `${i + 1}`, textStyle(8, '#7080a0', null)).setOrigin(1, 0.5));
      } else if (i >= this.size) {
        // Hueco cerrado: se abre con la mejora AMISTAD
        g.fillStyle(chosen ? 0xe04040 : 0x8890a0).fillRoundedRect(x, y, w, SLOT_H, 10);
        g.fillStyle(0xc8ccd4).fillRoundedRect(x + 3, y + 3, w - 6, SLOT_H - 6, 8);
        const lx = x + 30;
        const ly = y + SLOT_H / 2;
        g.lineStyle(3, 0x606878).beginPath().arc(lx, ly - 3, 6, Math.PI, 0).strokePath();
        g.fillStyle(0x606878).fillRoundedRect(lx - 8, ly - 3, 16, 12, 2);
        keep(this.add.text(x + 52, ly, 'MEJORA AMISTAD', textStyle(8, '#707888', null)).setOrigin(0, 0.5));
      } else {
        g.lineStyle(2, chosen ? 0xe04040 : 0xa8b8d0).strokeRoundedRect(x + 1, y + 1, w - 2, SLOT_H - 2, 10);
        keep(this.add.text(x + w / 2, y + SLOT_H / 2, 'VACIO', textStyle(8, '#a8b8d0', null)).setOrigin(0.5));
      }
    }

    // Caja: los Pokémon que se tienen y no van en el equipo, seguidos desde la primera casilla
    this.boxPokemon().forEach((def, i) => {
      const { cx, cy } = this.boxCell(i);
      const icon = keep(this.add.sprite(cx, cy, iconKey(def.stages[0].sprite)).setScale(0.8));
      icon.play({ key: iconAnim(def.stages[0].sprite), startFrame: i % 2 });
    });

    // La mano, sobre la casilla elegida
    if (this.spot.area === 'party') {
      const { x, y } = this.partySlot(this.spot.index);
      this.hand.setPosition(x + 36, y + 8);
    } else {
      const { cx, cy } = this.boxCell(this.spot.index);
      this.hand.setPosition(cx, cy - this.boxPos.cell / 2 + 10);
    }
  }

  /** Texto de abajo: qué hay en la casilla y qué pasa al pulsarla */
  private describe(): void {
    const def = this.defAt(this.spot);
    if (this.spot.area === 'party' && this.spot.index >= this.size) {
      this.typeText('Hueco cerrado. Ábrelo con la mejora AMISTAD en MEJORAS, en el menú principal.');
      return;
    }
    if (!def) {
      this.typeText(
        this.spot.area === 'party'
          ? `Hueco libre del equipo. Elige un Pokémon de la caja para traerlo (caben ${this.size}).`
          : 'Casilla vacía. Aquí esperan los Pokémon que tienes y no llevas en el equipo; consigue más en la TIENDA DE POKéMON.',
      );
      return;
    }
    const name = def.stages[0].name;
    if (this.spot.area === 'party') {
      this.typeText(`${name} está en tu equipo y saldrá en la tienda de la partida. Pulsa para dejarlo en la caja.`);
    } else {
      this.typeText(`${name} está en la caja. Pulsa para llevarlo en tu equipo.`);
    }
  }

  private setSpot(spot: Spot): void {
    if (spot.area === this.spot.area && spot.index === this.spot.index) return;
    this.spot = spot;
    this.refresh();
    this.describe();
  }

  /** Flechas: dentro del equipo arriba y abajo; a la derecha se pasa a la caja y a la izquierda se vuelve */
  private move(dx: number, dy: number): void {
    const spot = this.spot;
    let next: Spot;
    if (spot.area === 'party') {
      if (dx > 0) next = { area: 'box', index: Math.min(spot.index, BOX_ROWS - 1) * BOX_COLS };
      else next = { area: 'party', index: Phaser.Math.Clamp(spot.index + dy, 0, MAX_TEAM_SIZE - 1) };
    } else {
      const col = spot.index % BOX_COLS;
      const row = Math.floor(spot.index / BOX_COLS);
      if (dx < 0 && col === 0) next = { area: 'party', index: Math.min(row, MAX_TEAM_SIZE - 1) };
      else {
        const c = Phaser.Math.Clamp(col + dx, 0, BOX_COLS - 1);
        const r = Phaser.Math.Clamp(row + dy, 0, BOX_ROWS - 1);
        next = { area: 'box', index: r * BOX_COLS + c };
      }
    }
    if (next.area !== spot.area || next.index !== spot.index) audio.play('click');
    this.setSpot(next);
  }

  /** Pasa el Pokémon de la casilla elegida del equipo a la caja o al revés */
  private toggle(): void {
    if (this.spot.area === 'party' && this.spot.index >= this.size) {
      audio.play('error');
      this.typeText('Hueco cerrado. Ábrelo con la mejora AMISTAD en MEJORAS, en el menú principal.');
      return;
    }
    const def = this.defAt(this.spot);
    if (!def) return;
    const name = def.stages[0].name;
    if (this.spot.area === 'party') {
      if (this.team.length <= 1) {
        audio.play('error');
        this.typeText('¡Necesitas al menos un Pokémon en el equipo!');
        return;
      }
      this.team = this.team.filter((id) => id !== def.id);
      this.save(`${name} se ha quedado en la caja.`);
      return;
    }
    if (this.team.includes(def.id)) return;
    if (this.team.length >= this.size) {
      audio.play('error');
      this.typeText(
        this.size < MAX_TEAM_SIZE
          ? `El equipo está lleno (${this.size}). Deja antes a uno en la caja o abre más huecos con la mejora AMISTAD.`
          : `El equipo está lleno (${this.size}). Deja antes a uno en la caja.`,
      );
      return;
    }
    this.team = [...this.team, def.id];
    this.save(`¡${name} se une a tu equipo!`);
  }

  private save(message: string): void {
    setTeam(this.team);
    this.team = currentTeam();
    audio.play('recall');
    this.refresh();
    this.typeText(message);
  }


  /** Escribe en el cuadro de diálogo, letra a letra */
  private typeText(text: string): void {
    this.dialog.say(text);
  }

  private back(): void {
    this.scene.start('MainMenu');
  }
}
