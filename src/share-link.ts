export interface LayoverInputs {
  airport: string;
  /** Local time at the airport, "YYYY-MM-DDTHH:mm". */
  arrival: string;
  hours: number;
  minutes: number;
  international: boolean;
}

const ARRIVAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const WHOLE_NUMBER_PATTERN = /^\d{1,2}$/;
const MAX_HOURS = 23;
const MAX_MINUTES = 59;
/** Matches the minutes input's step, so a filled-in form always passes browser validation. */
const MINUTE_STEP = 5;

/** Query string (without "?") that holds the layover inputs. */
export function toQueryString(inputs: LayoverInputs): string {
  return new URLSearchParams({
    airport: inputs.airport,
    arrival: inputs.arrival,
    hours: String(inputs.hours),
    minutes: String(inputs.minutes),
    international: inputs.international ? '1' : '0',
  }).toString();
}

/** True for a real calendar date and time, so "2026-02-30T12:00" and "2026-11-12T25:00" are rejected. */
function isLocalDateTime(value: string | null): value is string {
  if (value === null || !ARRIVAL_PATTERN.test(value)) return false;
  const date = new Date(`${value}:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 16) === value;
}

function parseWholeNumber(value: string | null, max: number, step = 1): number | null {
  if (value === null || !WHOLE_NUMBER_PATTERN.test(value)) return null;
  const number = Number(value);
  return number <= max && number % step === 0 ? number : null;
}

function parseFlag(value: string | null): boolean | null {
  if (value === '1') return true;
  if (value === '0') return false;
  return null;
}

/**
 * Layover inputs from a query string, or null when any value is missing or invalid.
 * All or nothing: a partly valid link falls back to the normal form instead of a half-filled one.
 */
export function parseQueryString(search: string, airportCodes: readonly string[]): LayoverInputs | null {
  const params = new URLSearchParams(search);
  const airport = params.get('airport');
  const arrival = params.get('arrival');
  const hours = parseWholeNumber(params.get('hours'), MAX_HOURS);
  const minutes = parseWholeNumber(params.get('minutes'), MAX_MINUTES, MINUTE_STEP);
  const international = parseFlag(params.get('international'));
  if (airport === null || !airportCodes.includes(airport) || !isLocalDateTime(arrival)) return null;
  if (hours === null || minutes === null || international === null) return null;
  return { airport, arrival, hours, minutes, international };
}
