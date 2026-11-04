import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/data/enemies';
import { DIFFICULTY_IDS, MAPS } from '../src/data/map';
import { wavesFor } from '../src/data/waves';

const options = MAPS.flatMap((def) => DIFFICULTY_IDS.map((difficulty) => [def.id, difficulty] as const));

describe('oleadas', () => {
  it.each(options)('%s en %s: grupos válidos y un jefe en la última oleada', (mapId, difficulty) => {
    const waves = wavesFor(mapId, difficulty);
    expect(waves.length).toBeGreaterThanOrEqual(5);
    for (const wave of waves) {
      expect(wave.length).toBeGreaterThan(0);
      for (const group of wave) {
        expect(ENEMIES[group.enemy], `enemigo desconocido: ${group.enemy}`).toBeDefined();
        expect(group.count).toBeGreaterThan(0);
        expect(group.interval).toBeGreaterThanOrEqual(0);
        expect(group.delay ?? 0).toBeGreaterThanOrEqual(0);
        if (group.count > 1) expect(group.interval, `${group.enemy}: sin separación entre enemigos`).toBeGreaterThan(0);
      }
    }
    expect(waves[waves.length - 1].some((group) => ENEMIES[group.enemy].boss)).toBe(true);
  });

  it.each(MAPS.map((def) => def.id))('%s: difícil tiene más oleadas y más Pokémon que fácil', (mapId) => {
    const easy = wavesFor(mapId, 'easy');
    const hard = wavesFor(mapId, 'hard');
    expect(hard.length).toBeGreaterThan(easy.length);
    const total = (wave: (typeof easy)[number]) => wave.reduce((sum, group) => sum + group.count, 0);
    easy.forEach((wave, i) => expect(total(hard[i])).toBeGreaterThanOrEqual(total(wave)));
  });

  it('cada mapa tiene sus propias oleadas', () => {
    const firsts = MAPS.map((def) => JSON.stringify(wavesFor(def.id, 'easy')));
    expect(new Set(firsts).size).toBe(MAPS.length);
  });
});
