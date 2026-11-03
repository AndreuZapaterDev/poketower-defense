export const TILE = 32;
export const ROWS = 18;
// Los valores en píxeles de torres y enemigos (alcance, velocidad, tamaño...) están
// pensados para casillas de 48 px y se multiplican por este factor
export const SCALE = TILE / 48;
export const MAP_H = TILE * ROWS;
export const GAME_H = MAP_H;
// Para que el juego llene el ancho de la ventana (sin bandas negras a los lados), el mapa
// gana columnas de hierba a la derecha y la barra lateral se queda lo que sobre (menos de
// una casilla). Se calcula una vez al arrancar.
const MIN_COLS = 24;
const MAX_COLS = 36;
const MIN_SIDEBAR_W = 240;
const screenW = Math.round((GAME_H * window.innerWidth) / Math.max(1, window.innerHeight));
export const COLS = Math.min(MAX_COLS, Math.max(MIN_COLS, Math.floor((screenW - MIN_SIDEBAR_W) / TILE)));
export const MAP_W = TILE * COLS;
export const SIDEBAR_W = Math.max(MIN_SIDEBAR_W, Math.min(MIN_SIDEBAR_W + TILE - 1, screenW - MAP_W));
export const GAME_W = MAP_W + SIDEBAR_W;
// El lienzo se dibuja a la resolución real de la pantalla: este factor (entero, para que el
// pixel art no se deforme) multiplica las medidas del juego. Las cámaras usan el mismo zoom,
// así que el código sigue trabajando en coordenadas de GAME_W x GAME_H.
const screenScale = Math.min(window.innerWidth / GAME_W, window.innerHeight / GAME_H) * (window.devicePixelRatio || 1);
export const RENDER_ZOOM = Math.min(4, Math.max(1, Math.ceil(screenScale)));

// Dinero, vidas y dificultad de cada mapa: ver DIFFICULTIES en data/map.ts
export const SELL_RATIO = 0.6;
