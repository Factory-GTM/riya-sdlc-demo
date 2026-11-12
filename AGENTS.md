# AGENTS.md

Layover Explorer: a one-page static site (Vite + TypeScript, vanilla DOM, plain CSS). It tells a traveler whether they have time to leave the airport on a layover and shows the weather. No backend, no API keys.

## Layout

| Path | What it is |
|---|---|
| `index.html` | The single page: form and result container. |
| `src/layover.ts` | Pure logic: usable time, verdict, idea selection, minute formatting. No DOM, no network. |
| `src/weather.ts` | Open-Meteo client: forecast URL, hourly parsing, forecast-range check. `fetch` and "now" are injectable for tests. |
| `src/share-link.ts` | Shareable link: inputs to and from the query string (invalid values give `null`), share URL, clipboard copy that never throws. No DOM. |
| `src/main.ts` | UI wiring: reads the form, renders the result card. Keep logic out of here. |
| `src/styles.css` | All styles. |
| `src/data/airports.json` | Airport data: coordinates, IANA time zone, transit/security/customs minutes, city and airport ideas. |
| `src/fixtures/open-meteo-ord.json` | A recorded Open-Meteo response for tests. |
| `src/*.test.ts` | Vitest unit tests, next to the code they test. |
| `.github/workflows/ci.yml` | CI: install, lint, typecheck, test, build. |

## Commands

Node 24, pnpm (version pinned by `packageManager` in `package.json`).

```sh
pnpm install --frozen-lockfile
pnpm dev         # local dev server
pnpm lint        # ESLint (includes a complexity limit of 15)
pnpm typecheck   # tsc --noEmit
pnpm test        # Vitest, no network
pnpm build       # typecheck + vite build to dist/
pnpm preview     # serve dist/
```

Run lint, typecheck, test and build before opening a PR. CI runs the same steps.

## Conventions

- Rules from the spec, keep them in sync with the code and tests:
  - usable = layover - 20 (deplane) - 2 x `transitToCityMinutes` - `securityMinutes` - `customsMinutes` (international only).
  - Yes at 120+ usable minutes, Tight at 45-119, otherwise Stay.
  - Up to 3 ideas: `cityIdeas` for Yes and Tight (quickest first for Tight), `airportIdeas` for Stay. Indoor ideas first when the rain chance is 50% or more.
  - Weather beyond 16 days shows "Forecast not available yet"; a failed request shows "Weather unavailable". The verdict always shows.
  - After a check, the URL query holds the inputs (`airport`, `arrival`, `hours`, `minutes`, `international`). Opening such a URL fills the form and shows the result; any missing or bad value falls back to the normal empty form.
- Tests never hit the network. Use the fixture and pass a fake `fetchFn` and `now` to `fetchLayoverWeather`.
- Airport data: times are rough public estimates and the UI labels them as estimates. Ideas are generic public places (landmarks, neighborhoods, airport art or museums), never business endorsements. When adding an airport, fill every field and give it at least 3 city ideas and 1 airport idea; the data test checks this.
- Naming: `camelCase` variables and functions, `PascalCase` types, `UPPER_CASE` module constants, `kebab-case.ts` files.
- No framework, no backend, no API keys, no new runtime dependencies without a reason.
- Work on a branch and open a PR to `main`; do not push to `main` directly.

## Deploy to Conjure

The site is hosted on Conjure (Factory's internal static hosting, behind Okta) as the site `layover-explorer`: https://layover-explorer.conjure.factory.ai

```sh
conjure login --server https://conjure.factory.ai    # one-time, opens Okta sign-in
conjure whoami --json --server https://conjure.factory.ai
pnpm deploy:conjure                                   # pnpm build && conjure deploy dist --site layover-explorer --json
```

Deploy from an up-to-date `main` after a PR merges, then open the URL and check that a layover lookup shows a verdict and weather.
