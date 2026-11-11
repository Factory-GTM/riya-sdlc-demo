import { describe, expect, it } from 'vitest';
import airportData from './data/airports.json';
import { formatMinutes, pickIdeas, usableTime, verdictFor, type Airport } from './layover.ts';

const airports = airportData as Airport[];
const ord = airports.find((airport) => airport.code === 'ORD')!;

describe('usableTime', () => {
  it('subtracts deplane, round-trip transit and security', () => {
    expect(usableTime(ord, 300, false)).toEqual({
      layover: 300,
      deplane: 20,
      transit: 90,
      security: 30,
      customs: 0,
      usable: 160,
    });
  });

  it('subtracts customs only for international arrivals', () => {
    expect(usableTime(ord, 300, true).customs).toBe(45);
    expect(usableTime(ord, 300, true).usable).toBe(115);
  });

  it('can go negative on short layovers', () => {
    expect(usableTime(ord, 60, false).usable).toBe(-80);
  });

  it('gives SIN a Yes exactly at the international 120-minute boundary', () => {
    const sin = airports.find((airport) => airport.code === 'SIN')!;
    // International usable = 325 - 20 - 2 x 40 - 60 - 45 = 120.
    const usable = usableTime(sin, 325, true).usable;
    expect(usable).toBe(120);
    expect(verdictFor(usable)).toBe('yes');
  });

  it('gives YYZ a Tight exactly at the international 45-minute boundary', () => {
    const yyz = airports.find((airport) => airport.code === 'YYZ')!;
    // International usable = 325 - 20 - 2 x 40 - 90 - 90 = 45.
    const usable = usableTime(yyz, 325, true).usable;
    expect(usable).toBe(45);
    expect(verdictFor(usable)).toBe('tight');
  });
});

describe('verdictFor', () => {
  it.each([
    [240, 'yes'],
    [120, 'yes'],
    [119, 'tight'],
    [45, 'tight'],
    [44, 'stay'],
    [-30, 'stay'],
  ])('%i usable minutes is %s', (usable, verdict) => {
    expect(verdictFor(usable)).toBe(verdict);
  });
});

describe('pickIdeas', () => {
  const names = (ideas: { name: string }[]) => ideas.map((idea) => idea.name);

  it('uses city ideas in data order for Yes', () => {
    expect(names(pickIdeas(ord, 'yes', 10))).toEqual([
      'Millennium Park and Cloud Gate',
      'Chicago Riverwalk',
      'Art Institute of Chicago',
    ]);
  });

  it('puts the quickest city ideas first for Tight', () => {
    expect(names(pickIdeas(ord, 'tight', null))).toEqual([
      'Millennium Park and Cloud Gate',
      'Chicago Cultural Center',
      'Chicago Riverwalk',
    ]);
  });

  it('puts indoor ideas first when rain is likely', () => {
    expect(names(pickIdeas(ord, 'yes', 50))).toEqual([
      'Art Institute of Chicago',
      'Chicago Cultural Center',
      'Millennium Park and Cloud Gate',
    ]);
    expect(names(pickIdeas(ord, 'tight', 80))).toEqual([
      'Chicago Cultural Center',
      'Art Institute of Chicago',
      'Millennium Park and Cloud Gate',
    ]);
  });

  it('keeps the normal order just below the rain threshold', () => {
    expect(names(pickIdeas(ord, 'yes', 49))[0]).toBe('Millennium Park and Cloud Gate');
  });

  it('uses airport ideas for Stay', () => {
    expect(names(pickIdeas(ord, 'stay', null))).toEqual(names(ord.airportIdeas).slice(0, 3));
  });

  it('never returns more than 3 ideas and does not change the data', () => {
    const before = names(ord.cityIdeas);
    expect(pickIdeas(ord, 'tight', 90)).toHaveLength(3);
    expect(names(ord.cityIdeas)).toEqual(before);
  });
});

describe('formatMinutes', () => {
  it.each([
    [45, '45m'],
    [5, '5m'],
    [125, '2h 05m'],
    [120, '2h 00m'],
    [-80, '-1h 20m'],
  ])('%i is %s', (minutes, text) => {
    expect(formatMinutes(minutes)).toBe(text);
  });
});

describe('airport data', () => {
  const expectMinutes = (minutes: number, minimum: number, maximum: number) => {
    expect(Number.isInteger(minutes)).toBe(true);
    expect(minutes).toBeGreaterThanOrEqual(minimum);
    expect(minutes).toBeLessThanOrEqual(maximum);
  };

  it('has the expected airports in unique code order for the dropdown', () => {
    const codes = airports.map((airport) => airport.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toEqual([...codes].sort());
    expect(airports.map((airport) => airport.code)).toEqual(
      expect.arrayContaining(['ATL', 'ORD', 'DFW', 'DEN', 'JFK', 'LAX', 'SFO', 'SEA', 'DTW', 'BOS', 'MIA', 'LHR', 'SIN', 'YYZ']),
    );
  });

  it.each(airports)('$code has complete fields and valid coordinates and time zone', (airport) => {
    expect(airport.code).toMatch(/^[A-Z]{3}$/);
    for (const value of [airport.name, airport.city, airport.timezone]) {
      expect(typeof value).toBe('string');
      expect(value.trim().length).toBeGreaterThan(0);
    }
    expect(Number.isFinite(airport.latitude)).toBe(true);
    expect(airport.latitude).toBeGreaterThanOrEqual(-90);
    expect(airport.latitude).toBeLessThanOrEqual(90);
    expect(Number.isFinite(airport.longitude)).toBe(true);
    expect(airport.longitude).toBeGreaterThanOrEqual(-180);
    expect(airport.longitude).toBeLessThanOrEqual(180);
    expect(() => new Intl.DateTimeFormat('en-US', { timeZone: airport.timezone })).not.toThrow();
  });

  it.each(airports)('$code has bounded whole-minute estimates', (airport) => {
    // Allow short airport links through two-hour transfers/queues; customs up to three hours.
    expectMinutes(airport.transitToCityMinutes, 5, 120);
    expectMinutes(airport.securityMinutes, 5, 120);
    expectMinutes(airport.customsMinutes, 1, 180);
  });

  it.each(airports)('$code has enough distinct, complete ideas', (airport) => {
    expect(airport.cityIdeas.length).toBeGreaterThanOrEqual(3);
    expect(airport.airportIdeas.length).toBeGreaterThanOrEqual(1);
    const ideas = [...airport.cityIdeas, ...airport.airportIdeas];
    const names = ideas.map((idea) => idea.name.trim().toLowerCase());
    expect(new Set(names).size).toBe(ideas.length);
    for (const idea of ideas) {
      expect(typeof idea.name).toBe('string');
      expect(idea.name.trim().length).toBeGreaterThan(0);
      expect(['indoor', 'outdoor']).toContain(idea.setting);
      // Five minutes for a quick look, eight hours for a full-day public attraction.
      expectMinutes(idea.minutes, 5, 480);
    }
  });
});
