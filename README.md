# Line Status

A live status board, journey planner, and disruption alert app for London transport. Trains and buses, kept as two deliberately separate sections. Built on TfL's public API.

Live at [linestatus.co.uk](https://linestatus.co.uk)

![Status board with a live disruption](docs/screenshots/status-board.png)

## What it does

- Live status for every tube, DLR, Overground, and Elizabeth line
- Real branch and reason detail on delays, not a generic warning
- Train only journey planning, disrupted legs flagged clearly
- Live departures for any station or bus stop, refreshing automatically
- Finds the best nearby station, factoring in real walking time and the actual next train, not just distance
- Push notifications the moment something you've favourited is disrupted, even with the site closed

![Live departures board](docs/screenshots/departures.png)

Departures for a specific station, real countdown times, refreshing on its own.

![A dedicated line page](docs/screenshots/line-page.png)

Every line gets its own page. Colour themed, full station list, live status.

![Mobile view](docs/screenshots/mobile.png)

Fully responsive. Same real data, same live updates, on any screen size.

## A few things worth knowing

- A favourited station only shows trains on lines you've also favourited, so one busy line doesn't drown out the rest
- Large interchange stations (several lines under one name in TfL's own data) are properly merged, not shown as a partial picture
- Every non trivial bug hit while building this, why it happened, and how it got fixed is logged in [BUGFIXES.md](./BUGFIXES.md)

## Why this is more than a typical personal project

This runs the way a small production service actually gets run, not just coded and left on a laptop.

- **Own infrastructure.** A Linux server provisioned from scratch, proper firewall, SSH key only access, root login disabled, non root deployment user.
- **Containerised.** Every service in its own Docker container. Identical setup locally and in production, with production only pieces like the reverse proxy kept out of local runs entirely.
- **Automatic deployment.** Every push to main deploys itself.

![GitHub Actions deploy pipeline](docs/screenshots/deploy-pipeline.png)

- **Real HTTPS.** Caddy handles certificates automatically. Nothing but Caddy is directly reachable from outside.
- **Actual security, not just a login form.** Row Level Security on every table, properly verified auth tokens, rate limiting configured correctly behind a reverse proxy, security headers throughout.
- **Real privacy rights.** A written privacy policy, and genuine account deletion, including from the underlying auth system, not just the app's own database.

## Tech stack

- **Frontend:** Next.js, React, TypeScript
- **Backend:** Node.js, Express, TypeScript, plus a separate background service polling TfL and managing notifications
- **Push:** standard Web Push protocol, service worker delivers notifications even with the site closed
- **Database and auth:** PostgreSQL through Prisma, Supabase Auth with magic link sign in, tokens verified server side
- **Infrastructure:** Docker Compose, Caddy, a Hetzner Cloud Linux server, GitHub Actions
- **Data:** Transport for London's public Unified API

## Local development

```
docker compose up --build
```

Copy `.env.example` to `.env` and fill in real values first. This starts the API, the background poller, and the frontend together in local mode. Production only pieces are kept in a separate file and never run locally.

## License

MIT, see [LICENSE](./LICENSE).
