export const TILE = 32;
export const COLS = 24;
export const ROWS = 18;
// Los valores en píxeles de torres y enemigos (alcance, velocidad, tamaño...) están
// pensados para casillas de 48 px y se multiplican por este factor
export const SCALE = TILE / 48;
export const MAP_W = TILE * COLS;
export const MAP_H = TILE * ROWS;
export const SIDEBAR_W = 240;
export const GAME_W = MAP_W + SIDEBAR_W;
export const GAME_H = MAP_H;

// Dinero, vidas y dificultad de cada mapa: ver DIFFICULTIES en data/map.ts
export const SELL_RATIO = 0.6;
