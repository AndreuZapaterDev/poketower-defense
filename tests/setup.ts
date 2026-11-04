import { vi } from 'vitest';

// Los datos del juego se cargan fuera del navegador: config.ts calcula las columnas del mapa a
// partir del tamaño de la ventana, así que se simula una (los tests la cambian para probar
// pantallas más anchas).
Object.defineProperty(globalThis, 'window', {
  value: { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1 },
  writable: true,
  configurable: true,
});

// Phaser necesita un navegador de verdad; de él, los datos solo usan Vector2
vi.mock('phaser', () => {
  class Vector2 {
    constructor(
      public x = 0,
      public y = 0,
    ) {}
  }
  return { default: { Math: { Vector2 } } };
});
