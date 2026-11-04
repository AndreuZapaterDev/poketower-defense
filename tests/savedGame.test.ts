import { beforeEach, describe, expect, it } from 'vitest';
import { clearSavedGame, loadSavedGame, saveGame, savedGameFor, type SavedGame } from '../src/savedGame';

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
  return data;
}

const game: Omit<SavedGame, 'version'> = {
  mapId: 'ruta1',
  difficulty: 'easy',
  waveIndex: 3,
  money: 240,
  lives: 18,
  defeated: 40,
  towers: [
    { tower: 'charmander', col: 6, row: 5, stage: 1, level: 18, exp: 12, kills: 9, damage: 900, target: 'strong', spent: 250, expLevels: 6, skills: ['power1', 'range1'] },
  ],
};

describe('partida guardada', () => {
  let storage: Map<string, string>;
  beforeEach(() => {
    storage = fakeStorage();
  });

  it('se recupera tal como se guardó', () => {
    saveGame(game);
    expect(loadSavedGame()).toEqual({ version: 1, ...game });
    expect(savedGameFor('ruta1', 'easy')).not.toBeNull();
    expect(savedGameFor('ruta1', 'hard')).toBeNull();
  });

  it('se puede borrar', () => {
    saveGame(game);
    clearSavedGame();
    expect(loadSavedGame()).toBeNull();
  });

  it('descarta las torres que ya no existen o con una fase imposible', () => {
    saveGame({
      ...game,
      towers: [
        ...game.towers,
        { ...game.towers[0], tower: 'mewtwo' },
        { ...game.towers[0], stage: 9 },
      ],
    });
    expect(loadSavedGame()?.towers).toHaveLength(1);
  });

  it('carga partidas de antes de las habilidades y descarta habilidades desconocidas', () => {
    const { expLevels, skills, ...old } = game.towers[0];
    void expLevels;
    void skills;
    saveGame({ ...game, towers: [old as never, { ...game.towers[0], skills: ['power1', 'volar'] as never }] });
    const towers = loadSavedGame()?.towers;
    expect(towers?.[0]).toMatchObject({ expLevels: 0, skills: [] });
    expect(towers?.[1].skills).toEqual(['power1']);
  });

  it('ignora datos corruptos o de un mapa que ya no existe', () => {
    storage.set('poketower.savedGame', '{no es json');
    expect(loadSavedGame()).toBeNull();
    saveGame({ ...game, mapId: 'ruta99' });
    expect(loadSavedGame()).toBeNull();
    saveGame({ ...game, lives: 0 });
    expect(loadSavedGame()).toBeNull();
  });
});
