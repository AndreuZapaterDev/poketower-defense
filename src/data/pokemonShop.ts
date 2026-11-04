import { TOWERS } from './towers';

/**
 * Precio en puntos de la cuenta de cada Pokémon de la tienda (id de TOWERS). Los iniciales valen
 * 0: se tienen desde el principio para poder jugar. Los más fuertes son más caros.
 */
export const POKEMON_PRICES: Record<string, number> = {
  charmander: 0,
  squirtle: 0,
  bulbasaur: 0,
  mankey: 150,
  growlithe: 200,
};

/** Los que se tienen al crear la cuenta */
export const STARTERS = TOWERS.filter((t) => (POKEMON_PRICES[t.id] ?? 0) === 0).map((t) => t.id);

/** Precio de un Pokémon (los que no estén en la lista se dan gratis, para no bloquear la partida) */
export const pokemonPrice = (id: string) => POKEMON_PRICES[id] ?? 0;
