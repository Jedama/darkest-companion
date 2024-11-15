// src/types/statTypes.ts
export type StatName = 'strength' | 'agility' | 'intelligence' | 'authority' | 'sociability';

export interface StatDefinition {
  name: StatName;
  color: string;
  icon?: string;
}

export const STAT_DEFINITIONS: Record<StatName, StatDefinition> = {
  strength: {
    name: 'strength',
    color: '#ff4136'
  },
  agility: {
    name: 'agility',
    color: '#2ecc40'
  },
  intelligence: {
    name: 'intelligence',
    color: '#0074d9'
  },
  authority: {
    name: 'authority',
    color: '#b10dc9'
  },
  sociability: {
    name: 'sociability',
    color: '#ffdc00'
  }
};