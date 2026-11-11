import type { Airport } from './layover.ts';

export interface HourlyForecast {
  /** Local time at the airport, "YYYY-MM-DDTHH:00". */
  time: string;
  temperatureC: number;
  precipitationChance: number | null;
  condition: string;
}

export type LayoverWeather =
  | { status: 'ok'; hours: HourlyForecast[]; maxRainChance: number | null }
  | { status: 'not-yet' }
  | { status: 'unavailable' };

interface OpenMeteoResponse {
  hourly?: {
    time: string[];
    temperature_2m: (number | null)[];
    precipitation_probability: (number | null)[];
    weather_code: (number | null)[];
  };
}

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
/** Open-Meteo forecasts today plus the next 15 days. */
export const FORECAST_DAYS = 16;

const CONDITIONS: [codes: number[], label: string][] = [
  [[0], 'Clear'],
  [[1], 'Mostly clear'],
  [[2], 'Partly cloudy'],
  [[3], 'Overcast'],
  [[45, 48], 'Fog'],
  [[51, 53, 55], 'Drizzle'],
  [[56, 57], 'Freezing drizzle'],
  [[61, 63, 65], 'Rain'],
  [[66, 67], 'Freezing rain'],
  [[71, 73, 75, 77], 'Snow'],
  [[80, 81, 82], 'Rain showers'],
  [[85, 86], 'Snow showers'],
  [[95, 96, 99], 'Thunderstorm'],
];

/** Plain words for a WMO weather code. */
export function describeWeatherCode(code: number | null): string {
  return CONDITIONS.find(([codes]) => code !== null && codes.includes(code))?.[1] ?? 'Unknown';
}

/** Adds minutes to a local "YYYY-MM-DDTHH:mm" time. Ignores daylight saving changes. */
export function addMinutes(localTime: string, minutes: number): string {
  const date = new Date(`${localTime}:00Z`);
  date.setUTCMinutes(date.getUTCMinutes() + minutes);
  return date.toISOString().slice(0, 16);
}

/** Today's date ("YYYY-MM-DD") in the given time zone. */
export function localDate(timezone: string, now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function forecastUrl(airport: Airport, startDate: string, endDate: string): string {
  const params = new URLSearchParams({
    latitude: String(airport.latitude),
    longitude: String(airport.longitude),
    timezone: airport.timezone,
    hourly: 'temperature_2m,precipitation_probability,weather_code',
    start_date: startDate,
    end_date: endDate,
  });
  return `${FORECAST_URL}?${params}`;
}

/** Hours from the start of the arrival hour through the end of the layover. */
export function parseHourly(body: OpenMeteoResponse, windowStart: string, windowEnd: string): HourlyForecast[] {
  const hourly = body.hourly;
  if (!hourly) return [];
  const firstHour = `${windowStart.slice(0, 13)}:00`;
  return hourly.time.flatMap((time, i) => {
    const temperatureC = hourly.temperature_2m[i];
    if (time < firstHour || time > windowEnd || temperatureC === null) return [];
    return [
      {
        time,
        temperatureC,
        precipitationChance: hourly.precipitation_probability[i] ?? null,
        condition: describeWeatherCode(hourly.weather_code[i] ?? null),
      },
    ];
  });
}

/** Hourly weather for the layover window. Never throws: failures come back as "unavailable". */
export async function fetchLayoverWeather(
  airport: Airport,
  arrival: string,
  layoverMinutes: number,
  { now = new Date(), fetchFn = fetch }: { now?: Date; fetchFn?: typeof fetch } = {},
): Promise<LayoverWeather> {
  const windowEnd = addMinutes(arrival, layoverMinutes);
  const lastForecastDay = addMinutes(`${localDate(airport.timezone, now)}T00:00`, (FORECAST_DAYS - 1) * 24 * 60).slice(0, 10);
  const startDate = arrival.slice(0, 10);
  if (startDate > lastForecastDay) return { status: 'not-yet' };
  const endDate = windowEnd.slice(0, 10) < lastForecastDay ? windowEnd.slice(0, 10) : lastForecastDay;

  try {
    const response = await fetchFn(forecastUrl(airport, startDate, endDate));
    if (!response.ok) return { status: 'unavailable' };
    const hours = parseHourly((await response.json()) as OpenMeteoResponse, arrival, windowEnd);
    if (hours.length === 0) return { status: 'unavailable' };
    const chances = hours.map((hour) => hour.precipitationChance).filter((chance) => chance !== null);
    return { status: 'ok', hours, maxRainChance: chances.length > 0 ? Math.max(...chances) : null };
  } catch {
    return { status: 'unavailable' };
  }
}
