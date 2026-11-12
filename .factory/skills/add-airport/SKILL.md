---
name: add-airport
description: Use when someone asks to add an airport to Layover Explorer (for example "add AMS" or "add Zurich"). Adds one entry to src/data/airports.json with sourced estimates and generic public ideas, runs lint/typecheck/test/build, checks the result card in the preview, and reports back.
---

# Add an airport to Layover Explorer

Add exactly one new airport entry to `src/data/airports.json`. Change nothing else.

## Steps

1. **Read first.** Read `AGENTS.md` and `src/data/airports.json`. Copy the shape of an existing entry exactly: same field order, 2-space indent, no trailing commas.
   ```json
   {
     "code": "XXX",
     "name": "...",
     "city": "...",
     "latitude": 0.0,
     "longitude": 0.0,
     "timezone": "Area/City",
     "transitToCityMinutes": 0,
     "securityMinutes": 0,
     "customsMinutes": 0,
     "cityIdeas": [{ "name": "...", "minutes": 0, "setting": "indoor" }],
     "airportIdeas": [{ "name": "...", "minutes": 0, "setting": "outdoor" }]
   }
   ```
   In the file, write each idea object over several lines, the way the existing entries are written.
2. **Check the code.** Stop and ask the user before going on if the code is already in the file, or isn't a real 3-letter IATA airport code.
3. **Look up the facts** from public sources (airport website, Wikipedia, transit operator). Keep a list of the source URL for each value:
   - `latitude` / `longitude`: decimal degrees, 4 decimal places.
   - `timezone`: IANA name (for example `Europe/Zurich`), never an abbreviation like CET.
   - `transitToCityMinutes`: one way, airport to city center, by the usual public transport, plus the walk to the platform or stop.
   - `securityMinutes`: getting back through security to the gate: typical queue plus the walk or people mover to the gates.
   - `customsMinutes`: passport control and customs on arrival, plus the walk to the exit.
   - Live wait-time sites only give the queue part, so add the walking time from an airport map or guide. Round all three up to the nearest 5 minutes.
4. **Write the ideas.**
   - At least 3 `cityIdeas` and at least 1 `airportIdeas`. Aim for 4 city ideas and 3 airport ideas, like the other entries.
   - Generic public places only: landmarks, parks, museums, neighborhoods, waterfronts, airport art, observation decks. Never a named shop, restaurant, hotel, lounge or other business, and no endorsements.
   - `minutes` is time at the spot, not travel. Positive whole numbers.
   - `setting` is exactly `"indoor"` or `"outdoor"`.
   - Order `cityIdeas` quickest first (lowest `minutes` first).
5. **Insert the entry** as the last element of the array (add a comma after the previous last entry). Do not reformat, reorder or edit other entries. `git diff src/data/airports.json` must show only the new lines (plus, at most, that one `}` -> `},` change).
6. **Validate** from the repo root. Run all four and note each exit code:
   ```sh
   pnpm lint && pnpm typecheck && pnpm test && pnpm build
   ```
   `pnpm test` includes the airport data test (`describe('airport data')` in `src/layover.test.ts`). It checks idea counts, the time zone, `setting` values and positive minutes for every airport. If something fails, fix only the new entry.
7. **Check it in the browser.**
   - Start `pnpm preview` in the background (after `pnpm build`). It serves `dist/` at http://localhost:4173 (Vite's default; use the port it prints if 4173 is taken).
   - Open the page in a browser (the `agent-browser` skill works). In "Layover airport" (`#airport`), pick `<CODE> - <name>`. Keep the default arrival time (tomorrow at noon, so the forecast loads). Set the layover to 5 hours 0 minutes. Leave "International arrival" unchecked. Click "Check my layover".
   - Wait until "Loading forecast..." is gone and the weather table and ideas show. Then screenshot the result card (`#result`). Make the viewport tall enough (for example 1280x2400) or the card is cut off.
   - Save it outside the repo at `/tmp/layover-explorer/<code>-result-card.png` (lowercase code), so it can't be committed.
   - With agent-browser:
     ```sh
     agent-browser open http://localhost:4173
     agent-browser set viewport 1280 2400
     agent-browser select "#airport" <CODE>
     agent-browser fill "input[name=hours]" 5 && agent-browser fill "input[name=minutes]" 0
     agent-browser click "button[type=submit]"
     agent-browser wait --fn "!document.querySelector('#result').textContent.includes('Loading forecast')"
     agent-browser screenshot "#result" /tmp/layover-explorer/<code>-result-card.png
     ```
   - Open the screenshot and confirm: the right code and city, the time math, a weather section, and ideas from the new entry. No errors in the page.
   - Stop the preview server and close the browser session.
8. **Report** briefly:
   - the new JSON entry
   - the source for each looked-up or estimated value (coordinates, time zone, transit, security, customs)
   - pass/fail for lint, typecheck, test and build
   - the screenshot path

## Done when

- [ ] Exactly one new entry in `src/data/airports.json`, every field filled, and `git diff` shows no other changes
- [ ] 3+ city ideas (quickest first) and 1+ airport idea, all generic public places, each tagged indoor or outdoor
- [ ] Every looked-up value has a public source in the report
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` all pass
- [ ] Screenshot of the 5-hour result card saved at `/tmp/layover-explorer/<code>-result-card.png` and checked
- [ ] Preview server stopped and browser session closed

## Don't

- Don't change `src/layover.ts`, `src/weather.ts`, `src/main.ts`, tests, or any other airport.
- Don't guess numbers without a source, and don't present estimates as exact.
- Don't add businesses, brand names or endorsements as ideas.
- Don't commit `dist/` or screenshots, and don't push unless the user asks.
