/**
 * Medallas de la ficha de entrenador: se gana una al completar el mapa de su gimnasio (en
 * cualquier dificultad). Las que aún no tienen gimnasio (`mapId` null) salen como hueco vacío,
 * esperando a que se añada ese mapa.
 */
export interface BadgeDef {
  name: string;
  /** Mapa del gimnasio que la da */
  mapId: string | null;
  /** Colores de la medalla: cuerpo y brillo */
  color: number;
  shine: number;
}

export const BADGES: BadgeDef[] = [
  { name: 'MEDALLA ROCA', mapId: 'gimnasioplateada', color: 0x9098a8, shine: 0xd8dce4 },
  { name: 'MEDALLA CASCADA', mapId: null, color: 0x58a8f0, shine: 0xc8e4f8 },
  { name: 'MEDALLA TRUENO', mapId: null, color: 0xf0c030, shine: 0xfff0a0 },
  { name: 'MEDALLA ARCOIRIS', mapId: null, color: 0x68c868, shine: 0xf0a0c8 },
  { name: 'MEDALLA ALMA', mapId: null, color: 0xd860a8, shine: 0xf8c0e0 },
  { name: 'MEDALLA PANTANO', mapId: null, color: 0xe8b830, shine: 0xfff0a8 },
  { name: 'MEDALLA VOLCAN', mapId: null, color: 0xe05030, shine: 0xf8b090 },
  { name: 'MEDALLA TIERRA', mapId: null, color: 0x70b858, shine: 0xc8f0b0 },
];
