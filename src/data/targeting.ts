/** A qué Pokémon salvaje ataca cada torre */
export type TargetMode = 'first' | 'last' | 'strong' | 'close';
export const TARGET_MODES: TargetMode[] = ['first', 'last', 'strong', 'close'];
export const TARGET_LABELS: Record<TargetMode, string> = {
  first: 'PRIMERO',
  last: 'ULTIMO',
  strong: 'MAS FUERTE',
  close: 'MAS CERCANO',
};
