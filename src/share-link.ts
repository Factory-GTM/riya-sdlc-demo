/** The form inputs a shareable link carries. */
export interface LayoverInputs {
  airport: string;
  /** Local arrival time, "YYYY-MM-DDTHH:mm". */
  arrival: string;
  hours: number;
  minutes: number;
  international: boolean;
}

export const COPY_LABEL = 'Copy link';
export const COPIED_LABEL = 'Copied';
export const COPY_FAILED_LABEL = 'Could not copy. Copy the address bar instead.';
/** How long the "Copied" confirmation stays visible. */
export const CONFIRMATION_MS = 2000;

const ARRIVAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const NUMBER_PATTERN = /^\d{1,2}$/;
const MAX_HOURS = 23;
const MAX_MINUTES = 59;
/** Matches the step on the minutes input, so a link never fills a value the form rejects. */
const MINUTES_STEP = 5;

/** Query string (without "?") for the given inputs. */
export function toQuery(inputs: LayoverInputs): string {
  return new URLSearchParams({
    airport: inputs.airport,
    arrival: inputs.arrival,
    hours: String(inputs.hours),
    minutes: String(inputs.minutes),
    international: inputs.international ? '1' : '0',
  }).toString();
}

function isRealArrival(value: string): boolean {
  if (!ARRIVAL_PATTERN.test(value)) return false;
  const date = new Date(`${value}:00Z`);
  // Rejects dates like Feb 30 or 25:00, which Date would silently roll over.
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 16) === value;
}

function parseWhole(value: string | null, max: number, step = 1): number | null {
  if (value === null || !NUMBER_PATTERN.test(value)) return null;
  const number = Number(value);
  return number <= max && number % step === 0 ? number : null;
}

function parseInternational(value: string | null): boolean | null {
  if (value === '1') return true;
  if (value === '0') return false;
  return null;
}

/**
 * Inputs from a query string such as `location.search`. Returns null when any value is
 * missing or invalid, so the page falls back to the normal empty form.
 */
export function parseQuery(search: string, airportCodes: readonly string[]): LayoverInputs | null {
  const params = new URLSearchParams(search);
  const airport = params.get('airport');
  const arrival = params.get('arrival');
  const hours = parseWhole(params.get('hours'), MAX_HOURS);
  const minutes = parseWhole(params.get('minutes'), MAX_MINUTES, MINUTES_STEP);
  const international = parseInternational(params.get('international'));
  if (airport === null || !airportCodes.includes(airport)) return null;
  if (arrival === null || !isRealArrival(arrival)) return null;
  if (hours === null || minutes === null || international === null) return null;
  return { airport, arrival, hours, minutes, international };
}

/** The page URL with the inputs as its query string. Keeps the path, drops any old query or hash. */
export function shareUrl(pageUrl: string, inputs: LayoverInputs): string {
  const url = new URL(pageUrl);
  url.search = toQuery(inputs);
  url.hash = '';
  return url.toString();
}

/** Copies text with the given clipboard writer. Never throws: returns false when copying fails. */
export async function copyText(text: string, writeText: ((text: string) => Promise<void>) | undefined): Promise<boolean> {
  if (!writeText) return false;
  try {
    await writeText(text);
    return true;
  } catch {
    return false;
  }
}
