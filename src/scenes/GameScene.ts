import Phaser from 'phaser';
import { audio, type SfxName } from '../audio/Audio';
import { GAME_H, GAME_W, MAP_H, MAP_W, SCALE, TILE } from '../config';
import { ENEMIES, type EnemyDef } from '../data/enemies';
import {
  DIFFICULTIES,
  RouteMap,
  difficultyById,
  goalName,
  mapById,
  mapTextureKey,
  tileCenter,
  tileKey,
  type Difficulty,
  type DifficultyDef,
  type MapDef,
} from '../data/map';
import {
  BURN,
  FLAME_WIDTH,
  SLOW,
  SPLASH_RADIUS,
  TOWERS,
  priceOf,
  setPriceFactor,
  type TowerAbility,
  type TowerDef,
} from '../data/towers';
import type { UpgradeEffects } from '../data/upgrades';
import { SPECIAL } from '../data/skills';
import { TYPE_COLORS, effectiveness } from '../data/types';
import { battleSprite, feetAnchor } from '../data/sprites';
import { wavesFor, type Wave } from '../data/waves';
import { Enemy } from '../objects/Enemy';
import { Projectile } from '../objects/Projectile';
import { TOWER_FEET_Y, Tower, towerScale } from '../objects/Tower';
import { currentTeam, currentUpgradeEffects, isMapUnlocked, lockedMaps, ownedItems, ownedPokemon } from '../progress';
import { plateMultiplier } from '../data/items';
import { scoreGame } from '../data/points';
import { addPoints, loadBestWave, saveBestWave } from '../save';
import { clearSavedGame, saveGame, savedGameFor, type SavedGame } from '../savedGame';
import { BossBar } from '../ui/BossBar';
import { Button } from '../ui/Button';
import { DamageNumbers, type DamageKind } from '../ui/DamageNumbers';
import { MessageBox } from '../ui/MessageBox';
import { Sidebar } from '../ui/Sidebar';
import { SkillPanel } from '../ui/SkillPanel';
import { VolumeSlider } from '../ui/VolumeSlider';
import { WavePreview } from '../ui/WavePreview';
import { POKEBALL_CURSOR, addSectionLabel, caps, drawPanel, fitCamera, textStyle } from '../ui/theme';
import { addAmbient } from '../world/Ambient';
import { Effects } from '../world/Effects';

interface SpawnEntry {
  time: number;
  def: EnemyDef;
}

const PROJECTILE_SPEED = 400 * SCALE;
const SPEEDS = [1, 2, 3];
/** Cada cuántos milisegundos se actualiza la pestaña de daño de la barra lateral */
const DAMAGE_REFRESH_MS = 250;
const CRIT_CHANCE = 1 / 16;
const CRIT_MULT = 1.5;
const PROJECTILES: Partial<Record<TowerAbility, { texture: string; trail: 'fire' | 'water' }>> = {
  burn: { texture: 'ember', trail: 'fire' },
  splash: { texture: 'bubble', trail: 'water' },
};
const ATTACK_SFX: Record<TowerAbility, SfxName> = {
  burn: 'ember',
  splash: 'bubble',
  slow: 'leaf',
  melee: 'punch',
  flamethrower: 'flame',
};

export interface GameSceneData {
  mapId?: string;
  difficulty?: Difficulty;
  /** Continuar la partida guardada de ese mapa y dificultad, si la hay */
  resume?: boolean;
}

export class GameScene extends Phaser.Scene {
  private map!: RouteMap;
  private difficultyId: Difficulty = 'easy';
  private difficulty!: DifficultyDef;
  private money = 0;
  private lives = 0;
  private waveIndex = -1;
  private waveActive = false;
  private waveTime = 0;
  private spawnQueue: SpawnEntry[] = [];
  private enemies: Enemy[] = [];
  private towers = new Map<string, Tower>();
  private projectiles: Projectile[] = [];
  private placing: TowerDef | null = null;
  private selected: Tower | null = null;
  private speed = 1;
  private paused = false;
  private gameOver = false;
  private confirmingReset = false;
  /** Pokémon salvajes derrotados en la partida, para el resumen final */
  private defeated = 0;
  /** Récord del mapa y la dificultad al empezar, para saber si se ha batido */
  private startBest = 0;
  private damageRefresh = 0;
  /** Mejoras de la cuenta que se aplican en esta partida */
  private upgrades!: UpgradeEffects;
  /** Objetos comprados en la tienda de la cuenta */
  private items = new Set<string>();
  /** Pokémon que tiene la cuenta: solo esos se pueden colocar */
  private owned = new Set<string>();
  /** Equipo elegido en la pantalla EQUIPO: son los que salen en la tienda de la barra lateral */
  private team: TowerDef[] = [];
  /** Oleadas de este mapa en esta dificultad */
  private waves: Wave[] = [];
  /** Mapas cerrados al empezar, para avisar al final de los que se han abierto */
  private lockedAtStart: MapDef[] = [];
  /** Hasta que la partida está montada no se guarda nada (ver saveCheckpoint) */
  private ready = false;
  /**
   * En pantallas táctiles no hay "pasar por encima": el primer toque en una casilla enseña dónde
   * quedaría el Pokémon y su alcance, y el segundo en la misma casilla lo coloca
   */
  private touchPreview: string | null = null;
  /** Árbol de habilidades abierto (pausa el juego mientras tanto) */
  private skillPanel: SkillPanel | null = null;
  private pausedBeforeSkills = false;

  private sidebar!: Sidebar;
  private messages!: MessageBox;
  private bossBar!: BossBar;
  private wavePreview!: WavePreview;
  private effects!: Effects;
  private damageNumbers!: DamageNumbers;
  private rangeGfx!: Phaser.GameObjects.Graphics;
  private selectionRing!: Phaser.GameObjects.Graphics;
  private ghost!: Phaser.GameObjects.Image;
  /** Solo existe mientras el juego está en pausa (así sus botones no se pueden pulsar ocultos) */
  private pausePanel: Phaser.GameObjects.Container | null = null;
  private leaving = false;

  constructor() {
    super('Game');
  }

  create(data: GameSceneData): void {
    fitCamera(this);
    // El estado se reinicia aquí porque scene.restart() reutiliza la misma instancia
    this.ready = false;
    this.touchPreview = null;
    this.skillPanel = null;
    this.map = new RouteMap(mapById(data?.mapId));
    this.difficultyId = difficultyById(data?.difficulty);
    this.difficulty = DIFFICULTIES[this.difficultyId];
    this.waves = wavesFor(this.map.def.id, this.difficultyId);
    // Las mejoras de la cuenta: más dinero y vidas al empezar y el descuento de la tienda
    this.upgrades = currentUpgradeEffects();
    this.items = ownedItems();
    this.owned = ownedPokemon();
    this.team = currentTeam()
      .map((id) => TOWERS.find((t) => t.id === id))
      .filter((d): d is TowerDef => !!d);
    setPriceFactor(this.upgrades.priceFactor);
    this.money = this.difficulty.startMoney + this.upgrades.startMoney;
    this.lives = this.difficulty.startLives + this.upgrades.extraLives;
    this.waveIndex = -1;
    this.waveActive = false;
    this.waveTime = 0;
    this.spawnQueue = [];
    this.enemies = [];
    this.towers = new Map();
    this.projectiles = [];
    this.placing = null;
    this.selected = null;
    this.speed = 1;
    this.paused = false;
    this.gameOver = false;
    this.confirmingReset = false;
    this.defeated = 0;
    this.startBest = loadBestWave(this.map.def.id, this.difficultyId);
    this.lockedAtStart = lockedMaps();

    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.add.image(0, 0, mapTextureKey(this.map.def.id)).setOrigin(0).setDepth(0);
    addAmbient(this, this.map.def);

    this.rangeGfx = this.add.graphics().setDepth(5);
    this.selectionRing = this.add.graphics().setDepth(9).setVisible(false);
    this.selectionRing.lineStyle(2, 0xffffff).strokeEllipse(0, 9, 34, 14);
    this.tweens.add({ targets: this.selectionRing, alpha: 0.3, duration: 450, yoyo: true, repeat: -1 });
    this.ghost = this.add.image(0, 0, 'px').setOrigin(0.5, 1).setDepth(15).setAlpha(0.7).setVisible(false);
    this.pausePanel = null;
    this.leaving = false;

    this.effects = new Effects(this);
    this.damageNumbers = new DamageNumbers(this);
    this.messages = new MessageBox(this);
    this.bossBar = new BossBar(this);
    this.wavePreview = new WavePreview(this);
    this.sidebar = new Sidebar(this, {
      onBuy: (def) => this.startPlacing(def),
      onEvolve: () => this.evolveSelected(),
      onSell: () => this.sellSelected(),
      onCycleTarget: () => this.cycleTarget(),
      onNextWave: () => this.startWave(),
      onTogglePause: () => this.togglePause(),
      onToggleSpeed: () => this.toggleSpeed(),
      onToggleMute: () => this.toggleMute(),
      onReset: () => this.confirmReset(),
      onSelectTower: (tower) => this.select(tower),
      onOpenSkills: () => this.toggleSkills(),
    }, this.team);

    this.input.setDefaultCursor(POKEBALL_CURSOR);
    this.bindInput();
    audio.setBattle(false);
    audio.startMusic();

    this.showLocation(this.map.def.name, this.difficulty.label);
    const saved = data?.resume ? savedGameFor(this.map.def.id, this.difficultyId) : null;
    if (saved) {
      this.restoreGame(saved);
    } else {
      this.wavePreview.show(1, this.waves[0]);
      this.messages.show(`¡Los Pokémon salvajes van hacia ${goalName(this.map.def)}! Coloca tus Pokémon y pulsa ¡LUCHAR!`);
    }
    this.ready = true;
    this.refreshUi();
  }

  update(_time: number, delta: number): void {
    if (this.gameOver || this.paused) return;
    // Limitar delta evita saltos enormes al volver a una pestaña inactiva
    const dt = (Math.min(delta, 100) / 1000) * this.speed;

    this.spawnEnemies(dt);
    for (const enemy of this.enemies) {
      enemy.tick(dt);
      if (enemy.burnReport > 0) {
        this.damageNumbers.show(enemy.x, enemy.aimY - 10, enemy.burnReport, 'burn');
        enemy.burnReport = 0;
      }
    }
    this.updateTowers(dt);

    for (const p of this.projectiles) p.tick(dt);
    this.projectiles = this.projectiles.filter((p) => {
      if (p.done) p.destroy();
      return !p.done;
    });

    this.removeFinishedEnemies();
    this.damageRefresh -= delta;
    if (this.damageRefresh <= 0) this.refreshDamage();
    this.bossBar.update(this.enemies.find((e) => e.def.boss && e.alive) ?? null, dt);
    if (this.gameOver) return;
    this.checkWaveComplete();
  }

  private bindInput(): void {
    this.input.mouse?.disableContextMenu();
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerdown', this.onPointerDown, this);

    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    keyboard.on('keydown-ESC', () => {
      this.cancelPlacing();
      this.select(null);
    });
    keyboard.on('keydown-SPACE', () => this.startWave());
    keyboard.on('keydown-P', () => this.togglePause());
    keyboard.on('keydown-V', () => this.toggleSpeed());
    keyboard.on('keydown-M', () => this.toggleMute());
    keyboard.on('keydown-T', () => this.cycleTarget());
    keyboard.on('keydown-E', () => this.evolveSelected());
    keyboard.on('keydown-R', () => this.confirmReset());
    keyboard.on('keydown-H', () => this.toggleSkills());
    // TAB cambia de pestaña en la barra lateral; se captura para que el navegador no mueva el foco
    keyboard.addCapture('TAB');
    keyboard.on('keydown-TAB', () => {
      this.sidebar.toggleTab();
      this.refreshDamage();
    });
    const digits = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
    this.team.forEach((def, i) => keyboard.on(`keydown-${digits[i]}`, () => this.startPlacing(def)));
  }

  // ---------------------------------------------------------------- oleadas

  private startWave(): void {
    if (this.waveActive || this.gameOver || this.waveIndex >= this.waves.length - 1) return;
    this.closeSkills();
    if (this.paused) this.togglePause();
    this.saveCheckpoint();
    this.waveIndex++;
    this.waveActive = true;
    this.waveTime = 0;
    this.spawnQueue = this.waves[this.waveIndex]
      .flatMap((group) =>
        Array.from({ length: group.count }, (_, i) => ({
          time: (group.delay ?? 0) + i * group.interval,
          def: ENEMIES[group.enemy],
        })),
      )
      .sort((a, b) => a.time - b.time);

    this.wavePreview.hide();
    this.battleTransition();
    audio.play('battle');
    audio.setBattle(true);
    const hasBoss = this.spawnQueue.some((e) => e.def.boss);
    const n = this.waveIndex + 1;
    this.messages.show(
      hasBoss ? `¡Oleada ${n}! ¡Cuidado, se acerca un Pokémon muy poderoso!` : `¡Oleada ${n}! ¡Pokémon salvajes a la vista!`,
    );
    this.refreshUi();
  }

  private spawnEnemies(dt: number): void {
    if (!this.waveActive) return;
    this.waveTime += dt * 1000;
    const hpMultiplier = 1 + this.difficulty.hpGrowth * this.waveIndex;
    const level = 3 + this.waveIndex * 4;
    while (this.spawnQueue.length && this.spawnQueue[0].time <= this.waveTime) {
      const { def } = this.spawnQueue.shift()!;
      this.enemies.push(new Enemy(this, def, hpMultiplier, def.boss ? level + 15 : level, this.map.waypoints));
      if (def.boss) {
        this.cameras.main.shake(300, 0.006);
        audio.play('boss');
        this.messages.show(`¡Un ${def.name.toUpperCase()} salvaje apareció!`);
      }
    }
  }

  private removeFinishedEnemies(): void {
    let changed = false;
    this.enemies = this.enemies.filter((enemy) => {
      if (enemy.alive) return true;
      if (enemy.dead) {
        const reward = Math.round(enemy.def.reward * (enemy.lastAttacker?.skillFx.lootMult ?? 1));
        this.money += reward;
        this.defeated++;
        if (enemy.lastAttacker) this.rewardExp(enemy.lastAttacker, enemy.def.reward);
        this.effects.poof(enemy.x, enemy.aimY);
        this.effects.floatText(enemy.x, enemy.y + 10, `+$${reward}`, '#ffe066');
        audio.play('faint');
      } else {
        this.lives = Math.max(0, this.lives - enemy.def.damage);
        this.cameras.main.shake(150, 0.005);
        this.effects.burst(enemy.x, enemy.y, 0xe04040, 8);
        audio.play('leak');
      }
      enemy.vanish();
      changed = true;
      return false;
    });
    if (!changed) return;
    this.refreshUi();
    if (this.lives <= 0) this.endGame(false);
  }

  private checkWaveComplete(): void {
    if (!this.waveActive || this.spawnQueue.length || this.enemies.length) return;
    this.waveActive = false;
    const completed = this.waveIndex + 1;
    saveBestWave(this.map.def.id, this.difficultyId, completed);
    const bonus = Math.round((20 + 10 * completed) * this.upgrades.waveBonus);
    this.money += bonus;
    audio.setBattle(false);
    if (completed === this.waves.length) {
      this.endGame(true);
      return;
    }
    audio.play('clear');
    this.messages.show(`¡Oleada superada! Recibes $${bonus}.`);
    this.wavePreview.show(completed + 1, this.waves[completed]);
    this.refreshUi();
  }

  /** Pide confirmación antes de reiniciar la partida (pausa el juego mientras tanto) */
  private confirmReset(): void {
    if (this.gameOver) {
      this.restart();
      return;
    }
    if (this.confirmingReset) return;
    this.confirmingReset = true;
    const wasPaused = this.paused;
    this.paused = true;
    this.refreshUi();

    const w = 380;
    const h = 150;
    const x = (MAP_W - w) / 2;
    const y = (MAP_H - h) / 2 - 20;
    const overlay = this.add.rectangle(0, 0, MAP_W, MAP_H, 0x000000, 0.5).setOrigin(0).setDepth(210).setInteractive();
    const panel = drawPanel(this.add.graphics().setDepth(211), x, y, w, h);
    const title = this.add.text(MAP_W / 2, y + 30, '¿Reiniciar la partida?', textStyle(16)).setOrigin(0.5).setDepth(212);
    const hint = this.add
      .text(MAP_W / 2, y + 60, 'Se perderá todo el progreso.', textStyle(8))
      .setOrigin(0.5)
      .setDepth(212);
    const close = () => {
      [overlay, panel, title, hint, yes, no].forEach((o) => o.destroy());
      this.confirmingReset = false;
    this.defeated = 0;
    this.startBest = loadBestWave(this.map.def.id, this.difficultyId);
    this.lockedAtStart = lockedMaps();
      this.paused = wasPaused;
      this.refreshUi();
    };
    const yes = new Button(this, MAP_W / 2 - 150, y + h - 54, 140, 34, 'SI', () => this.restart(), {
      variant: 'red',
    }).setDepth(212);
    const no = new Button(this, MAP_W / 2 + 10, y + h - 54, 140, 34, 'NO', close, { variant: 'blue' }).setDepth(212);
  }

  /** Vuelve a empezar en el mismo mapa y dificultad */
  private restart(): void {
    this.scene.restart({ mapId: this.map.def.id, difficulty: this.difficultyId } satisfies GameSceneData);
  }

  private togglePause(): void {
    if (this.gameOver || this.confirmingReset || this.skillPanel) return;
    this.paused = !this.paused;
    this.pausePanel?.destroy();
    this.pausePanel = this.paused ? this.createPausePanel() : null;
    this.refreshUi();
  }

  private toggleSpeed(): void {
    if (this.gameOver) return;
    this.speed = SPEEDS[(SPEEDS.indexOf(this.speed) + 1) % SPEEDS.length];
    this.refreshUi();
  }

  private toggleMute(): void {
    audio.toggleMute();
    this.refreshUi();
  }

  // ---------------------------------------------------------------- torres

  private updateTowers(dt: number): void {
    for (const tower of this.towers.values()) {
      tower.cooldown = Math.max(0, tower.cooldown - dt * 1000);
      if (tower.cooldown > 0 || tower.busy) continue;
      const target = this.findTarget(tower);
      if (!target) continue;
      this.attack(tower, target);
      tower.cooldown = tower.fireInterval;
    }
  }

  /** Elige objetivo dentro del alcance según el modo de la torre */
  private findTarget(tower: Tower): Enemy | null {
    let best: Enemy | null = null;
    let bestScore = -Infinity;
    for (const enemy of this.enemies) {
      if (!enemy.alive || effectiveness(tower.def.type, enemy.def.types) === 0) continue;
      const dist = Phaser.Math.Distance.Between(tower.x, tower.y, enemy.x, enemy.y);
      if (dist > tower.range) continue;
      const score =
        tower.targetMode === 'first'
          ? enemy.distanceTravelled
          : tower.targetMode === 'last'
            ? -enemy.distanceTravelled
            : tower.targetMode === 'strong'
              ? enemy.hp
              : -dist;
      if (score > bestScore) {
        bestScore = score;
        best = enemy;
      }
    }
    return best;
  }

  private attack(tower: Tower, target: Enemy): void {
    const { ability } = tower.def;
    tower.attackAnim(target.x, target.y, ability === 'melee');
    audio.play(ATTACK_SFX[ability]);
    const power = tower.stage;
    const mouthY = tower.mouthY;

    if (ability === 'melee') {
      this.effects.punchImpact(target.x, target.aimY, power);
      this.hit(tower, target, tower.damage);
      // DOBLE GOLPE: a veces vuelve a pegar enseguida
      if (tower.skillFx.special && Math.random() < SPECIAL.doubleHit) {
        this.time.delayedCall(120 / this.speed, () => {
          if (!target.alive || !tower.active) return;
          this.effects.punchImpact(target.x, target.aimY, power);
          this.hit(tower, target, tower.damage);
        });
      }
      return;
    }
    if (ability === 'slow') {
      this.effects.vineWhip(tower.x, mouthY, target.x, target.aimY, power);
      // El golpe llega cuando la liana termina de estirarse
      this.time.delayedCall(90 / this.speed, () => {
        if (!target.alive) return;
        this.effects.leafBurst(target.x, target.aimY);
        this.hit(tower, target, tower.damage);
        if (tower.skillFx.special) target.applySlow(SPECIAL.slowFactor, SLOW.duration * SPECIAL.slowDuration);
        else target.applySlow(SLOW.factor, SLOW.duration);
      });
      return;
    }
    if (ability === 'flamethrower') {
      this.flamethrower(tower, target);
      return;
    }
    const projectile = PROJECTILES[ability];
    if (!projectile) return;
    this.effects.muzzle(tower.x, mouthY, TYPE_COLORS[tower.def.type]);
    this.projectiles.push(
      new Projectile(this, tower.x, mouthY, {
        texture: projectile.texture,
        target,
        speed: PROJECTILE_SPEED,
        scale: 1 + power * 0.4,
        onHit: (hitTarget, x, y) => this.onProjectileHit(tower, hitTarget, x, y),
        onTrail: (x, y) => this.effects.trail(projectile.trail, x, y),
      }),
    );
  }

  private onProjectileHit(tower: Tower, target: Enemy | null, x: number, y: number): void {
    const damage = tower.damage;
    if (tower.def.ability === 'splash') {
      const radius = SPLASH_RADIUS * (tower.skillFx.special ? SPECIAL.splashRadius : 1);
      this.effects.splash(x, y, radius, tower.stage);
      for (const enemy of this.enemies) {
        if (enemy.alive && Phaser.Math.Distance.Between(x, y, enemy.x, enemy.aimY) <= radius + enemy.hitRadius) {
          this.hit(tower, enemy, damage);
        }
      }
      return;
    }
    this.effects.fireExplosion(x, y, tower.stage);
    if (!target) return;
    const dealt = this.hit(tower, target, damage);
    const burnRatio = tower.skillFx.special ? SPECIAL.burnRatio : BURN.ratio;
    if (dealt > 0) target.applyBurn(dealt * burnRatio, BURN.duration, tower);
  }

  /** Daña a todos los enemigos en línea recta hasta el final del alcance */
  private flamethrower(tower: Tower, target: Enemy): void {
    const mouthY = tower.mouthY;
    const angle = Phaser.Math.Angle.Between(tower.x, mouthY, target.x, target.aimY);
    const range = tower.range;
    const line = new Phaser.Geom.Line(
      tower.x,
      mouthY,
      tower.x + Math.cos(angle) * range,
      mouthY + Math.sin(angle) * range,
    );
    this.effects.muzzle(tower.x, mouthY, 0xffa040);
    this.effects.flameJet(tower.x, mouthY, angle, range, tower.stage);
    const hitArea = new Phaser.Geom.Circle();
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const width = FLAME_WIDTH * (tower.skillFx.special ? SPECIAL.flameWidth : 1);
      hitArea.setTo(enemy.x, enemy.aimY, enemy.hitRadius + width / 2);
      if (Phaser.Geom.Intersects.LineToCircle(line, hitArea)) this.hit(tower, enemy, tower.damage);
    }
  }

  /** Aplica el daño con la tabla de tipos y los críticos, y devuelve el daño real */
  private hit(tower: Tower, enemy: Enemy, baseDamage: number): number {
    const mult = effectiveness(tower.def.type, enemy.def.types);
    const crit = mult > 0 && Math.random() < CRIT_CHANCE + this.upgrades.critBonus + tower.skillFx.critBonus;
    const damage = baseDamage * mult * (crit ? CRIT_MULT : 1);
    enemy.takeDamage(damage, tower);

    const kind: DamageKind = crit ? 'crit' : mult >= 2 ? 'super' : mult < 1 ? 'weak' : 'normal';
    this.damageNumbers.show(enemy.x, enemy.topY + 4, damage, kind);
    if (crit) {
      this.effects.floatText(enemy.x, enemy.topY - 18, '¡CRITICO!', '#ff9060');
      this.cameras.main.shake(70, 0.002);
      audio.play('crit');
    }
    if (mult >= 2) {
      this.effects.superEffective(enemy.x, enemy.aimY);
      audio.play('super');
    } else if (mult < 1) {
      this.effects.burst(enemy.x, enemy.aimY, 0x909090, 2);
    } else {
      this.effects.burst(enemy.x, enemy.aimY, TYPE_COLORS[tower.def.type], 3);
      audio.play('hit');
    }
    return damage;
  }

  // ---------------------------------------------------------------- colocación y selección

  private startPlacing(def: TowerDef): void {
    if (this.gameOver) return;
    if (!this.owned.has(def.id)) {
      audio.play('error');
      this.messages.show(`Aún no tienes a ${caps(def.stages[0].name)}. ¡Consíguelo en la TIENDA DE POKéMON del menú!`);
      return;
    }
    if (this.money < priceOf(def.stages[0])) {
      audio.play('error');
      return;
    }
    if (this.placing === def) {
      this.cancelPlacing();
      return;
    }
    this.select(null);
    this.placing = def;
    this.touchPreview = null;
    const sprite = def.stages[0].sprite;
    this.ghost.setTexture(battleSprite(sprite).texture, 0).setScale(towerScale(sprite, 0)).setVisible(false);
    this.refreshUi();
  }

  private cancelPlacing(): void {
    if (!this.placing) return;
    this.placing = null;
    this.touchPreview = null;
    this.rangeGfx.clear();
    this.ghost.setVisible(false);
    this.drawSelection();
    this.refreshUi();
  }

  private canPlace(col: number, row: number): boolean {
    return this.map.isBuildable(col, row) && !this.towers.has(tileKey(col, row));
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.placing) return;
    if (pointer.worldX >= MAP_W) {
      this.ghost.setVisible(false);
      this.rangeGfx.clear();
      return;
    }
    const col = Math.floor(pointer.worldX / TILE);
    const row = Math.floor(pointer.worldY / TILE);
    const pos = tileCenter(col, row);
    const valid = this.canPlace(col, row);
    const sprite = this.placing.stages[0].sprite;
    const feet = feetAnchor(battleSprite(sprite), towerScale(sprite, 0), false, TOWER_FEET_Y);
    this.ghost.setPosition(pos.x + feet.x, pos.y + feet.y).setVisible(true);
    if (valid) this.ghost.clearTint();
    else this.ghost.setTint(0xff6060);
    this.drawRange(pos.x, pos.y, this.placing.stages[0].range, valid ? 0xffffff : 0xff3b30);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]): void {
    // Por si se entró directamente con #game sin pasar por el título
    audio.unlock();
    audio.startMusic();
    // Los clics en paneles (pausa, confirmaciones) no llegan al mapa de debajo
    if (this.gameOver || pointer.worldX >= MAP_W || currentlyOver.length > 0) return;
    if (pointer.rightButtonDown()) {
      this.cancelPlacing();
      this.select(null);
      return;
    }
    const col = Math.floor(pointer.worldX / TILE);
    const row = Math.floor(pointer.worldY / TILE);

    if (this.placing) {
      const def = this.placing;
      const cost = priceOf(def.stages[0]);
      // Con el dedo, el primer toque solo enseña la vista previa
      if (pointer.wasTouch && this.touchPreview !== tileKey(col, row)) {
        if (this.touchPreview === null) this.messages.show('Toca otra vez la misma casilla para colocarlo.');
        this.touchPreview = tileKey(col, row);
        this.onPointerMove(pointer);
        if (!this.canPlace(col, row)) audio.play('error');
        return;
      }
      if (!this.canPlace(col, row) || this.money < cost) {
        audio.play('error');
        return;
      }
      this.money -= cost;
      const tower = new Tower(this, def, col, row);
      tower.itemMult = plateMultiplier(def.type, this.items);
      this.towers.set(tileKey(col, row), tower);
      this.throwPokeBall(tower);
      this.messages.show(`¡Adelante, ${caps(def.stages[0].name)}!`);
      this.placing = null;
      this.touchPreview = null;
      this.ghost.setVisible(false);
      this.select(tower);
      return;
    }

    const tower = this.towers.get(tileKey(col, row)) ?? null;
    if (tower) audio.play('click');
    this.select(tower);
  }

  private select(tower: Tower | null): void {
    // Al cambiar de Pokémon (o vender el actual) se cierra su árbol de habilidades
    if (this.skillPanel && tower !== this.selected) this.closeSkills();
    this.selected = tower;
    this.drawSelection();
    this.refreshUi();
  }

  private evolveSelected(): void {
    const tower = this.selected;
    if (!tower || !tower.canEvolve) return;
    if (this.money < tower.evolveCost) {
      audio.play('error');
      return;
    }
    if (tower.evolving) return;
    const oldName = caps(tower.stats.name);
    this.money -= tower.evolveCost;
    const evolved = tower.evolve(() => {
      this.effects.sparkle(tower.x, tower.y);
      this.effects.pokeballOpen(tower.x, tower.mouthY);
      audio.play('evolve');
      this.drawSelection();
      this.refreshUi();
    });
    const newName = caps(tower.stats.name);
    if (evolved) {
      // Los textos de siempre de los juegos
      audio.play('levelup');
      this.messages.show(`¿Qué? ¡${oldName} está evolucionando!`);
      this.messages.show(`¡Enhorabuena! ¡Tu ${oldName} ha evolucionado a ${newName}!`);
    } else {
      this.effects.sparkle(tower.x, tower.y);
      audio.play('levelup');
      this.messages.show(`¡${newName} ha entrenado y sube al nivel ${tower.level}!`);
    }
    if (tower.freeSkillPoints > 0) {
      this.messages.show(`¡${newName} tiene puntos de habilidad! Pulsa HABILIDADES (o H) para gastarlos.`);
    }
    this.drawSelection();
    this.refreshUi();
  }

  /** Abre o cierra el árbol de habilidades del Pokémon seleccionado (tecla H) */
  private toggleSkills(): void {
    if (this.skillPanel) {
      this.closeSkills();
      return;
    }
    const tower = this.selected;
    if (!tower || this.gameOver || this.confirmingReset) return;
    if (this.pausePanel) this.togglePause();
    this.cancelPlacing();
    audio.play('click');
    this.pausedBeforeSkills = this.paused;
    this.paused = true;
    this.skillPanel = new SkillPanel(this, tower, {
      onLearn: () => {
        this.effects.sparkle(tower.x, tower.mouthY);
        this.drawSelection();
        this.refreshUi();
      },
      onClose: () => this.closeSkills(),
    });
    this.refreshUi();
  }

  private closeSkills(): void {
    if (!this.skillPanel) return;
    this.skillPanel.destroy();
    this.skillPanel = null;
    this.paused = this.pausedBeforeSkills;
    this.refreshUi();
  }

  /** Experiencia al debilitar a un Pokémon salvaje; sube de nivel automáticamente */
  private rewardExp(tower: Tower, amount: number): void {
    tower.kills++;
    const pointsBefore = tower.freeSkillPoints;
    const gained = tower.gainExp(Math.round(amount * this.upgrades.expFactor));
    if (!gained || !tower.active) return;
    if (tower.freeSkillPoints > pointsBefore) {
      this.effects.floatText(tower.x, tower.topY - 22, '¡PUNTO DE HABILIDAD!', '#ffd858');
    }
    this.effects.floatText(tower.x, tower.topY - 6, `¡NV ${tower.level}!`, '#80d0ff');
    this.effects.sparkle(tower.x, tower.mouthY);
    audio.play('levelup');
  }

  /** Lanza una Poké Ball desde la tienda hasta la casilla; al abrirse sale el Pokémon */
  private throwPokeBall(tower: Tower): void {
    const from = this.sidebar.cardPosition(tower.def);
    const end = new Phaser.Math.Vector2(tower.x, tower.y + 6);
    const control = new Phaser.Math.Vector2((from.x + end.x) / 2, Math.min(from.y, end.y) - 140);
    const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(from.x, from.y), control, end);
    const ball = this.add.image(from.x, from.y, 'pokeball').setDepth(150).setScale(1.4);
    const flight = { t: 0 };
    audio.play('throw');
    this.tweens.add({
      targets: flight,
      t: 1,
      duration: 480,
      onUpdate: () => {
        const p = curve.getPoint(flight.t);
        ball.setPosition(p.x, p.y).setAngle(ball.angle + 24);
      },
      onComplete: () => {
        ball.setDepth(40);
        // Botecito y se abre
        this.tweens.add({
          targets: ball,
          y: end.y - 12,
          angle: 0,
          duration: 110,
          yoyo: true,
          ease: 'Quad.easeOut',
          onComplete: () => {
            ball.destroy();
            if (!tower.active) return;
            this.effects.pokeballOpen(end.x, end.y - 14);
            audio.play('pop');
            tower.release();
          },
        });
      },
    });
  }

  /** Transición de combate salvaje: destellos y franjas negras que cruzan el mapa */
  private battleTransition(): void {
    const cam = this.cameras.main;
    cam.flash(110, 255, 255, 255);
    this.time.delayedCall(200, () => cam.flash(110, 255, 255, 255));
    const strips = 8;
    const h = MAP_H / strips;
    for (let i = 0; i < strips; i++) {
      const fromLeft = i % 2 === 0;
      const strip = this.add
        .rectangle(fromLeft ? 0 : MAP_W, i * h, MAP_W, h + 1, 0x101018)
        .setOrigin(fromLeft ? 0 : 1, 0)
        .setDepth(95)
        .setScale(0, 1);
      this.tweens.chain({
        targets: strip,
        tweens: [
          { scaleX: 1, duration: 200, delay: 320 + i * 30, ease: 'Quad.easeIn' },
          { alpha: 0, duration: 260, delay: 120 },
        ],
        onComplete: () => strip.destroy(),
      });
    }
    // Los Pokémon salen cuando se despeja la pantalla
    this.waveTime = -900;
  }

  private sellSelected(): void {
    const tower = this.selected;
    if (!tower) return;
    this.money += tower.sellValue;
    this.towers.delete(tileKey(tower.col, tower.row));
    this.effects.floatText(tower.x, tower.y - 10, `+$${tower.sellValue}`, '#ffe066');
    this.messages.show(`¡${caps(tower.stats.name)}, vuelve!`);
    audio.play('recall');
    audio.play('coin');
    tower.recall();
    this.select(null);
  }

  private cycleTarget(): void {
    if (!this.selected) return;
    this.selected.cycleTargetMode();
    this.refreshUi();
  }

  // ---------------------------------------------------------------- dibujo

  private drawRange(x: number, y: number, range: number, color: number): void {
    this.rangeGfx.clear();
    this.rangeGfx.fillStyle(color, 0.15).fillCircle(x, y, range);
    this.rangeGfx.lineStyle(2, color, 0.7).strokeCircle(x, y, range);
  }

  private drawSelection(): void {
    const tower = this.selected;
    this.selectionRing.setVisible(!!tower);
    if (!tower) {
      this.rangeGfx.clear();
      return;
    }
    this.selectionRing.setPosition(tower.x, tower.y);
    this.drawRange(tower.x, tower.y, tower.range, 0xffffff);
  }

  /** Clasificación de daño de la barra lateral (solo trabaja si esa pestaña está abierta) */
  private refreshDamage(): void {
    this.damageRefresh = DAMAGE_REFRESH_MS;
    this.sidebar.refreshDamage([...this.towers.values()]);
  }

  private refreshUi(): void {
    this.sidebar.update(
      {
        money: this.money,
        lives: this.lives,
        wave: this.waveIndex + 1,
        totalWaves: this.waves.length,
        waveActive: this.waveActive,
        canStartWave: !this.waveActive && !this.gameOver && this.waveIndex < this.waves.length - 1,
        speed: this.speed,
        paused: this.paused,
        muted: audio.isMuted,
        placing: this.placing,
        owned: this.owned,
      },
      this.selected,
    );
    this.refreshDamage();
    this.saveCheckpoint();
  }

  /**
   * Guarda la partida si se está entre oleadas. Una partida recién empezada (sin Pokémon ni
   * oleadas jugadas) no se guarda, para no borrar la anterior solo por entrar a mirar un mapa.
   */
  private saveCheckpoint(): void {
    if (!this.ready || this.gameOver || this.waveActive) return;
    if (this.waveIndex < 0 && this.towers.size === 0) return;
    saveGame({
      mapId: this.map.def.id,
      difficulty: this.difficultyId,
      waveIndex: this.waveIndex,
      money: this.money,
      lives: this.lives,
      defeated: this.defeated,
      towers: [...this.towers.values()].map((t) => ({
        tower: t.def.id,
        col: t.col,
        row: t.row,
        stage: t.stage,
        level: t.level,
        exp: t.exp,
        kills: t.kills,
        damage: Math.round(t.damageDealt),
        target: t.targetMode,
        spent: t.spent,
        expLevels: t.expLevels,
        skills: [...t.skills],
      })),
    });
  }

  /** Monta la partida guardada: dinero, vidas, oleada y los Pokémon en su sitio */
  private restoreGame(saved: SavedGame): void {
    this.money = saved.money;
    this.lives = saved.lives;
    this.defeated = saved.defeated;
    this.waveIndex = Math.min(saved.waveIndex, this.waves.length - 2);
    for (const t of saved.towers) {
      const def = TOWERS.find((d) => d.id === t.tower);
      // Si el mapa ha cambiado y la casilla ya no vale, se devuelve lo invertido
      if (!def || !this.canPlace(t.col, t.row)) {
        this.money += t.spent;
        continue;
      }
      const tower = new Tower(this, def, t.col, t.row);
      tower.itemMult = plateMultiplier(def.type, this.items);
      tower.restore(t);
      this.towers.set(tileKey(t.col, t.row), tower);
      tower.release();
    }
    const next = this.waveIndex + 1;
    this.wavePreview.show(next + 1, this.waves[next]);
    this.messages.show(`¡Partida recuperada! Siguiente: oleada ${next + 1} de ${this.waves.length}.`);
  }

  /** Panel de pausa: dónde estás, los volúmenes de música y efectos y botones para seguir o salir */
  private createPausePanel(): Phaser.GameObjects.Container {
    const barWidth = 200;
    const labelW = 104;
    const pad = 24;
    const w = pad * 2 + labelW + VolumeSlider.width(barWidth);
    const h = 288;
    const g = drawPanel(this.add.graphics(), 0, 0, w, h);
    const title = this.add.text(w / 2, 30, 'PAUSA', textStyle(24)).setOrigin(0.5);
    const where = this.add
      .text(w / 2, 56, `${this.map.def.name} - ${this.difficulty.label} - OLEADA ${Math.max(1, this.waveIndex + 1)}/${this.waves.length}`, textStyle(8, '#7080a0', null))
      .setOrigin(0.5);
    const section = addSectionLabel(this, pad, 84, w - pad * 2, 'SONIDO');
    const rows = (['music', 'sfx'] as const).flatMap((channel, i) => {
      const y = 100 + i * 48;
      const label = this.add
        .text(pad, y + VolumeSlider.height / 2, channel === 'music' ? 'MUSICA' : 'EFECTOS', textStyle(8))
        .setOrigin(0, 0.5);
      return [label, new VolumeSlider(this, pad + labelW, y, channel, { barWidth })];
    });
    const gap = 12;
    const bw = (w - pad * 2 - gap * 2) / 3;
    const by = h - 82;
    const buttons = [
      new Button(this, pad, by, bw, 34, 'SEGUIR', () => this.togglePause(), { variant: 'green' }),
      new Button(this, pad + bw + gap, by, bw, 34, 'REINICIAR', () => this.confirmReset(), { variant: 'blue' }),
      new Button(this, pad + (bw + gap) * 2, by, bw, 34, 'MENU', () => this.goHome(), { variant: 'red' }),
    ];
    const hint = this.add.text(w / 2, h - 24, 'Pulsa P para seguir', textStyle(8)).setOrigin(0.5);
    return this.add
      .container((MAP_W - w) / 2, (MAP_H - h) / 2 - 20, [g, title, where, ...section, ...rows, ...buttons, hint])
      .setDepth(170);
  }

  /** Abandona la partida y vuelve al menú general */
  private goHome(): void {
    if (this.leaving) return;
    this.leaving = true;
    audio.stopMusic();
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('MainMenu'));
  }

  /** Cartel con el nombre de la zona que baja desde arriba, como al entrar en una ruta */
  private showLocation(name: string, subtitle: string): void {
    const w = 180;
    const h = 52;
    const g = drawPanel(this.add.graphics(), 0, 0, w, h);
    const text = this.add.text(w / 2, 20, name, textStyle(16)).setOrigin(0.5);
    const sub = this.add.text(w / 2, 39, subtitle, textStyle(8)).setOrigin(0.5);
    const sign = this.add.container(12, -h - 10, [g, text, sub]).setDepth(160);
    this.tweens.chain({
      targets: sign,
      tweens: [
        { y: 12, duration: 350, ease: 'Back.easeOut' },
        { y: -h - 10, duration: 300, delay: 2200, ease: 'Quad.easeIn' },
      ],
      onComplete: () => sign.destroy(),
    });
  }

  private endGame(won: boolean): void {
    this.gameOver = true;
    this.placing = null;
    this.ghost.setVisible(false);
    this.pausePanel?.destroy();
    this.pausePanel = null;
    this.wavePreview.hide();
    this.refreshUi();
    audio.stopMusic();
    audio.play(won ? 'win' : 'lose');
    clearSavedGame();

    const W = GAME_W;
    const H = GAME_H;
    this.add.rectangle(0, 0, W, H, 0x000000, 0.65).setOrigin(0).setDepth(200).setInteractive();

    const pw = 640;
    const ph = 330;
    const px = (W - pw) / 2;
    const py = (H - ph) / 2;
    const depth = 202;
    drawPanel(this.add.graphics().setDepth(201), px, py, pw, ph);
    const goal = goalName(this.map.def);
    const title = won ? '¡ENHORABUENA!' : '¡OH, NO!';
    const body = won
      ? `¡Ningún Pokémon salvaje ha llegado hasta ${goal} en las ${this.waves.length} oleadas!`
      : `Los Pokémon salvajes han llegado hasta ${goal} en la oleada ${this.waveIndex + 1}...`;
    this.add.text(W / 2, py + 34, title, textStyle(24, won ? '#e0a000' : '#d03030')).setOrigin(0.5).setDepth(depth);
    this.add
      .text(W / 2, py + 62, `${this.map.def.name} - ${this.difficulty.label}`, textStyle(8, '#7080a0', null))
      .setOrigin(0.5)
      .setDepth(depth);
    this.add
      .text(W / 2, py + 96, body, { ...textStyle(8), align: 'center', wordWrap: { width: pw - 60 } })
      .setLineSpacing(6)
      .setOrigin(0.5)
      .setDepth(depth);

    // Puntos de la cuenta: por oleada, por ganar y por completar el mapa la primera vez
    const completed = won ? this.waves.length : this.waveIndex;
    const firstClear = won && this.startBest < this.waves.length;
    const points = scoreGame(this.difficultyId, completed, won, firstClear);
    const totalPoints = addPoints(points.total);

    // Resumen: oleadas superadas, Pokémon derrotados, vidas que quedan y puntos ganados
    const stats: [string, string][] = [
      ['OLEADAS', `${completed}/${this.waves.length}`],
      ['DERROTADOS', String(this.defeated)],
      ['VIDAS', String(this.lives)],
      ['PUNTOS', `+${points.total}`],
    ];
    const statsY = py + 150;
    const statW = (pw - 80) / stats.length;
    const strip = this.add.graphics().setDepth(depth);
    strip.fillStyle(0xe8eef8).fillRoundedRect(px + 30, statsY - 26, pw - 60, 52, 6);
    stats.forEach(([label, value], i) => {
      const x = px + 40 + statW * (i + 0.5);
      this.add.text(x, statsY - 10, label, textStyle(8, '#7080a0', null)).setOrigin(0.5).setDepth(depth);
      this.add
        .text(x, statsY + 10, value, textStyle(16, label === 'PUNTOS' ? '#d09000' : undefined))
        .setOrigin(0.5)
        .setDepth(depth);
    });
    const parts = [`oleadas +${points.waves}`];
    if (points.victory) parts.push(`victoria +${points.victory}`);
    if (points.firstClear) parts.push(`primera vez +${points.firstClear}`);
    this.add
      .text(W / 2, statsY + 40, `Puntos: ${parts.join(' · ')}  (total ${totalPoints})`, textStyle(8, '#7080a0', null))
      .setOrigin(0.5)
      .setDepth(depth);
    if (completed > this.startBest) {
      const record = this.add
        .text(W / 2, py + 222, '¡NUEVO RECORD!', textStyle(16, '#e0a000', '#805000'))
        .setOrigin(0.5)
        .setDepth(depth);
      this.tweens.add({ targets: record, scale: 1.12, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    const unlocked = this.lockedAtStart.filter(isMapUnlocked);
    if (unlocked.length) {
      this.add
        .text(W / 2, py + 248, `¡Nuevo mapa desbloqueado: ${unlocked.map((m) => m.name).join(', ')}!`, textStyle(8, '#3870c8'))
        .setOrigin(0.5)
        .setDepth(depth);
    }

    const bw = 170;
    const gap = 14;
    const bx = W / 2 - (bw * 3 + gap * 2) / 2;
    const by = py + ph - 56;
    new Button(this, bx, by, bw, 36, 'VOLVER A JUGAR', () => this.restart(), { variant: 'red' }).setDepth(depth);
    new Button(this, bx + bw + gap, by, bw, 36, 'MAPAS', () => this.scene.start('MapSelect'), { variant: 'blue' }).setDepth(depth);
    new Button(this, bx + (bw + gap) * 2, by, bw, 36, 'MENU', () => this.scene.start('MainMenu'), { variant: 'gray' }).setDepth(depth);
  }
}
