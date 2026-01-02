// server/services/calendarService.ts
import type { ZodiacSeason, Estate } from '../../shared/types/types.js';
import StaticGameDataManager from '../staticGameDataManager.js';

export function getZodiacForMonth(month: number): ZodiacSeason {
  const zodiacs: ZodiacSeason[] = StaticGameDataManager.getInstance().getZodiacSeasons();

  const seasonIndex = month % 12;
  return zodiacs[seasonIndex];
}

export function formatTimeSinceEvent(months: number): string {
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (years === 0) {
    return `${remainingMonths} months`;
  } else {
    return `${years} years and ${remainingMonths} months`;
  }
}