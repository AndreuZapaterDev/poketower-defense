import { beforeEach, describe, expect, it } from 'vitest';
import { UPGRADES, blockReason, emptyLevels, spentPoints, upgradeEffects } from '../src/data/upgrades';
import { buyUpgrade, refundUpgrades, upgradeLevels } from '../src/progress';
import { addPoints, loadPoints } from '../src/save';

/** localStorage en memoria para probar las compras */
function fakeStorage() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true });
}

describe('mejoras de la cuenta', () => {
  beforeEach(fakeStorage);

  it('sin mejoras no cambian nada', () => {
    expect(upgradeEffects(emptyLevels())).toEqual({
      startMoney: 0,
      extraLives: 0,
      waveBonus: 1,
      priceFactor: 1,
      expFactor: 1,
      critBonus: 0,
      teamSlots: 0,
    });
  });

  it('cada mejora tiene precios crecientes y, si pide otra, esa existe', () => {
    for (const u of UPGRADES) {
      expect(u.costs.length).toBeGreaterThan(0);
      u.costs.slice(1).forEach((c, i) => expect(c).toBeGreaterThan(u.costs[i]));
      if (u.requires) expect(UPGRADES.some((o) => o.id === u.requires)).toBe(true);
    }
  });

  it('el descuento máximo deja los precios por encima de la mitad', () => {
    const levels = emptyLevels();
    for (const u of UPGRADES) levels[u.id] = u.costs.length;
    expect(upgradeEffects(levels).priceFactor).toBeGreaterThan(0.5);
  });

  it('no se puede comprar sin puntos ni sin la mejora anterior', () => {
    const levels = emptyLevels();
    expect(blockReason('startMoney', levels, 0)).toBe('points');
    expect(blockReason('waveBonus', levels, 9999)).toBe('locked');
    levels.startMoney = 1;
    expect(blockReason('waveBonus', levels, 9999)).toBeNull();
  });

  it('comprar resta los puntos y sube el nivel; devolver lo deshace', () => {
    addPoints(100);
    expect(buyUpgrade('startMoney')).toBe(true);
    expect(upgradeLevels().startMoney).toBe(1);
    expect(loadPoints()).toBe(70);
    expect(buyUpgrade('shopDiscount')).toBe(false); // pide PREMIO antes
    expect(spentPoints(upgradeLevels())).toBe(30);
    expect(refundUpgrades()).toBe(30);
    expect(loadPoints()).toBe(100);
    expect(upgradeLevels().startMoney).toBe(0);
  });

  it('no deja pasar del nivel máximo', () => {
    addPoints(100000);
    const max = UPGRADES.find((u) => u.id === 'startMoney')!.costs.length;
    for (let i = 0; i < max; i++) expect(buyUpgrade('startMoney')).toBe(true);
    expect(buyUpgrade('startMoney')).toBe(false);
    expect(upgradeLevels().startMoney).toBe(max);
  });
});
