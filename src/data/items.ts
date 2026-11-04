import { TOWERS } from './towers';
import type { PokeType } from './types';

/**
 * Objetos de la tienda de la cuenta (se pagan con puntos). Por ahora, las Tablas: cada una
 * potencia los ataques de un tipo, como en los juegos. Una vez comprada sirve en todas las
 * partidas: todos los Pokémon de ese tipo hacen más daño.
 */
export interface ItemDef {
  id: string;
  name: string;
  /** Imagen en public/assets/items (48x48) */
  file: string;
  /** Tipo que potencia; null si es de un tipo que aún no existe en el juego */
  type: PokeType | null;
  price: number;
  description: string;
}

/** Daño extra de los Pokémon del tipo de una Tabla comprada */
export const PLATE_BONUS = 0.2;
export const PLATE_PRICE = 120;

const plate = (id: string, name: string, file: string, type: PokeType | null, typeName: string): ItemDef => ({
  id,
  name,
  file,
  type,
  price: PLATE_PRICE,
  description: `Tabla de tipo ${typeName}. Los ataques de tus Pokémon de tipo ${typeName} hacen un ${Math.round(PLATE_BONUS * 100)} % más de daño en todas las partidas.`,
});

export const ITEMS: ItemDef[] = [
  plate('flameplate', 'TABLA LLAMA', 'FLAMEPLATE', 'fire', 'Fuego'),
  plate('splashplate', 'TABLA LINFA', 'SPLASHPLATE', 'water', 'Agua'),
  plate('meadowplate', 'TABLA PRADO', 'MEADOWPLATE', 'grass', 'Planta'),
  plate('fistplate', 'TABLA FUERTE', 'FISTPLATE', 'fighting', 'Lucha'),
  plate('zapplate', 'TABLA TRUENO', 'ZAPPLATE', 'electric', 'Eléctrico'),
  plate('skyplate', 'TABLA CIELO', 'SKYPLATE', 'flying', 'Volador'),
  plate('insectplate', 'TABLA BICHO', 'INSECTPLATE', 'bug', 'Bicho'),
  plate('toxicplate', 'TABLA TOXICA', 'TOXICPLATE', 'poison', 'Veneno'),
  plate('stoneplate', 'TABLA PETREA', 'STONEPLATE', 'rock', 'Roca'),
  plate('earthplate', 'TABLA TERRAX', 'EARTHPLATE', 'ground', 'Tierra'),
  plate('mindplate', 'TABLA MENTAL', 'MINDPLATE', 'psychic', 'Psíquico'),
  plate('icicleplate', 'TABLA GELIDA', 'ICICLEPLATE', null, 'Hielo'),
  plate('spookyplate', 'TABLA TERROR', 'SPOOKYPLATE', null, 'Fantasma'),
  plate('dracoplate', 'TABLA DRACO', 'DRACOPLATE', null, 'Dragón'),
  plate('dreadplate', 'TABLA OSCURA', 'DREADPLATE', null, 'Siniestro'),
  plate('ironplate', 'TABLA ACERO', 'IRONPLATE', null, 'Acero'),
  plate('pixieplate', 'TABLA DUENDE', 'PIXIEPLATE', null, 'Hada'),
];

export const itemKey = (item: ItemDef) => `item-${item.id}`;
export const itemPath = (item: ItemDef) => `assets/items/${item.file}.png`;
export const itemById = (id: string) => ITEMS.find((i) => i.id === id);

/** Si alguno de los Pokémon de la tienda es del tipo del objeto (si no, aún no sirve de nada) */
export const isItemUseful = (item: ItemDef) => !!item.type && TOWERS.some((t) => t.type === item.type);

/** Multiplicador de daño de un tipo según las Tablas compradas */
export const plateMultiplier = (type: PokeType, owned: ReadonlySet<string>) =>
  ITEMS.some((i) => i.type === type && owned.has(i.id)) ? 1 + PLATE_BONUS : 1;
