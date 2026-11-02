import Phaser from 'phaser';
import { audio, type SfxName } from '../audio/Audio';
import { GAME_H, GAME_W, HP_GROWTH_PER_WAVE, MAP_H, MAP_W, START_LIVES, START_MONEY, TILE } from '../config';
import { ENEMIES, type EnemyDef } from '../data/enemies';
import { SPAWN_TILE, isBuildable, tileCenter, tileKey } from '../data/map';
import { BURN, FLAME_WIDTH, SLOW, SPLASH_RADIUS, TOWERS, type TowerAbility, type TowerDef } from '../data/towers';
import { TYPE_COLORS, effectiveness } from '../data/types';
import { battleSprite, feetAnchor } from '../data/sprites';
import { WAVES } from '../data/waves';
import { Enemy } from '../objects/Enemy';
import { Projectile } from '../objects/Projectile';
import { TOWER_FEET_Y, Tower, towerScale } from '../objects/Tower';
import { saveBestWave } from '../save';
import { BossBar } from '../ui/BossBar';
import { Button } from '../ui/Button';
import { DamageNumbers, type DamageKind } from '../ui/DamageNumbers';
import { MessageBox } from '../ui/MessageBox';
import { Sidebar } from '../ui/Sidebar';
import { WavePreview } from '../ui/WavePreview';
import { POKEBALL_CURSOR, caps, drawPanel, textStyle } from '../ui/theme';
import { addAmbient } from '../world/Ambient';
import { Effects } from '../world/Effects';

interface SpawnEntry {
  time: number;
  def: EnemyDef;
}

const PROJECTILE_SPEED = 400;
const SPEEDS = [1, 2, 3];
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

export class GameScene extends Phaser.Scene {
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

  private sidebar!: Sidebar;
  private messages!: MessageBox;
  private bossBar!: BossBar;
  private wavePreview!: WavePreview;
  private effects!: Effects;
  private damageNumbers!: DamageNumbers;
  private rangeGfx!: Phaser.GameObjects.Graphics;
  private selectionRing!: Phaser.GameObjects.Graphics;
  private ghost!: Phaser.GameObjects.Image;
  private tallGrass!: Phaser.GameObjects.Image;
  private pausePanel!: Phaser.GameObjects.Container;

  constructor() {
    super('Game');
  }

  create(): void {
    // El estado se reinicia aquí porque scene.restart() reutiliza la misma instancia
    this.money = START_MONEY;
    this.lives = START_LIVES;
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

    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.add.image(0, 0, 'route-map').setOrigin(0).setDepth(0);
    // Hierba alta por delante de los enemigos: parece que salen de ella
    this.tallGrass = this.add
      .image(SPAWN_TILE[0] * TILE, SPAWN_TILE[1] * TILE, 'tallgrass')
      .setOrigin(0)
      .setDepth(25);
    addAmbient(this);

    this.rangeGfx = this.add.graphics().setDepth(5);
    this.selectionRing = this.add.graphics().setDepth(9).setVisible(false);
    this.selectionRing.lineStyle(2, 0xffffff).strokeEllipse(0, 14, 50, 20);
    this.tweens.add({ targets: this.selectionRing, alpha: 0.3, duration: 450, yoyo: true, repeat: -1 });
    this.ghost = this.add.image(0, 0, 'px').setOrigin(0.5, 1).setDepth(15).setAlpha(0.7).setVisible(false);
    this.pausePanel = this.createPausePanel();

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
    });

    this.input.setDefaultCursor(POKEBALL_CURSOR);
    this.bindInput();
    audio.setBattle(false);
    audio.startMusic();

    this.showLocation('RUTA 1');
    this.wavePreview.show(1, WAVES[0]);
    this.messages.show('¡Los Pokémon salvajes van hacia el Centro Pokémon! Coloca tus Pokémon y pulsa ¡LUCHAR!');
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
    const digits = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
    TOWERS.forEach((def, i) => keyboard.on(`keydown-${digits[i]}`, () => this.startPlacing(def)));
  }

  // ---------------------------------------------------------------- oleadas

  private startWave(): void {
    if (this.waveActive || this.gameOver || this.waveIndex >= WAVES.length - 1) return;
    if (this.paused) this.togglePause();
    this.waveIndex++;
    this.waveActive = true;
    this.waveTime = 0;
    this.spawnQueue = WAVES[this.waveIndex]
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
    const hpMultiplier = 1 + HP_GROWTH_PER_WAVE * this.waveIndex;
    const level = 3 + this.waveIndex * 4;
    while (this.spawnQueue.length && this.spawnQueue[0].time <= this.waveTime) {
      const { def } = this.spawnQueue.shift()!;
      this.enemies.push(new Enemy(this, def, hpMultiplier, def.boss ? level + 15 : level));
      this.rustleGrass();
      if (def.boss) {
        this.cameras.main.shake(300, 0.006);
        audio.play('boss');
        this.messages.show(`¡Un ${def.name.toUpperCase()} salvaje apareció!`);
      }
    }
  }

  /** La hierba alta se agita cuando sale un Pokémon, como en los juegos */
  private rustleGrass(): void {
    const baseX = SPAWN_TILE[0] * TILE;
    this.tweens.killTweensOf(this.tallGrass);
    this.tallGrass.setX(baseX);
    this.tweens.add({
      targets: this.tallGrass,
      x: { from: baseX - 2, to: baseX + 2 },
      duration: 45,
      yoyo: true,
      repeat: 2,
      onComplete: () => this.tallGrass.setX(baseX),
    });
  }

  private removeFinishedEnemies(): void {
    let changed = false;
    this.enemies = this.enemies.filter((enemy) => {
      if (enemy.alive) return true;
      if (enemy.dead) {
        this.money += enemy.def.reward;
        if (enemy.lastAttacker) this.rewardExp(enemy.lastAttacker, enemy.def.reward);
        this.effects.poof(enemy.x, enemy.aimY);
        this.effects.floatText(enemy.x, enemy.y + 10, `+$${enemy.def.reward}`, '#ffe066');
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
    saveBestWave(completed);
    const bonus = 20 + 10 * completed;
    this.money += bonus;
    audio.setBattle(false);
    if (completed === WAVES.length) {
      this.endGame(true);
      return;
    }
    audio.play('clear');
    this.messages.show(`¡Oleada superada! Recibes $${bonus}.`);
    this.wavePreview.show(completed + 1, WAVES[completed]);
    this.refreshUi();
  }

  /** Pide confirmación antes de reiniciar la partida (pausa el juego mientras tanto) */
  private confirmReset(): void {
    if (this.gameOver) {
      this.scene.restart();
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
      this.paused = wasPaused;
      this.refreshUi();
    };
    const yes = new Button(this, MAP_W / 2 - 150, y + h - 54, 140, 34, 'SI', () => this.scene.restart(), {
      variant: 'red',
    }).setDepth(212);
    const no = new Button(this, MAP_W / 2 + 10, y + h - 54, 140, 34, 'NO', close, { variant: 'blue' }).setDepth(212);
  }

  private togglePause(): void {
    if (this.gameOver || this.confirmingReset) return;
    this.paused = !this.paused;
    this.pausePanel.setVisible(this.paused);
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
      tower.cooldown = tower.stats.fireRate;
    }
  }

  /** Elige objetivo dentro del alcance según el modo de la torre */
  private findTarget(tower: Tower): Enemy | null {
    let best: Enemy | null = null;
    let bestScore = -Infinity;
    for (const enemy of this.enemies) {
      if (!enemy.alive || effectiveness(tower.def.type, enemy.def.types) === 0) continue;
      const dist = Phaser.Math.Distance.Between(tower.x, tower.y, enemy.x, enemy.y);
      if (dist > tower.stats.range) continue;
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
      return;
    }
    if (ability === 'slow') {
      this.effects.vineWhip(tower.x, mouthY, target.x, target.aimY, power);
      // El golpe llega cuando la liana termina de estirarse
      this.time.delayedCall(90 / this.speed, () => {
        if (!target.alive) return;
        this.effects.leafBurst(target.x, target.aimY);
        this.hit(tower, target, tower.damage);
        target.applySlow(SLOW.factor, SLOW.duration);
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
      this.effects.splash(x, y, SPLASH_RADIUS, tower.stage);
      for (const enemy of this.enemies) {
        if (enemy.alive && Phaser.Math.Distance.Between(x, y, enemy.x, enemy.aimY) <= SPLASH_RADIUS + enemy.hitRadius) {
          this.hit(tower, enemy, damage);
        }
      }
      return;
    }
    this.effects.fireExplosion(x, y, tower.stage);
    if (!target) return;
    const dealt = this.hit(tower, target, damage);
    if (dealt > 0) target.applyBurn(dealt * BURN.ratio, BURN.duration, tower);
  }

  /** Daña a todos los enemigos en línea recta hasta el final del alcance */
  private flamethrower(tower: Tower, target: Enemy): void {
    const mouthY = tower.mouthY;
    const angle = Phaser.Math.Angle.Between(tower.x, mouthY, target.x, target.aimY);
    const range = tower.stats.range;
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
      hitArea.setTo(enemy.x, enemy.aimY, enemy.hitRadius + FLAME_WIDTH / 2);
      if (Phaser.Geom.Intersects.LineToCircle(line, hitArea)) this.hit(tower, enemy, tower.damage);
    }
  }

  /** Aplica el daño con la tabla de tipos y los críticos, y devuelve el daño real */
  private hit(tower: Tower, enemy: Enemy, baseDamage: number): number {
    const mult = effectiveness(tower.def.type, enemy.def.types);
    const crit = mult > 0 && Math.random() < CRIT_CHANCE;
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
    if (this.money < def.stages[0].cost) {
      audio.play('error');
      return;
    }
    if (this.placing === def) {
      this.cancelPlacing();
      return;
    }
    this.select(null);
    this.placing = def;
    const sprite = def.stages[0].sprite;
    this.ghost.setTexture(battleSprite(sprite).texture, 0).setScale(towerScale(sprite, 0)).setVisible(false);
    this.refreshUi();
  }

  private cancelPlacing(): void {
    if (!this.placing) return;
    this.placing = null;
    this.ghost.setVisible(false);
    this.drawSelection();
    this.refreshUi();
  }

  private canPlace(col: number, row: number): boolean {
    return isBuildable(col, row) && !this.towers.has(tileKey(col, row));
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.placing) return;
    if (pointer.x >= MAP_W) {
      this.ghost.setVisible(false);
      this.rangeGfx.clear();
      return;
    }
    const col = Math.floor(pointer.x / TILE);
    const row = Math.floor(pointer.y / TILE);
    const pos = tileCenter(col, row);
    const valid = this.canPlace(col, row);
    const sprite = this.placing.stages[0].sprite;
    const feet = feetAnchor(battleSprite(sprite), towerScale(sprite, 0), false, TOWER_FEET_Y);
    this.ghost.setPosition(pos.x + feet.x, pos.y + feet.y).setVisible(true);
    if (valid) this.ghost.clearTint();
    else this.ghost.setTint(0xff6060);
    this.drawRange(pos.x, pos.y, this.placing.stages[0].range, valid ? 0xffffff : 0xff3b30);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    // Por si se entró directamente con #game sin pasar por el título
    audio.unlock();
    audio.startMusic();
    if (this.gameOver || pointer.x >= MAP_W) return;
    if (pointer.rightButtonDown()) {
      this.cancelPlacing();
      this.select(null);
      return;
    }
    const col = Math.floor(pointer.x / TILE);
    const row = Math.floor(pointer.y / TILE);

    if (this.placing) {
      const def = this.placing;
      const cost = def.stages[0].cost;
      if (!this.canPlace(col, row) || this.money < cost) {
        audio.play('error');
        return;
      }
      this.money -= cost;
      const tower = new Tower(this, def, col, row);
      this.towers.set(tileKey(col, row), tower);
      this.throwPokeBall(tower);
      this.messages.show(`¡Adelante, ${caps(def.stages[0].name)}!`);
      this.placing = null;
      this.ghost.setVisible(false);
      this.select(tower);
      return;
    }

    const tower = this.towers.get(tileKey(col, row)) ?? null;
    if (tower) audio.play('click');
    this.select(tower);
  }

  private select(tower: Tower | null): void {
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
    this.drawSelection();
    this.refreshUi();
  }

  /** Experiencia al debilitar a un Pokémon salvaje; sube de nivel automáticamente */
  private rewardExp(tower: Tower, amount: number): void {
    tower.kills++;
    const gained = tower.gainExp(amount);
    if (!gained || !tower.active) return;
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
    this.drawRange(tower.x, tower.y, tower.stats.range, 0xffffff);
  }

  private refreshUi(): void {
    this.sidebar.update(
      {
        money: this.money,
        lives: this.lives,
        wave: this.waveIndex + 1,
        totalWaves: WAVES.length,
        waveActive: this.waveActive,
        canStartWave: !this.waveActive && !this.gameOver && this.waveIndex < WAVES.length - 1,
        speed: this.speed,
        paused: this.paused,
        muted: audio.isMuted,
        placing: this.placing,
      },
      this.selected,
    );
  }

  private createPausePanel(): Phaser.GameObjects.Container {
    const w = 260;
    const h = 76;
    const g = drawPanel(this.add.graphics(), 0, 0, w, h);
    const title = this.add.text(w / 2, 26, 'PAUSA', textStyle(24)).setOrigin(0.5);
    const hint = this.add.text(w / 2, 56, 'Pulsa P para seguir', textStyle(8)).setOrigin(0.5);
    return this.add
      .container((MAP_W - w) / 2, (MAP_H - h) / 2 - 40, [g, title, hint])
      .setDepth(170)
      .setVisible(false);
  }

  /** Cartel con el nombre de la zona que baja desde arriba, como al entrar en una ruta */
  private showLocation(name: string): void {
    const w = 180;
    const h = 40;
    const g = drawPanel(this.add.graphics(), 0, 0, w, h);
    const text = this.add.text(w / 2, h / 2, name, textStyle(16)).setOrigin(0.5);
    const sign = this.add.container(12, -h - 10, [g, text]).setDepth(160);
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
    this.pausePanel.setVisible(false);
    this.wavePreview.hide();
    this.refreshUi();
    audio.stopMusic();
    audio.play(won ? 'win' : 'lose');

    const W = GAME_W;
    const H = GAME_H;
    this.add.rectangle(0, 0, W, H, 0x000000, 0.65).setOrigin(0).setDepth(200).setInteractive();

    const pw = 560;
    const ph = 200;
    const px = (W - pw) / 2;
    const py = (H - ph) / 2;
    drawPanel(this.add.graphics().setDepth(201), px, py, pw, ph);
    const title = won ? '¡ENHORABUENA!' : '¡OH, NO!';
    const body = won
      ? '¡Has defendido el Centro Pokémon de todas las oleadas!'
      : `Los Pokémon salvajes han llegado al Centro Pokémon en la oleada ${this.waveIndex + 1}...`;
    this.add.text(W / 2, py + 34, title, textStyle(24, won ? '#e0a000' : '#d03030')).setOrigin(0.5).setDepth(202);
    this.add
      .text(W / 2, py + 86, body, { ...textStyle(8), align: 'center', wordWrap: { width: pw - 60 } })
      .setLineSpacing(6)
      .setOrigin(0.5)
      .setDepth(202);
    this.add.image(W / 2, py + 120, 'pokeball').setScale(2).setDepth(202);

    new Button(this, W / 2 - 190, py + ph - 56, 180, 36, 'VOLVER A JUGAR', () => this.scene.restart(), {
      variant: 'red',
    }).setDepth(202);
    new Button(this, W / 2 + 10, py + ph - 56, 180, 36, 'MENU', () => this.scene.start('Title'), {
      variant: 'blue',
    }).setDepth(202);
  }
}
