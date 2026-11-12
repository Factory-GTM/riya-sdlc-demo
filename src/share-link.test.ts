import { describe, expect, it } from 'vitest';
import airportData from './data/airports.json';
import type { Airport } from './layover.ts';
import { parseQueryString, toQueryString, type LayoverInputs } from './share-link.ts';

const codes = (airportData as Airport[]).map((airport) => airport.code);
const inputs: LayoverInputs = { airport: 'ORD', arrival: '2026-11-13T12:00', hours: 5, minutes: 0, international: false };
const query = 'airport=ORD&arrival=2026-11-13T12%3A00&hours=5&minutes=0&international=0';

function withParam(name: string, value: string | null): string {
  const params = new URLSearchParams(query);
  if (value === null) params.delete(name);
  else params.set(name, value);
  return params.toString();
}

describe('toQueryString', () => {
  it('writes every input in a fixed order', () => {
    expect(toQueryString(inputs)).toBe(query);
  });

  it('writes international as 1 or 0', () => {
    expect(new URLSearchParams(toQueryString({ ...inputs, international: true })).get('international')).toBe('1');
    expect(new URLSearchParams(toQueryString(inputs)).get('international')).toBe('0');
  });
});

describe('parseQueryString', () => {
  it('reads back what toQueryString writes', () => {
    const international = { ...inputs, airport: 'LHR', hours: 23, minutes: 55, international: true };
    expect(parseQueryString(toQueryString(inputs), codes)).toEqual(inputs);
    expect(parseQueryString(toQueryString(international), codes)).toEqual(international);
  });

  it('accepts a leading "?" and an unencoded colon, and ignores extra params', () => {
    expect(parseQueryString('?airport=ORD&arrival=2026-11-13T12:00&hours=5&minutes=0&international=0&utm=x', codes)).toEqual(
      inputs,
    );
  });

  it('accepts zero-padded numbers', () => {
    expect(parseQueryString(withParam('hours', '05'), codes)).toEqual(inputs);
  });

  it.each(['', '?', 'foo=bar'])('returns null for a query with no layover (%j)', (search) => {
    expect(parseQueryString(search, codes)).toBeNull();
  });

  it.each(['airport', 'arrival', 'hours', 'minutes', 'international'])('returns null when %s is missing', (name) => {
    expect(parseQueryString(withParam(name, null), codes)).toBeNull();
  });

  it.each([
    ['airport', 'XXX'],
    ['airport', 'ord'],
    ['airport', ''],
    ['arrival', '2026-11-13'],
    ['arrival', '2026-11-13 12:00'],
    ['arrival', '2026-02-30T12:00'],
    ['arrival', '2026-11-13T25:00'],
    ['arrival', 'tomorrow'],
    ['hours', '24'],
    ['hours', '-1'],
    ['hours', '1.5'],
    ['hours', 'abc'],
    ['hours', ''],
    ['minutes', '60'],
    ['minutes', '7'],
    ['minutes', '1e1'],
    ['international', 'yes'],
    ['international', 'true'],
    ['international', ''],
  ])('returns null when %s is %j', (name, value) => {
    expect(parseQueryString(withParam(name, value), codes)).toBeNull();
  });
});
