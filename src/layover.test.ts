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
  it('has the expected airports with complete fields', () => {
    expect(airports.map((airport) => airport.code)).toEqual(
      expect.arrayContaining(['ATL', 'ORD', 'DFW', 'DEN', 'JFK', 'LAX', 'SFO', 'SEA', 'DTW', 'BOS', 'MIA', 'LHR']),
    );
    for (const airport of airports) {
      expect(airport.cityIdeas.length).toBeGreaterThanOrEqual(3);
      expect(airport.airportIdeas.length).toBeGreaterThanOrEqual(1);
      expect(() => new Intl.DateTimeFormat('en-US', { timeZone: airport.timezone })).not.toThrow();
      for (const idea of [...airport.cityIdeas, ...airport.airportIdeas]) {
        expect(['indoor', 'outdoor']).toContain(idea.setting);
        expect(idea.minutes).toBeGreaterThan(0);
      }
    }
  });
});
