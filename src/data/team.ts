/**
 * Equipo: los Pokémon que se llevan a la partida (y salen en la tienda de la barra lateral).
 * Se elige en la pantalla EQUIPO, al estilo del PC de los juegos.
 *
 * Se empieza con BASE_TEAM_SIZE huecos y la mejora AMISTAD de la cuenta (ver upgrades.ts) abre
 * más, hasta MAX_TEAM_SIZE, como el equipo de 6 de los juegos.
 */
export const BASE_TEAM_SIZE = 4;
export const MAX_TEAM_SIZE = 6;

/**
 * Tarjetas de Pokémon de la tienda de la barra lateral durante la partida: sitio para el equipo
 * más grande. Las tarjetas se hacen más bajas cuantas más caben (ver Sidebar.ts).
 */
export const SIDEBAR_SHOP_SLOTS = MAX_TEAM_SIZE;

/**
 * Ids de Pokémon válidos para un equipo de `size` huecos: sin repetir, solo los que se tienen y
 * como mucho `size`
 */
export function sanitizeTeam(
  ids: readonly string[],
  owned: ReadonlySet<string>,
  order: readonly string[],
  size: number,
): string[] {
  const team = [...new Set(ids)].filter((id) => owned.has(id)).slice(0, size);
  // Sin equipo guardado (o si ya no vale nada), los primeros que se tengan
  return team.length ? team : order.filter((id) => owned.has(id)).slice(0, size);
}
