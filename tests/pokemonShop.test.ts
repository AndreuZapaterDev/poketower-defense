import { beforeEach, describe, expect, it } from 'vitest';
import { POKEMON_PRICES, STARTERS, pokemonPrice } from '../src/data/pokemonShop';
import { TOWERS } from '../src/data/towers';
import { buyPokemon, ownedPokemon, pokemonBlockReason } from '../src/progress';
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

describe('tienda de Pokémon', () => {
  beforeEach(fakeStorage);

  it('todos los Pokémon de la tienda tienen precio y hay iniciales gratis', () => {
    for (const tower of TOWERS) expect(POKEMON_PRICES[tower.id], tower.id).toBeDefined();
    expect(STARTERS.length).toBeGreaterThanOrEqual(3);
  });

  it('una cuenta nueva tiene los iniciales y nada más', () => {
    expect([...ownedPokemon()].sort()).toEqual([...STARTERS].sort());
    for (const id of STARTERS) expect(pokemonBlockReason(id)).toBe('owned');
  });

  it('comprar un Pokémon resta los puntos y lo añade a la cuenta', () => {
    const paid = TOWERS.find((t) => pokemonPrice(t.id) > 0)!;
    expect(buyPokemon(paid.id)).toBe(false);
    expect(pokemonBlockReason(paid.id)).toBe('points');
    addPoints(pokemonPrice(paid.id) + 10);
    expect(buyPokemon(paid.id)).toBe(true);
    expect(loadPoints()).toBe(10);
    expect(ownedPokemon().has(paid.id)).toBe(true);
    expect(buyPokemon(paid.id)).toBe(false);
  });

  it('no se pueden comprar Pokémon que no existen', () => {
    addPoints(10000);
    expect(pokemonBlockReason('mewtwo')).toBe('unknown');
    expect(buyPokemon('mewtwo')).toBe(false);
  });
});
