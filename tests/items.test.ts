import { beforeEach, describe, expect, it } from 'vitest';
import { ITEMS, PLATE_BONUS, isItemUseful, itemPath, plateMultiplier } from '../src/data/items';
import { TOWERS } from '../src/data/towers';
import { buyItem, itemBlockReason, ownedItems } from '../src/progress';
import { addPoints, loadPoints } from '../src/save';

function fakeStorage() {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, String(v)),
      removeItem: (k: string) => void data.delete(k),
    },
    configurable: true,
    writable: true,
  });
}

/** Imágenes que hay de verdad en public/assets/items */
const images = Object.keys(import.meta.glob('../public/assets/items/*.png'));

describe('tienda de objetos', () => {
  beforeEach(fakeStorage);

  it('cada objeto tiene su imagen, id único y precio', () => {
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
    for (const item of ITEMS) {
      expect(images, item.file).toContain(`../public/${itemPath(item)}`);
      expect(item.price).toBeGreaterThan(0);
    }
  });

  it('hay una Tabla útil para cada tipo de Pokémon de la tienda', () => {
    for (const tower of TOWERS) expect(ITEMS.some((i) => i.type === tower.type && isItemUseful(i)), tower.type).toBe(true);
  });

  it('las Tablas de tipos sin Pokémon no se pueden comprar', () => {
    addPoints(10000);
    const useless = ITEMS.find((i) => !isItemUseful(i))!;
    expect(itemBlockReason(useless.id)).toBe('soon');
    expect(buyItem(useless.id)).toBe(false);
  });

  it('comprar resta los puntos, se guarda y no se puede repetir', () => {
    const plate = ITEMS.find((i) => i.type === 'fire')!;
    expect(itemBlockReason(plate.id)).toBe('points');
    addPoints(plate.price + 5);
    expect(buyItem(plate.id)).toBe(true);
    expect(loadPoints()).toBe(5);
    expect(ownedItems().has(plate.id)).toBe(true);
    expect(itemBlockReason(plate.id)).toBe('owned');
    expect(buyItem(plate.id)).toBe(false);
  });

  it('la Tabla solo potencia a su tipo', () => {
    const owned = new Set([ITEMS.find((i) => i.type === 'fire')!.id]);
    expect(plateMultiplier('fire', owned)).toBeCloseTo(1 + PLATE_BONUS);
    expect(plateMultiplier('water', owned)).toBe(1);
  });
});
