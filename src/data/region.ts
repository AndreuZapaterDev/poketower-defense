/**
 * Mapa de la región para elegir mapa, al estilo del Mapa Pueblo de los juegos. Las coordenadas
 * van de 0 a 1 dentro del recuadro del mapa. Los lugares con `mapId` se pueden jugar; los demás
 * (pueblos y ciudades de paso) son decorado, igual que los caminos con `future`.
 */
export type PlaceKind = 'town' | 'city' | 'route';

export interface RegionPlace {
  id: string;
  name: string;
  kind: PlaceKind;
  x: number;
  y: number;
  /** Mapa (id de MAPS) que se juega en este lugar */
  mapId?: string;
}

export const REGION_PLACES: RegionPlace[] = [
  { id: 'paleta', name: 'PUEBLO PALETA', kind: 'town', x: 0.36, y: 0.86 },
  { id: 'ruta1', name: 'RUTA 1', kind: 'route', x: 0.36, y: 0.67, mapId: 'ruta1' },
  { id: 'verde', name: 'CIUDAD VERDE', kind: 'city', x: 0.36, y: 0.5 },
  { id: 'ruta2', name: 'RUTA 2', kind: 'route', x: 0.36, y: 0.33, mapId: 'ruta2' },
  { id: 'plateada', name: 'CIUDAD PLATEADA', kind: 'city', x: 0.36, y: 0.13, mapId: 'gimnasioplateada' },
];

/** Caminos entre lugares; con `future`, de mapas que aún no existen (se dibujan punteados) */
export const REGION_ROADS: { from: [number, number]; to: [number, number]; future?: boolean }[] = [
  { from: [0.36, 0.86], to: [0.36, 0.13] },
  // Ruta 22, al oeste de Ciudad Verde
  { from: [0.36, 0.5], to: [0.1, 0.5], future: true },
  // Ruta 3 hacia el Monte Moon, al este de Ciudad Plateada
  { from: [0.36, 0.13], to: [0.78, 0.13], future: true },
  // Ruta 21, por el mar al sur de Pueblo Paleta
  { from: [0.36, 0.86], to: [0.36, 1], future: true },
];

/** Bosque Verde, sobre la Ruta 2 (decorado) */
export const REGION_FOREST = { x: 0.24, y: 0.24, w: 0.24, h: 0.18 };
/** Monte Moon, al final de la Ruta 3 (decorado) */
export const REGION_MOUNTAIN = { x: 0.8, y: 0.13 };

export const placeForMap = (mapId: string) => REGION_PLACES.find((p) => p.mapId === mapId);
