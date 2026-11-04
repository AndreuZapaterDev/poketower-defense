import { DIFFICULTY_IDS, MAPS, mapById, type Difficulty, type MapDef } from './data/map';
import { wavesFor } from './data/waves';
import {
  UPGRADES,
  blockReason,
  emptyLevels,
  spentPoints,
  upgradeById,
  upgradeEffects,
  type UpgradeId,
  type UpgradeLevels,
} from './data/upgrades';
import { isItemUseful, itemById } from './data/items';
import { STARTERS, pokemonPrice } from './data/pokemonShop';
import { TOWERS } from './data/towers';
import { BASE_TEAM_SIZE, MAX_TEAM_SIZE, sanitizeTeam } from './data/team';
import {
  addPoints,
  loadBestWave,
  loadDevUnlockAll,
  loadOwnedItems,
  loadOwnedPokemon,
  loadPoints,
  loadTeam,
  loadUpgradeLevels,
  saveOwnedItems,
  saveOwnedPokemon,
  saveTeam,
  saveUpgradeLevels,
} from './save';

/** Si se han superado todas las oleadas del mapa en esa dificultad */
export const isCompleted = (mapId: string, difficulty: Difficulty) =>
  loadBestWave(mapId, difficulty) >= wavesFor(mapId, difficulty).length;

/** Si se han superado todas las oleadas del mapa en alguna dificultad */
export const isMapCompleted = (mapId: string) => DIFFICULTY_IDS.some((d) => isCompleted(mapId, d));

/**
 * Un mapa está abierto si no pide nada, si ya se ha completado el mapa que lo desbloquea o si,
 * en desarrollo, se ha activado el botón de abrir todos los mapas del menú principal
 */
export const isMapUnlocked = (def: MapDef) => !def.unlockedBy || loadDevUnlockAll() || isMapCompleted(def.unlockedBy);

/** Mapas que siguen cerrados, para saber al acabar una partida cuáles se acaban de abrir */
export const lockedMaps = () => MAPS.filter((def) => !isMapUnlocked(def));

/** Nombre del mapa que hay que completar para abrir `def` */
export const unlockerName = (def: MapDef) => (def.unlockedBy ? mapById(def.unlockedBy).name : '');

/** Niveles de las mejoras de la cuenta, sin pasarse del máximo de cada una */
export function upgradeLevels(): UpgradeLevels {
  const saved = loadUpgradeLevels();
  const levels = emptyLevels();
  for (const u of UPGRADES) levels[u.id] = Math.min(saved[u.id] ?? 0, u.costs.length);
  return levels;
}

/** Efectos de las mejoras compradas, para aplicarlos al empezar una partida */
export const currentUpgradeEffects = () => upgradeEffects(upgradeLevels());

/** Compra el siguiente nivel de una mejora si se puede. Devuelve si se ha comprado */
export function buyUpgrade(id: UpgradeId): boolean {
  const levels = upgradeLevels();
  if (blockReason(id, levels, loadPoints())) return false;
  addPoints(-upgradeById(id).costs[levels[id]]);
  saveUpgradeLevels({ ...levels, [id]: levels[id] + 1 });
  return true;
}

/** Quita todas las mejoras y devuelve los puntos gastados en ellas. Devuelve cuántos */
export function refundUpgrades(): number {
  const refund = spentPoints(upgradeLevels());
  addPoints(refund);
  saveUpgradeLevels(emptyLevels());
  return refund;
}

/** Objetos comprados en la tienda (solo los que siguen existiendo) */
export const ownedItems = (): Set<string> => new Set(loadOwnedItems().filter((id) => !!itemById(id)));

/** Por qué no se puede comprar un objeto, o null si se puede */
export function itemBlockReason(id: string): 'owned' | 'soon' | 'points' | null {
  const item = itemById(id);
  if (!item || !isItemUseful(item)) return 'soon';
  if (ownedItems().has(id)) return 'owned';
  if (loadPoints() < item.price) return 'points';
  return null;
}

/** Compra un objeto con los puntos de la cuenta. Devuelve si se ha comprado */
export function buyItem(id: string): boolean {
  const item = itemById(id);
  if (!item || itemBlockReason(id)) return false;
  addPoints(-item.price);
  saveOwnedItems([...ownedItems(), id]);
  return true;
}

/** Pokémon que se pueden usar en las partidas: los iniciales y los comprados */
export const ownedPokemon = (): Set<string> =>
  new Set([...STARTERS, ...loadOwnedPokemon().filter((id) => TOWERS.some((t) => t.id === id))]);

/** Por qué no se puede comprar un Pokémon, o null si se puede */
export function pokemonBlockReason(id: string): 'owned' | 'points' | 'unknown' | null {
  if (!TOWERS.some((t) => t.id === id)) return 'unknown';
  if (ownedPokemon().has(id)) return 'owned';
  if (loadPoints() < pokemonPrice(id)) return 'points';
  return null;
}

/** Compra un Pokémon con los puntos de la cuenta. Devuelve si se ha comprado */
export function buyPokemon(id: string): boolean {
  if (pokemonBlockReason(id)) return false;
  addPoints(-pokemonPrice(id));
  saveOwnedPokemon([...loadOwnedPokemon(), id]);
  // Si cabe, se une al equipo directamente
  const team = currentTeam();
  if (team.length < teamSize()) setTeam([...team, id]);
  return true;
}

/** Huecos del equipo: los de base más los que abre la mejora AMISTAD */
export const teamSize = () => Math.min(MAX_TEAM_SIZE, BASE_TEAM_SIZE + currentUpgradeEffects().teamSlots);

/** Equipo actual: los Pokémon (ids) que se llevan a las partidas, en orden */
export const currentTeam = (): string[] =>
  sanitizeTeam(loadTeam(), ownedPokemon(), TOWERS.map((t) => t.id), teamSize());

/** Guarda el equipo (se corrige si trae Pokémon que no se tienen o demasiados) */
export function setTeam(ids: string[]): void {
  saveTeam(sanitizeTeam(ids, ownedPokemon(), TOWERS.map((t) => t.id), teamSize()));
}
