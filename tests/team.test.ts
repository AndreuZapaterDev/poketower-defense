import { beforeEach, describe, expect, it } from 'vitest';
import { STARTERS, pokemonPrice } from '../src/data/pokemonShop';
import { BASE_TEAM_SIZE, MAX_TEAM_SIZE, SIDEBAR_SHOP_SLOTS, sanitizeTeam } from '../src/data/team';
import { TOWERS } from '../src/data/towers';
import { buyPokemon, buyUpgrade, currentTeam, setTeam, teamSize } from '../src/progress';
import { addPoints } from '../src/save';

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

const order = TOWERS.map((t) => t.id);

describe('equipo', () => {
  beforeEach(fakeStorage);

  it('el equipo más grande cabe en la tienda de la barra lateral', () => {
    expect(MAX_TEAM_SIZE).toBeLessThanOrEqual(SIDEBAR_SHOP_SLOTS);
  });

  it('una cuenta nueva tiene los huecos de base y lleva a los iniciales', () => {
    expect(teamSize()).toBe(BASE_TEAM_SIZE);
    expect(currentTeam()).toEqual(STARTERS.slice(0, BASE_TEAM_SIZE));
  });

  it('la mejora AMISTAD abre huecos hasta el máximo', () => {
    addPoints(100000);
    while (buyUpgrade('teamSlots'));
    expect(teamSize()).toBe(MAX_TEAM_SIZE);
  });

  it('quita repetidos, Pokémon que no se tienen y los que sobran', () => {
    const owned = new Set(order);
    expect(sanitizeTeam(['squirtle', 'squirtle', 'mewtwo'], owned, order, 4)).toEqual(['squirtle']);
    // Con más Pokémon de los que caben, se queda con los primeros
    const many = Array.from({ length: 9 }, (_, i) => `poke${i}`);
    expect(sanitizeTeam(many, new Set(many), many, 4)).toEqual(many.slice(0, 4));
  });

  it('nunca queda vacío', () => {
    setTeam([]);
    expect(currentTeam().length).toBeGreaterThan(0);
    setTeam(['mewtwo']);
    expect(currentTeam().length).toBeGreaterThan(0);
  });

  it('recuerda el último equipo', () => {
    setTeam(['bulbasaur']);
    expect(currentTeam()).toEqual(['bulbasaur']);
  });

  it('al comprar un Pokémon se une al equipo si hay hueco', () => {
    const paid = TOWERS.find((t) => pokemonPrice(t.id) > 0)!;
    setTeam(['charmander']);
    addPoints(1000);
    expect(buyPokemon(paid.id)).toBe(true);
    expect(currentTeam()).toEqual(['charmander', paid.id]);
  });
});
