import { describe, expect, it, vi } from 'vitest';

type MapModule = typeof import('../src/data/map');
type Tile = [number, number];

/**
 * Carga los mapas como si la ventana tuviera `width` x `height` px: el número de columnas se
 * calcula al cargar config.ts, así que hay que volver a importar los módulos para cada tamaño
 */
async function loadMaps(width: number, height: number): Promise<{ m: MapModule; cols: number; rows: number }> {
  (globalThis as { window: { innerWidth: number; innerHeight: number } }).window.innerWidth = width;
  (globalThis as { window: { innerWidth: number; innerHeight: number } }).window.innerHeight = height;
  vi.resetModules();
  const config = await import('../src/config');
  const m = await import('../src/data/map');
  return { m, cols: config.COLS, rows: config.ROWS };
}

const key = ([c, r]: Tile) => `${c},${r}`;

/** Lo que ocupa cada elemento decorativo de un mapa; los árboles pueden solaparse entre sí */
function footprints(m: MapModule, def: MapModule['MAPS'][number]) {
  const items: { name: string; tiles: Tile[]; tree: boolean }[] = [];
  const add = (name: string, tiles: Tile[], tree = false) => items.push({ name, tiles, tree });
  for (const t of def.trees) add(`pino ${t}`, def.tileset ? m.pineTiles(t) : [t], true);
  for (const p of def.props ?? []) add(`${p.kind} ${p.at}`, m.propTiles(p), true);
  for (const t of def.tallGrass) add(`hierba alta ${t}`, [t]);
  for (const t of def.flowers ?? []) add(`flores ${t}`, [t]);
  for (const n of def.npcs ?? []) add(`entrenador ${n.sprite}`, [n.at]);
  for (const t of def.rocks ?? []) add(`roca ${t}`, [t]);
  for (const t of def.bushes ?? []) add(`arbusto ${t}`, [t]);
  for (const t of def.fences ?? []) add(`valla ${t}`, [t]);
  for (const [c, r] of def.statues ?? []) add(`estatua ${[c, r]}`, [[c, r - 1], [c, r]]);
  for (const p of def.ponds) add(`estanque ${p}`, m.pondTiles(p));
  if (def.sign) add(`cartel ${def.sign}`, [def.sign]);
  return items;
}

describe.each([
  ['24 columnas', 1280, 720],
  ['pantalla ancha', 2560, 720],
])('mapas (%s)', (_label, width, height) => {
  it('cada mapa tiene su lugar en el mapa de la región', async () => {
    const { m } = await loadMaps(width, height);
    const { REGION_PLACES } = await import('../src/data/region');
    for (const def of m.MAPS) expect(REGION_PLACES.some((p) => p.mapId === def.id), def.id).toBe(true);
  });

  it('tienen ids distintos', async () => {
    const { m } = await loadMaps(width, height);
    const ids = m.MAPS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('el camino va en tramos rectos, entra desde fuera y el spawn está en él', async () => {
    const { m, cols, rows } = await loadMaps(width, height);
    const inside = ([c, r]: Tile) => c >= 0 && r >= 0 && c < cols && r < rows;
    for (const def of m.MAPS) {
      def.path.slice(1).forEach(([c, r], i) => {
        const [pc, pr] = def.path[i];
        expect(c === pc || r === pr, `${def.id}: tramo ${[pc, pr]} -> ${[c, r]} en diagonal`).toBe(true);
      });
      expect(inside(def.path[0]), `${def.id}: el camino debe empezar fuera del mapa`).toBe(false);
      const end = def.path[def.path.length - 1];
      if (def.goal === 'exit') expect(inside(end), `${def.id}: la salida debe acabar fuera`).toBe(false);
      else expect(inside(end), `${def.id}: la meta debe estar dentro del mapa`).toBe(true);
      const map = new m.RouteMap(def);
      expect(map.centerline.map(key), `${def.id}: el spawn no está en el camino`).toContain(key(def.spawn));
    }
  });

  it('nada se pone encima del camino, de la meta ni de otra cosa', async () => {
    const { m, cols, rows } = await loadMaps(width, height);
    for (const def of m.MAPS) {
      const map = new m.RouteMap(def);
      const goal = map.leaderStage ?? map.pokecenter;
      const inGoal = ([c, r]: Tile) =>
        !!goal && c * 32 >= goal.x && c * 32 < goal.x + goal.w && r * 32 >= goal.y && r * 32 < goal.y + goal.h;
      const owner = new Map<string, { name: string; tree: boolean }>();
      const problems: string[] = [];
      for (const item of footprints(m, def)) {
        for (const tile of item.tiles) {
          const [c, r] = tile;
          if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
          if (map.isPath(c, r)) problems.push(`${item.name} pisa el camino en ${tile}`);
          if (inGoal(tile)) problems.push(`${item.name} pisa la meta en ${tile}`);
          const prev = owner.get(key(tile));
          if (prev && !(prev.tree && item.tree)) problems.push(`${item.name} se solapa con ${prev.name} en ${tile}`);
          if (!prev || !item.tree) owner.set(key(tile), item);
        }
      }
      expect(problems, def.id).toEqual([]);
    }
  });

  it('la hierba alta y las flores no tocan el camino (sus bordes taparían las hojas)', async () => {
    const { m } = await loadMaps(width, height);
    for (const def of m.MAPS) {
      const map = new m.RouteMap(def);
      const touching = [...def.tallGrass, ...(def.flowers ?? [])].filter(([c, r]) =>
        [-1, 0, 1].some((dr) => [-1, 0, 1].some((dc) => map.isPath(c + dc, r + dr))),
      );
      expect(touching, def.id).toEqual([]);
    }
  });

  it('hay sitio de sobra para construir junto al camino', async () => {
    const { m, cols, rows } = await loadMaps(width, height);
    for (const def of m.MAPS) {
      const map = new m.RouteMap(def);
      let nearPath = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!map.isBuildable(c, r)) continue;
          const near = [-1, 0, 1].some((dr) => [-1, 0, 1].some((dc) => map.isPath(c + dc, r + dr)));
          if (near) nearPath++;
        }
      }
      expect(nearPath, `${def.id}: casillas para construir pegadas al camino`).toBeGreaterThanOrEqual(40);
    }
  });

  it('los desbloqueos apuntan a mapas que existen, sin ciclos, y el primero está abierto', async () => {
    const { m } = await loadMaps(width, height);
    expect(m.MAPS[0].unlockedBy).toBeUndefined();
    for (const def of m.MAPS) {
      const seen = new Set<string>();
      let current: string | undefined = def.id;
      while (current) {
        expect(seen.has(current), `${def.id}: ciclo de desbloqueos`).toBe(false);
        seen.add(current);
        const next: string | undefined = m.MAPS.find((d) => d.id === current)?.unlockedBy;
        if (next) expect(m.MAPS.some((d) => d.id === next), `${def.id}: desbloquea con ${next}, que no existe`).toBe(true);
        current = next;
      }
    }
  });
});
