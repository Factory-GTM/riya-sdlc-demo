import airportData from './data/airports.json';
import { formatMinutes, pickIdeas, usableTime, verdictFor, VERDICT_LABELS, type Airport, type Idea } from './layover.ts';
import { addMinutes, fetchLayoverWeather, type LayoverWeather } from './weather.ts';
import { COPIED_LABEL, COPY_FAILED_LABEL, COPY_LABEL, CONFIRMATION_MS, copyText, parseQuery, shareUrl, type LayoverInputs } from './share-link.ts';
import './styles.css';

const airports = airportData as Airport[];

const form = document.querySelector<HTMLFormElement>('#layover-form')!;
const airportSelect = document.querySelector<HTMLSelectElement>('#airport')!;
const arrivalInput = document.querySelector<HTMLInputElement>('#arrival')!;
const timezoneHint = document.querySelector<HTMLElement>('#timezone-hint')!;
const hoursInput = form.querySelector<HTMLInputElement>('[name="hours"]')!;
const minutesInput = form.querySelector<HTMLInputElement>('[name="minutes"]')!;
const internationalInput = form.querySelector<HTMLInputElement>('[name="international"]')!;
const result = document.querySelector<HTMLElement>('#result')!;

let latestRequest = 0;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function selectedAirport(): Airport {
  return airports.find((airport) => airport.code === airportSelect.value) ?? airports[0];
}

function formatTemperature(celsius: number): string {
  return `${Math.round((celsius * 9) / 5 + 32)}°F / ${Math.round(celsius)}°C`;
}

function renderMath(airport: Airport, layoverMinutes: number, international: boolean): HTMLElement {
  const time = usableTime(airport, layoverMinutes, international);
  const list = el('ul', undefined, 'math');
  const rows: [string, string][] = [
    ['Layover', formatMinutes(time.layover)],
    ['Deplane', `- ${formatMinutes(time.deplane)}`],
    [`Transit to ${airport.city} and back`, `- ${formatMinutes(time.transit)}`],
    ['Security re-entry', `- ${formatMinutes(time.security)}`],
  ];
  if (international) rows.push(['Customs', `- ${formatMinutes(time.customs)}`]);
  rows.push(['Usable time', formatMinutes(time.usable)]);
  for (const [label, value] of rows) {
    const item = el('li');
    item.append(el('span', label), el('span', value));
    list.append(item);
  }
  return list;
}

function renderWeather(weather: LayoverWeather): HTMLElement {
  const section = el('section');
  section.append(el('h3', 'Weather during your layover'));
  if (weather.status === 'not-yet') {
    section.append(el('p', 'Forecast not available yet. Forecasts cover the next 16 days.', 'note'));
    return section;
  }
  if (weather.status === 'unavailable') {
    section.append(el('p', 'Weather unavailable right now.', 'note'));
    return section;
  }
  const table = el('table');
  const head = el('tr');
  head.append(el('th', 'Time'), el('th', 'Temperature'), el('th', 'Rain chance'), el('th', 'Conditions'));
  table.append(head);
  for (const hour of weather.hours) {
    const row = el('tr');
    row.append(
      el('td', hour.time.slice(11)),
      el('td', formatTemperature(hour.temperatureC)),
      el('td', hour.precipitationChance === null ? '-' : `${hour.precipitationChance}%`),
      el('td', hour.condition),
    );
    table.append(row);
  }
  const wrapper = el('div', undefined, 'table-wrap');
  wrapper.append(table);
  section.append(wrapper);
  return section;
}

function renderIdeas(ideas: Idea[], rainy: boolean): HTMLElement {
  const section = el('section');
  section.append(el('h3', rainy ? 'Ideas (rain likely, indoor first)' : 'Ideas'));
  const list = el('ul');
  for (const idea of ideas) list.append(el('li', `${idea.name} (about ${formatMinutes(idea.minutes)}, ${idea.setting})`));
  section.append(list);
  return section;
}

function renderShare(url: string): HTMLElement {
  const row = el('div', undefined, 'share');
  const button = el('button', COPY_LABEL, 'secondary');
  button.type = 'button';
  const status = el('span', undefined, 'note');
  status.setAttribute('role', 'status');
  let timer: number | undefined;
  button.addEventListener('click', async () => {
    const copied = await copyText(url, navigator.clipboard?.writeText.bind(navigator.clipboard));
    window.clearTimeout(timer);
    status.textContent = copied ? COPIED_LABEL : COPY_FAILED_LABEL;
    if (copied) timer = window.setTimeout(() => (status.textContent = ''), CONFIRMATION_MS);
  });
  row.append(button, status);
  return row;
}

async function showResult(event: SubmitEvent) {
  event.preventDefault();
  const request = ++latestRequest;
  const data = new FormData(form);
  const airport = selectedAirport();
  const arrival = String(data.get('arrival'));
  const hours = Number(data.get('hours'));
  const minutes = Number(data.get('minutes'));
  const layoverMinutes = hours * 60 + minutes;
  const international = data.get('international') === 'on';
  const verdict = verdictFor(usableTime(airport, layoverMinutes, international).usable);
  const url = shareUrl(location.href, { airport: airport.code, arrival, hours, minutes, international });
  history.replaceState(null, '', url);

  const card = el('article', undefined, `card verdict-${verdict}`);
  card.append(
    el('h2', VERDICT_LABELS[verdict]),
    el('p', `${airport.code}, ${airport.city}: arrive ${arrival.replace('T', ' ')}, leave ${addMinutes(arrival, layoverMinutes).replace('T', ' ')} (local time)`, 'note'),
    renderShare(url),
    renderMath(airport, layoverMinutes, international),
    el('p', 'Airport times are rough estimates.', 'note'),
  );
  const loading = el('p', 'Loading forecast...', 'note');
  card.append(loading);
  result.replaceChildren(card);

  const weather = await fetchLayoverWeather(airport, arrival, layoverMinutes);
  if (request !== latestRequest) return;
  const rainChance = weather.status === 'ok' ? weather.maxRainChance : null;
  loading.replaceWith(renderWeather(weather), renderIdeas(pickIdeas(airport, verdict, rainChance), (rainChance ?? 0) >= 50));
}

function tomorrowAtNoon(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T12:00`;
}

function fillForm(inputs: LayoverInputs) {
  airportSelect.value = inputs.airport;
  arrivalInput.value = inputs.arrival;
  hoursInput.value = String(inputs.hours);
  minutesInput.value = String(inputs.minutes);
  internationalInput.checked = inputs.international;
}

function updateTimezoneHint() {
  const airport = selectedAirport();
  timezoneHint.textContent = `Local time in ${airport.city} (${airport.timezone})`;
}

for (const airport of airports) {
  airportSelect.append(new Option(`${airport.code} - ${airport.name}`, airport.code));
}
const shared = parseQuery(location.search, airports.map((airport) => airport.code));
if (shared) fillForm(shared);
else arrivalInput.value = tomorrowAtNoon();
updateTimezoneHint();
airportSelect.addEventListener('change', updateTimezoneHint);
form.addEventListener('submit', showResult);
if (shared) form.requestSubmit();
