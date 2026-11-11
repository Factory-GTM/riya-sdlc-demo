import { describe, expect, it, vi } from 'vitest';
import airportData from './data/airports.json';
import fixture from './fixtures/open-meteo-ord.json';
import type { Airport } from './layover.ts';
import { addMinutes, describeWeatherCode, fetchLayoverWeather, forecastUrl, localDate, parseHourly } from './weather.ts';

const ord = (airportData as Airport[]).find((airport) => airport.code === 'ORD')!;
// Noon UTC on Nov 11 is 06:00 in Chicago, so "today" there is 2026-11-11.
const now = new Date('2026-11-11T12:00:00Z');

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('describeWeatherCode', () => {
  it.each([
    [0, 'Clear'],
    [3, 'Overcast'],
    [51, 'Drizzle'],
    [73, 'Snow'],
    [95, 'Thunderstorm'],
    [42, 'Unknown'],
    [null, 'Unknown'],
  ])('code %s is %s', (code, label) => {
    expect(describeWeatherCode(code)).toBe(label);
  });
});

describe('addMinutes', () => {
  it('rolls over to the next day', () => {
    expect(addMinutes('2026-11-12T22:30', 150)).toBe('2026-11-13T01:00');
  });
});

describe('localDate', () => {
  it('uses the airport time zone', () => {
    expect(localDate('America/Chicago', new Date('2026-11-12T03:00:00Z'))).toBe('2026-11-11');
    expect(localDate('Europe/London', new Date('2026-11-12T03:00:00Z'))).toBe('2026-11-12');
  });
});

describe('forecastUrl', () => {
  it('asks for hourly weather at the airport in its time zone', () => {
    const url = new URL(forecastUrl(ord, '2026-11-12', '2026-11-13'));
    expect(url.origin + url.pathname).toBe('https://api.open-meteo.com/v1/forecast');
    expect(url.searchParams.get('latitude')).toBe('41.9742');
    expect(url.searchParams.get('timezone')).toBe('America/Chicago');
    expect(url.searchParams.get('hourly')).toBe('temperature_2m,precipitation_probability,weather_code');
    expect(url.searchParams.get('start_date')).toBe('2026-11-12');
    expect(url.searchParams.get('end_date')).toBe('2026-11-13');
  });
});

describe('parseHourly', () => {
  it('keeps the hours from the arrival hour to the end of the layover', () => {
    const hours = parseHourly(fixture, '2026-11-12T08:30', '2026-11-12T11:30');
    expect(hours.map((hour) => hour.time)).toEqual([
      '2026-11-12T08:00',
      '2026-11-12T09:00',
      '2026-11-12T10:00',
      '2026-11-12T11:00',
    ]);
    expect(hours[0]).toEqual({ time: '2026-11-12T08:00', temperatureC: 2.6, precipitationChance: 20, condition: 'Drizzle' });
  });

  it('spans midnight', () => {
    const hours = parseHourly(fixture, '2026-11-12T22:00', '2026-11-13T01:00');
    expect(hours.map((hour) => hour.time.slice(11))).toEqual(['22:00', '23:00', '00:00', '01:00']);
  });

  it('returns nothing when the body has no hourly data', () => {
    expect(parseHourly({}, '2026-11-12T08:00', '2026-11-12T10:00')).toEqual([]);
  });
});

describe('fetchLayoverWeather', () => {
  it('returns the layover hours and the highest rain chance', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(fixture));
    const weather = await fetchLayoverWeather(ord, '2026-11-12T05:00', 180, { now, fetchFn });
    expect(weather.status).toBe('ok');
    if (weather.status !== 'ok') return;
    expect(weather.hours).toHaveLength(4);
    expect(weather.maxRainChance).toBe(20);
    const url = new URL(String(fetchFn.mock.calls[0]));
    expect(url.searchParams.get('start_date')).toBe('2026-11-12');
    expect(url.searchParams.get('end_date')).toBe('2026-11-12');
  });

  it('says "not yet" past the 16-day forecast range without calling the API', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(fixture));
    const weather = await fetchLayoverWeather(ord, '2026-11-27T09:00', 300, { now, fetchFn });
    expect(weather).toEqual({ status: 'not-yet' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('still fetches on the last forecast day and clamps the end date', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(fixture));
    const lastDayNow = new Date('2026-10-28T12:00:00Z');
    await fetchLayoverWeather(ord, '2026-11-12T22:00', 240, { now: lastDayNow, fetchFn });
    const url = new URL(String(fetchFn.mock.calls[0]));
    expect(url.searchParams.get('start_date')).toBe('2026-11-12');
    expect(url.searchParams.get('end_date')).toBe('2026-11-12');
  });

  it('reports "unavailable" when the API returns an error', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ error: true, reason: 'Parameter start_date is out of range' }, 400));
    expect(await fetchLayoverWeather(ord, '2026-11-12T05:00', 180, { now, fetchFn })).toEqual({ status: 'unavailable' });
  });

  it('reports "unavailable" when the network fails', async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await fetchLayoverWeather(ord, '2026-11-12T05:00', 180, { now, fetchFn })).toEqual({ status: 'unavailable' });
  });

  it('reports "unavailable" when no hours match the window', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ hourly: { time: [], temperature_2m: [], precipitation_probability: [], weather_code: [] } }));
    expect(await fetchLayoverWeather(ord, '2026-11-12T05:00', 180, { now, fetchFn })).toEqual({ status: 'unavailable' });
  });
});
