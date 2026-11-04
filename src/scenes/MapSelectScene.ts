import Phaser from 'phaser';
import { audio } from '../audio/Audio';
import { GAME_H, GAME_W, MAP_H, MAP_W } from '../config';
import { DIFFICULTIES, DIFFICULTY_IDS, MAPS, goalName, mapTextureKey, type Difficulty, type MapDef } from '../data/map';
import { POINTS } from '../data/points';
import {
  REGION_FOREST,
  REGION_MOUNTAIN,
  REGION_PLACES,
  REGION_ROADS,
  placeForMap,
  type RegionPlace,
} from '../data/region';
import { wavesFor } from '../data/waves';
import { isCompleted, isMapUnlocked, unlockerName } from '../progress';
import { loadBestWave } from '../save';
import { clearSavedGame, savedGameFor } from '../savedGame';
import { Button, type ButtonVariant } from '../ui/Button';
import { DialogBox } from '../ui/DialogBox';
import {
  MENU_FOOTER_H,
  MENU_HEADER_H,
  POKEBALL_CURSOR,
  WHITE,
  addMenuFooter,
  addMenuHeader,
  drawMenuBackground,
  drawPanel,
  fitCamera,
  textStyle,
} from '../ui/theme';
import type { GameSceneData } from './GameScene';

const BUTTON_VARIANTS: Record<Difficulty, ButtonVariant> = { easy: 'green', hard: 'red' };
const MARGIN = 24;
const TOP = MENU_HEADER_H + 14;
const DIALOG_H = 72;
const BUTTON_H = 40;
/** Barra de arriba del mapa de la región, con el nombre del lugar elegido */
const MAP_BAR_H = 30;

/** Una opción jugable: un mapa con una dificultad */
interface Option {
  map: MapDef;
  difficulty: Difficulty;
}

/**
 * Elegir mapa en el MAPA DE LA REGIÓN, al estilo del Mapa Pueblo de los juegos: a la izquierda
 * la región con sus rutas y ciudades, a la derecha la ficha del lugar elegido con sus dificultades
 */
export class MapSelectScene extends Phaser.Scene {
  /** Mapa elegido (índice de MAPS) y dificultad elegida */
  private mapIndex = 0;
  private diffIndex = 0;
  private starting = false;
  /** Cuadro de "¿continuar la partida guardada?" abierto, con sus objetos para cerrarlo */
  private confirm: Phaser.GameObjects.GameObject[] | null = null;
  private confirmOption: Option | null = null;
  private region = { x: 0, y: 0, w: 0, h: 0 };
  private info = { x: 0, y: 0, w: 0, h: 0 };
  private placeName!: Phaser.GameObjects.Text;
  private marker!: Phaser.GameObjects.Graphics;
  private ball!: Phaser.GameObjects.Image;
  /** Objetos de la ficha del lugar, que se rehacen al cambiar de lugar */
  private infoParts: Phaser.GameObjects.GameObject[] = [];
  private buttonRings: Phaser.GameObjects.Graphics[] = [];
  private dialog!: DialogBox;

  constructor() {
    super('MapSelect');
  }

  create(): void {
    fitCamera(this);
    this.mapIndex = 0;
    this.diffIndex = 0;
    this.starting = false;
    this.confirm = null;
    this.confirmOption = null;
    this.infoParts = [];
    this.buttonRings = [];
    const W = GAME_W;
    const H = GAME_H;

    drawMenuBackground(this);
    addMenuHeader(this, 'MAPA DE LA REGION', () => this.back());
    addMenuFooter(this, [
      ['ARRIBA/ABAJO', 'Lugar'],
      ['IZQ/DCHA', 'Dificultad'],
      ['ENTER', 'Jugar'],
      ['ESC', 'Volver'],
    ]);

    const dialogY = H - MENU_FOOTER_H - 12 - DIALOG_H;
    const bodyH = dialogY - 12 - TOP;
    const regionW = Math.round((W - MARGIN * 2 - 16) * 0.46);
    this.region = { x: MARGIN, y: TOP, w: regionW, h: bodyH };
    this.info = { x: MARGIN + regionW + 16, y: TOP, w: W - MARGIN * 2 - regionW - 16, h: bodyH };
    this.drawRegion();
    drawPanel(this.add.graphics(), this.info.x, this.info.y, this.info.w, this.info.h);
    this.dialog = new DialogBox(this, MARGIN, dialogY, W - MARGIN * 2, DIALOG_H);

    // Empieza en el primer mapa abierto que aún no se ha completado (o en el último abierto)
    const open = MAPS.map((m, i) => [m, i] as const).filter(([m]) => isMapUnlocked(m));
    const pending = open.find(([m]) => !DIFFICULTY_IDS.some((d) => isCompleted(m.id, d)));
    this.mapIndex = (pending ?? open[open.length - 1] ?? [MAPS[0], 0])[1];
    this.refresh();

    this.input.setDefaultCursor(POKEBALL_CURSOR);
    const keyboard = this.input.keyboard;
    // Arriba es hacia el norte: el siguiente mapa de la aventura
    keyboard?.on('keydown-UP', () => !this.confirm && this.moveMap(1));
    keyboard?.on('keydown-DOWN', () => !this.confirm && this.moveMap(-1));
    keyboard?.on('keydown-LEFT', () => !this.confirm && this.moveDifficulty(-1));
    keyboard?.on('keydown-RIGHT', () => !this.confirm && this.moveDifficulty(1));
    keyboard?.on('keydown-ENTER', () => {
      if (this.confirm && this.confirmOption) this.start(this.confirmOption, true);
      else this.play(this.option());
    });
    keyboard?.on('keydown-ESC', () => (this.confirm ? this.closeConfirm() : this.back()));
    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  private option(): Option {
    return { map: MAPS[this.mapIndex], difficulty: DIFFICULTY_IDS[this.diffIndex] };
  }

  // ---------------------------------------------------------------- mapa de la región

  /** Posición en pantalla de un punto del mapa de la región (coordenadas de 0 a 1) */
  private at(x: number, y: number): { x: number; y: number } {
    const r = this.region;
    const top = r.y + MAP_BAR_H + 8;
    return { x: r.x + 10 + x * (r.w - 20), y: top + y * (r.y + r.h - 10 - top) };
  }

  private drawRegion(): void {
    const r = this.region;
    drawPanel(this.add.graphics(), r.x, r.y, r.w, r.h);
    const g = this.add.graphics();
    // Barra de arriba con el nombre del lugar, como en el Mapa Pueblo
    g.fillStyle(0x404858).fillRoundedRect(r.x + 8, r.y + 8, r.w - 16, MAP_BAR_H, 6);
    g.fillStyle(0x305890).fillRoundedRect(r.x + 10, r.y + 10, r.w - 20, MAP_BAR_H - 4, 5);
    this.placeName = this.add.text(r.x + r.w / 2, r.y + 8 + MAP_BAR_H / 2, '', textStyle(8, WHITE, '#203860')).setOrigin(0.5);

    // Mar con cuadrícula
    const sea = { x: r.x + 10, y: r.y + MAP_BAR_H + 8, w: r.w - 20, h: r.h - MAP_BAR_H - 18 };
    g.fillStyle(0x4070c0).fillRect(sea.x, sea.y, sea.w, sea.h);
    g.lineStyle(1, 0x5888d8, 0.6);
    for (let x = sea.x; x <= sea.x + sea.w; x += 16) g.lineBetween(x, sea.y, x, sea.y + sea.h);
    for (let y = sea.y; y <= sea.y + sea.h; y += 16) g.lineBetween(sea.x, y, sea.x + sea.w, y);

    // Tierra: un continente con la costa algo irregular, y la playa de Pueblo Paleta
    const land = this.at(0.05, 0.03);
    const landEnd = this.at(0.95, 0.93);
    g.fillStyle(0x305828).fillRoundedRect(land.x - 2, land.y - 2, landEnd.x - land.x + 4, landEnd.y - land.y + 4, 18);
    g.fillStyle(0x70b850).fillRoundedRect(land.x, land.y, landEnd.x - land.x, landEnd.y - land.y, 16);
    const beach = this.at(0.2, 0.9);
    const beachEnd = this.at(0.55, 0.95);
    g.fillStyle(0xe8d898).fillRoundedRect(beach.x, beach.y, beachEnd.x - beach.x, beachEnd.y - beach.y, 6);
    // Manchas de hierba más oscura para dar textura
    const rng = new Phaser.Math.RandomDataGenerator(['region']);
    g.fillStyle(0x60a848);
    for (let i = 0; i < 40; i++) {
      const p = this.at(rng.realInRange(0.08, 0.92), rng.realInRange(0.06, 0.88));
      g.fillRect(Math.round(p.x), Math.round(p.y), 4, 2);
    }

    // Bosque Verde y Monte Moon (decorado)
    const f0 = this.at(REGION_FOREST.x, REGION_FOREST.y);
    const f1 = this.at(REGION_FOREST.x + REGION_FOREST.w, REGION_FOREST.y + REGION_FOREST.h);
    g.fillStyle(0x386830).fillRoundedRect(f0.x, f0.y, f1.x - f0.x, f1.y - f0.y, 8);
    for (let i = 0; i < 14; i++) {
      const tx = f0.x + 8 + (i % 5) * ((f1.x - f0.x - 16) / 4);
      const ty = f0.y + 10 + Math.floor(i / 5) * ((f1.y - f0.y - 18) / 2);
      g.fillStyle(0x285020).fillTriangle(tx, ty - 7, tx - 6, ty + 5, tx + 6, ty + 5);
    }
    const m = this.at(REGION_MOUNTAIN.x, REGION_MOUNTAIN.y);
    g.fillStyle(0x705838).fillTriangle(m.x, m.y - 18, m.x - 22, m.y + 10, m.x + 22, m.y + 10);
    g.fillStyle(0x907050).fillTriangle(m.x, m.y - 18, m.x - 8, m.y - 4, m.x + 6, m.y - 6);

    // Caminos: los que existen, en tierra clara; los futuros, punteados
    for (const road of REGION_ROADS) {
      const a = this.at(...road.from);
      const b = this.at(...road.to);
      if (road.future) {
        const steps = Math.max(1, Math.floor(Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y) / 10));
        g.fillStyle(0xd8c890);
        for (let i = 0; i <= steps; i += 2) g.fillRect(a.x + ((b.x - a.x) * i) / steps - 2, a.y + ((b.y - a.y) * i) / steps - 2, 5, 5);
      } else {
        g.lineStyle(10, 0x806838).lineBetween(a.x, a.y, b.x, b.y);
        g.lineStyle(6, 0xf0d890).lineBetween(a.x, a.y, b.x, b.y);
      }
    }

    // Pueblos y ciudades (cuadros), y las rutas que se juegan (círculos sobre el camino)
    for (const place of REGION_PLACES) this.drawPlace(g, place);

    // Cursor: recuadro rojo que parpadea y una Poké Ball que bota encima
    this.marker = this.add.graphics();
    this.tweens.add({ targets: this.marker, alpha: 0.35, duration: 380, yoyo: true, repeat: -1 });
    this.ball = this.add.image(0, 0, 'pokeball').setScale(1.3);
    this.tweens.add({ targets: this.ball, y: '-=6', duration: 320, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private drawPlace(g: Phaser.GameObjects.Graphics, place: RegionPlace): void {
    const p = this.at(place.x, place.y);
    const def = place.mapId ? MAPS.find((m) => m.id === place.mapId) : undefined;
    const unlocked = def ? isMapUnlocked(def) : true;
    const done = def ? DIFFICULTY_IDS.some((d) => isCompleted(def.id, d)) : false;
    if (place.kind === 'route') {
      g.fillStyle(0x303030).fillCircle(p.x, p.y, 10);
      g.fillStyle(!unlocked ? 0x9098a8 : done ? 0xf8c830 : 0xf8f8f8).fillCircle(p.x, p.y, 8);
    } else {
      // Ciudad: cuadro rojo con tejado; si tiene gimnasio, cuadro algo mayor
      const s = place.kind === 'city' ? 11 : 8;
      g.fillStyle(0x303030).fillRect(p.x - s - 2, p.y - s + 2, s * 2 + 4, s * 2 - 2);
      g.fillStyle(!unlocked ? 0x9098a8 : done ? 0xf8c830 : 0xe04040).fillRect(p.x - s, p.y - s + 4, s * 2, s * 2 - 6);
      g.fillStyle(0xf8f8f8, 0.6).fillRect(p.x - s, p.y - s + 4, s * 2, 3);
    }
    if (def && !unlocked) {
      // Candado pequeño
      g.lineStyle(2, 0x303030).beginPath().arc(p.x + 14, p.y - 10, 4, Math.PI, 0).strokePath();
      g.fillStyle(0x303030).fillRect(p.x + 9, p.y - 10, 10, 8);
    }
    if (def) {
      // Se puede pulsar para elegirlo
      const index = MAPS.indexOf(def);
      this.add
        .zone(p.x - 16, p.y - 16, 32, 32)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.selectMap(index));
    }
    if (place.kind !== 'route') {
      this.add
        .text(p.x + 18, p.y, place.name, textStyle(8, '#f8f8f8', '#203820'))
        .setOrigin(0, 0.5)
        .setAlpha(def ? 1 : 0.8);
    }
  }

  // ---------------------------------------------------------------- ficha del lugar

  private refresh(): void {
    const { map, difficulty } = this.option();
    const place = placeForMap(map.id);
    this.placeName.setText(place ? `${place.name}${place.kind === 'city' ? ' - GIMNASIO' : ''}` : map.name);
    if (place) {
      const p = this.at(place.x, place.y);
      this.marker.clear().lineStyle(3, 0xf83030).strokeRect(p.x - 16, p.y - 16, 32, 32);
      this.tweens.killTweensOf(this.ball);
      this.ball.setPosition(p.x, p.y - 30);
      this.tweens.add({ targets: this.ball, y: p.y - 36, duration: 320, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    this.drawInfo(map);
    this.buttonRings.forEach((ring, i) => ring.setVisible(i === this.diffIndex));
    this.describe(map, difficulty);
  }

  /** Ficha del lugar: nombre, vista previa del mapa, las dos dificultades con su récord y los puntos */
  private drawInfo(map: MapDef): void {
    this.infoParts.forEach((o) => o.destroy());
    this.infoParts = [];
    this.buttonRings = [];
    const keep = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.infoParts.push(o);
      return o;
    };
    const { x, y, w, h } = this.info;
    const unlocked = isMapUnlocked(map);

    keep(this.add.text(x + 18, y + 22, map.name, textStyle(16)).setOrigin(0, 0.5));
    if (map.subtitle) keep(this.add.text(x + 18, y + 44, map.subtitle, textStyle(8, '#7080a0', null)).setOrigin(0, 0.5));

    // Vista previa: la textura del mapa, reducida; oscurecida y con candado si está cerrado
    const maxW = w - 36;
    const maxH = h - 186;
    const scale = Math.min(maxW / MAP_W, maxH / MAP_H);
    const pw = MAP_W * scale;
    const ph = MAP_H * scale;
    const px = x + (w - pw) / 2;
    const py = y + 58;
    const frame = keep(this.add.graphics());
    frame.fillStyle(0x404858).fillRect(px - 3, py - 3, pw + 6, ph + 6);
    const preview = keep(this.add.image(px, py, mapTextureKey(map.id)).setOrigin(0).setScale(scale));
    if (!unlocked) {
      preview.setTint(0x505868);
      const cx = px + pw / 2;
      const cy = py + ph / 2;
      drawPadlock(keep(this.add.graphics({ x: cx, y: cy - 16 })));
      keep(this.add.text(cx, cy + 30, 'BLOQUEADO', textStyle(16, '#f8f8f8', '#202020')).setOrigin(0.5));
      keep(this.add.text(cx, cy + 52, `Supera ${unlockerName(map)}`, textStyle(8, '#f8f8f8', '#202020')).setOrigin(0.5));
    }

    // Un botón por dificultad, con su récord debajo
    const by = py + ph + 18;
    const bw = (w - 36 - 12) / DIFFICULTY_IDS.length;
    DIFFICULTY_IDS.forEach((difficulty, j) => {
      const { label, startLives, startMoney } = DIFFICULTIES[difficulty];
      const bx = x + 18 + j * (bw + 12);
      const ring = keep(this.add.graphics());
      ring.lineStyle(3, 0xffcb05).strokeRoundedRect(bx - 3, by - 3, bw + 6, BUTTON_H + 6, 8);
      this.tweens.add({ targets: ring, alpha: 0.45, duration: 500, yoyo: true, repeat: -1 });
      this.buttonRings.push(ring);
      keep(
        new Button(this, bx, by, bw, BUTTON_H, `${label}\n${startLives} VIDAS  $${startMoney}`, () => this.play({ map, difficulty }), {
          variant: BUTTON_VARIANTS[difficulty],
          onHover: () => this.selectDifficulty(j),
        }).setEnabled(unlocked),
      );
      if (!unlocked) return;
      const best = loadBestWave(map.id, difficulty);
      const total = wavesFor(map.id, difficulty).length;
      const done = best >= total;
      const saved = savedGameFor(map.id, difficulty);
      let record = done ? 'COMPLETADO' : best > 0 ? `RECORD ${best}/${total}` : 'SIN JUGAR';
      if (saved) record = `GUARDADA: OLEADA ${saved.waveIndex + 2}`;
      const recordText = keep(
        this.add
          .text(bx + bw / 2, by + BUTTON_H + 14, record, textStyle(8, saved ? '#3870c8' : done ? '#d09000' : undefined))
          .setOrigin(0.5),
      );
      if (done && !saved) keep(this.add.image(recordText.x - recordText.width / 2 - 10, recordText.y, 'pokeball').setScale(0.75));
    });

    const points = POINTS[DIFFICULTY_IDS[this.diffIndex]];
    keep(
      this.add
        .text(x + w / 2, y + h - 18, `PUNTOS: ${points.perWave} POR OLEADA, +${points.victory} AL GANAR`, textStyle(8, '#d09000', null))
        .setOrigin(0.5),
    );
  }

  /** Cuadro de abajo: qué hay que hacer en el mapa y con qué se empieza */
  private describe(map: MapDef, difficulty: Difficulty): void {
    if (!isMapUnlocked(map)) {
      this.dialog.say(`${map.name} está bloqueado. Completa ${unlockerName(map)} (en cualquier dificultad) para abrirlo.`);
      return;
    }
    const def = DIFFICULTIES[difficulty];
    this.dialog.say(
      `${def.label}: ${wavesFor(map.id, difficulty).length} oleadas hasta ${goalName(map)}. Empiezas con ${def.startLives} vidas y ` +
        `$${def.startMoney}; los enemigos ganan un ${Math.round(def.hpGrowth * 100)}% de vida por oleada.`,
    );
  }

  // ---------------------------------------------------------------- selección

  private selectMap(index: number): void {
    if (this.confirm || index === this.mapIndex) return;
    this.mapIndex = index;
    audio.play('click');
    this.refresh();
  }

  private moveMap(step: number): void {
    const next = Phaser.Math.Clamp(this.mapIndex + step, 0, MAPS.length - 1);
    this.selectMap(next);
  }

  private selectDifficulty(index: number): void {
    if (this.confirm || index === this.diffIndex) return;
    this.diffIndex = index;
    this.refresh();
  }

  private moveDifficulty(step: number): void {
    const next = Phaser.Math.Clamp(this.diffIndex + step, 0, DIFFICULTY_IDS.length - 1);
    if (next !== this.diffIndex) audio.play('click');
    this.selectDifficulty(next);
  }

  // ---------------------------------------------------------------- jugar

  private play(option: Option): void {
    const { map, difficulty } = option;
    if (this.starting || this.confirm) return;
    if (!isMapUnlocked(map)) {
      audio.play('error');
      this.cameras.main.shake(120, 0.004);
      return;
    }
    if (savedGameFor(map.id, difficulty)) {
      this.openConfirm(option);
      return;
    }
    this.start(option, false);
  }

  /** Pregunta si se sigue con la partida guardada o se empieza una nueva (que la borra) */
  private openConfirm(option: Option): void {
    const saved = savedGameFor(option.map.id, option.difficulty);
    if (!saved) return;
    audio.play('click');
    this.confirmOption = option;
    const W = GAME_W;
    const w = 440;
    const h = 170;
    const x = (W - w) / 2;
    const y = (GAME_H - h) / 2;
    const overlay = this.add.rectangle(0, 0, W, GAME_H, 0x000000, 0.55).setOrigin(0).setDepth(100).setInteractive();
    const panel = drawPanel(this.add.graphics().setDepth(101), x, y, w, h);
    const title = this.add.text(W / 2, y + 28, 'PARTIDA GUARDADA', textStyle(16)).setOrigin(0.5).setDepth(102);
    const total = wavesFor(saved.mapId, saved.difficulty).length;
    const info = this.add
      .text(
        W / 2,
        y + 62,
        `${option.map.name} - ${DIFFICULTIES[saved.difficulty].label}\nOleada ${saved.waveIndex + 2} de ${total} · ${saved.towers.length} Pokémon · ${saved.lives} vidas · $${saved.money}`,
        { ...textStyle(8), align: 'center' },
      )
      .setLineSpacing(8)
      .setOrigin(0.5)
      .setDepth(102);
    const bw = 170;
    const keep = new Button(this, W / 2 - bw - 8, y + h - 56, bw, 36, 'CONTINUAR', () => this.start(option, true), {
      variant: 'green',
    }).setDepth(102);
    const fresh = new Button(this, W / 2 + 8, y + h - 56, bw, 36, 'NUEVA', () => this.start(option, false), {
      variant: 'red',
    }).setDepth(102);
    this.confirm = [overlay, panel, title, info, keep, fresh];
  }

  private closeConfirm(): void {
    this.confirm?.forEach((o) => o.destroy());
    this.confirm = null;
    this.confirmOption = null;
  }

  /** Empieza la partida; sin `resume`, la partida guardada de esa opción se borra */
  private start({ map, difficulty }: Option, resume: boolean): void {
    if (this.starting) return;
    if (!resume && savedGameFor(map.id, difficulty)) clearSavedGame();
    this.starting = true;
    audio.unlock();
    audio.play('evolve');
    this.cameras.main.flash(200, 255, 255, 255);
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
      this.scene.start('Game', { mapId: map.id, difficulty, resume } satisfies GameSceneData),
    );
  }

  private back(): void {
    if (this.starting) return;
    this.scene.start('MainMenu');
  }
}

/** Candado de 32 px centrado en (0, 0) para los mapas bloqueados */
function drawPadlock(g: Phaser.GameObjects.Graphics): void {
  g.lineStyle(6, 0x202020).beginPath().arc(0, -6, 10, Math.PI, 0).strokePath();
  g.lineStyle(3, 0xc8ccd8).beginPath().arc(0, -6, 10, Math.PI, 0).strokePath();
  g.fillStyle(0x202020).fillRoundedRect(-16, -8, 32, 26, 4);
  g.fillStyle(0xf0c040).fillRoundedRect(-14, -6, 28, 22, 3);
  g.fillStyle(0xc89020).fillRect(-14, 10, 28, 6);
  g.fillStyle(0x202020).fillCircle(0, 2, 4).fillRect(-1.5, 2, 3, 8);
}
