import { describe, expect, it } from 'vitest';
import {
  ALL_SKILLS,
  LEVELS_PER_POINT,
  POINTS_PER_STAGE,
  SKILL,
  SPECIAL_TEXT,
  canLearn,
  skillBranches,
  skillEffects,
  skillPointsEarned,
  type SkillId,
} from '../src/data/skills';
import { TOWERS } from '../src/data/towers';

describe('árbol de habilidades', () => {
  it('tiene 3 ramas de 3 y cada habilidad pide la anterior de su rama', () => {
    const branches = skillBranches('burn');
    expect(branches).toHaveLength(3);
    for (const branch of branches) {
      expect(branch.skills).toHaveLength(3);
      expect(branch.skills[0].requires).toBeUndefined();
      expect(branch.skills[1].requires).toBe(branch.skills[0].id);
      expect(branch.skills[2].requires).toBe(branch.skills[1].id);
    }
    expect(new Set(ALL_SKILLS).size).toBe(9);
  });

  it('todos los ataques de la tienda tienen habilidad especial', () => {
    for (const tower of TOWERS) expect(SPECIAL_TEXT[tower.ability]).toBeDefined();
  });

  it('da puntos por evolucionar y por niveles de experiencia, hasta el total de habilidades', () => {
    expect(skillPointsEarned(0, 0)).toBe(0);
    expect(skillPointsEarned(1, 0)).toBe(POINTS_PER_STAGE);
    expect(skillPointsEarned(0, LEVELS_PER_POINT * 2)).toBe(2);
    expect(skillPointsEarned(2, 100)).toBe(ALL_SKILLS.length);
  });

  it('no deja aprender sin puntos, repetida ni saltándose la anterior', () => {
    const learned = new Set<SkillId>();
    expect(canLearn('power1', learned, 0, 'burn')).toBe(false);
    expect(canLearn('power2', learned, 5, 'burn')).toBe(false);
    expect(canLearn('power1', learned, 1, 'burn')).toBe(true);
    learned.add('power1');
    expect(canLearn('power1', learned, 5, 'burn')).toBe(false);
    expect(canLearn('power2', learned, 1, 'burn')).toBe(true);
  });

  it('los efectos se acumulan', () => {
    expect(skillEffects(new Set())).toEqual({
      damageMult: 1,
      rangeMult: 1,
      intervalMult: 1,
      critBonus: 0,
      lootMult: 1,
      special: false,
    });
    const all = skillEffects(new Set(ALL_SKILLS));
    expect(all.damageMult).toBeCloseTo(1 + 2 * SKILL.power);
    expect(all.rangeMult).toBeCloseTo(1 + 2 * SKILL.range);
    expect(all.intervalMult).toBeCloseTo(1 - 2 * SKILL.speed);
    expect(all.critBonus).toBe(SKILL.crit);
    expect(all.special).toBe(true);
  });
});
