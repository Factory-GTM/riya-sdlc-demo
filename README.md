# Layover Explorer

A one-page site that answers: "I have a layover. Can I leave the airport, and what's the weather?"

Pick a layover airport, enter your arrival time (local time at that airport) and layover length, and say whether you arrive on an international flight. You get one card with:

- **Verdict:** "Yes, go explore", "Tight, stay close", or "Stay in the airport", with the time math shown.
- **Weather during the layover:** hourly temperature, rain chance and conditions from [Open-Meteo](https://open-meteo.com/) (free, no API key). Dates more than 16 days out show "Forecast not available yet".
- **Ideas:** up to 3 things to do in the city or the airport, indoor first when rain is likely.

Airport times and ideas are rough public estimates in `src/data/airports.json`. There is no backend and no API key.

## How the verdict works

```
usable time = layover
            - 20 min to deplane
            - 2 x transit to the city (there and back)
            - security re-entry
            - customs (international arrivals only)
```

Yes if usable time is 120 minutes or more, Tight if 45 to 119 minutes, otherwise Stay.

## Run it

Requires Node 24 and pnpm (the version is pinned in `package.json`; `corepack enable` picks it up).

```sh
pnpm install
pnpm dev        # http://localhost:5173
```

Other commands:

```sh
pnpm test       # Vitest unit tests (no network)
pnpm lint       # ESLint
pnpm debt       # list TODO/FIXME markers; each must link to an issue, e.g. TODO(#123)
pnpm typecheck  # tsc --noEmit
pnpm build      # static site in dist/
pnpm preview    # serve dist/ locally
```

CI (GitHub Actions) runs install, lint, the tech debt check, typecheck, test and build on every pull request.

## Hosting

The built site is deployed to Conjure at https://layover-explorer.conjure.factory.ai. See `AGENTS.md` for the deploy steps.
