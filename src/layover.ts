export interface Idea {
  name: string;
  /** Rough time needed at the spot, not counting travel. */
  minutes: number;
  setting: 'indoor' | 'outdoor';
}

export interface Airport {
  code: string;
  name: string;
  city: string;
  latitude: number;
  longitude: number;
  /** IANA time zone, e.g. "America/Chicago". */
  timezone: string;
  /** One way, airport to city center. */
  transitToCityMinutes: number;
  securityMinutes: number;
  customsMinutes: number;
  cityIdeas: Idea[];
  airportIdeas: Idea[];
}

export type Verdict = 'yes' | 'tight' | 'stay';

export interface TimeBreakdown {
  layover: number;
  deplane: number;
  transit: number;
  security: number;
  customs: number;
  usable: number;
}

export const DEPLANE_MINUTES = 20;
const YES_MINUTES = 120;
const TIGHT_MINUTES = 45;
const RAINY_CHANCE = 50;
const MAX_IDEAS = 3;

export const VERDICT_LABELS: Record<Verdict, string> = {
  yes: 'Yes, go explore',
  tight: 'Tight, stay close',
  stay: 'Stay in the airport',
};

/** Usable time outside the airport, in minutes. Can be negative. */
export function usableTime(airport: Airport, layoverMinutes: number, international: boolean): TimeBreakdown {
  const transit = 2 * airport.transitToCityMinutes;
  const customs = international ? airport.customsMinutes : 0;
  return {
    layover: layoverMinutes,
    deplane: DEPLANE_MINUTES,
    transit,
    security: airport.securityMinutes,
    customs,
    usable: layoverMinutes - DEPLANE_MINUTES - transit - airport.securityMinutes - customs,
  };
}

export function verdictFor(usableMinutes: number): Verdict {
  if (usableMinutes >= YES_MINUTES) return 'yes';
  if (usableMinutes >= TIGHT_MINUTES) return 'tight';
  return 'stay';
}

/**
 * Up to 3 ideas: city ideas for Yes and Tight (quickest first when Tight), airport ideas for Stay.
 * When rain is likely, indoor ideas come first.
 */
export function pickIdeas(airport: Airport, verdict: Verdict, rainChance: number | null): Idea[] {
  const ideas = verdict === 'stay' ? [...airport.airportIdeas] : [...airport.cityIdeas];
  if (verdict === 'tight') ideas.sort((a, b) => a.minutes - b.minutes);
  if (rainChance !== null && rainChance >= RAINY_CHANCE) {
    ideas.sort((a, b) => Number(b.setting === 'indoor') - Number(a.setting === 'indoor'));
  }
  return ideas.slice(0, MAX_IDEAS);
}

/** Formats minutes as "2h 05m" or "45m"; negative values get a minus sign. */
export function formatMinutes(minutes: number): string {
  const sign = minutes < 0 ? '-' : '';
  const total = Math.abs(minutes);
  const hours = Math.floor(total / 60);
  const rest = String(total % 60).padStart(hours > 0 ? 2 : 1, '0');
  return hours > 0 ? `${sign}${hours}h ${rest}m` : `${sign}${rest}m`;
}
