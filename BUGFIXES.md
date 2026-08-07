# LineStatus Bug Fix Log

This document lists every real bug found and fixed while building LineStatus, a live TfL train status, journey planning, and disruption alert app. Each entry explains what broke, where it lived in the codebase, why it happened, and how it was fixed. This is meant as a reference for CV writing and interview prep, so it focuses on the reasoning, not just the fix.

## Backend logic bugs

### 1. Duplicate notifications on every poll cycle

**Where:** `src/services/pollingService.ts`

**What happened:** The poller compares the current TfL status data against what is already stored as active in the database, so it can tell a genuinely new disruption apart from one that is still ongoing. The lookup map of existing active events was being built using only two fields (line id and status description), while the comparison key used elsewhere in the same function used three fields (line id, status description, and reason or branch label). Because the two keys never matched, the poller treated every single disruption as brand new on every single poll cycle, even when nothing had changed.

**Effect:** The same real disruption generated a fresh notification roughly every 90 seconds instead of once when it started.

**Fix:** Rebuilt the lookup map using the same three fields as the comparison key, so an ongoing disruption is correctly recognised as unchanged.

### 2. Invalid cron expression caused the poller to fire far too often

**Where:** `src/services/pollingService.ts`, originally configured with `node-cron`

**What happened:** The polling interval was set using `*/90 * * * * *`, intended to mean every 90 seconds. Cron seconds fields only accept values from 0 to 59, so 90 is out of range. This caused the scheduler to fire much more frequently than intended, sometimes triggering a second poll before the first one had finished writing to the database.

**Effect:** Combined with bug 1, this caused the same disruption to be inserted and notified on multiple times within seconds of each other.

**Fix:** Removed `node-cron` entirely and replaced it with a plain `setInterval` using a millisecond value, plus a guard flag that skips a new poll if the previous one has not finished. This removed both the invalid cron syntax and the possibility of two polls running at once.

## Frontend display bugs

### 3. Status colour logic had an unreachable condition

**Where:** `components/StatusDot.tsx`

**What happened:** The function that picks a colour for each line's status checked `severity >= 10` before checking `severity >= 20`. Since TfL uses 20 for "Service Closed", which is also greater than or equal to 10, the check for 20 could never be reached. Closed lines were shown with the same colour as lines running a normal service.

**Fix:** Reordered the checks so the higher threshold is tested first.

### 4. Redesign accidentally merged two different status colours into one

**Where:** `app/globals.css`, `components/StatusDot.tsx`

**What happened:** When the colour theme was changed from amber to green, a find and replace was used to swap every reference to the old accent colour. This also changed the colour used for "Minor Delays", which had been using the same variable name by coincidence. The result was that "Good Service" and "Minor Delays" displayed as the same colour, which defeats the purpose of a status indicator.

**Fix:** Added a separate colour variable specifically for delayed status, kept apart from the main brand colour.

### 5. Duplicated "Line" in some line names

**Where:** `src/services/notificationService.ts`

**What happened:** TfL's own data already includes the word "line" in some line names, for example "Elizabeth line". The notification message builder appended the word "Line" to every line name without checking for this, producing messages like "Elizabeth line Line is delayed".

**Fix:** Added a function that strips any trailing "line" from the name before appending " Line", so the result is consistent regardless of how TfL capitalised the original name.

### 6. Branch labels were too verbose to read

**Where:** `src/services/notificationService.ts`

**What happened:** TfL's branch data reads like "Epping Underground Station - West Ruislip Underground Station", repeating the station type in both halves. Left as is, this made every branch specific alert message very long.

**Fix:** Added a cleanup function that strips the repeated station type suffixes, so it reads as "Epping - West Ruislip".

## Docker and build bugs

### 7. Leftover reference to a database table that had been removed

**Where:** `src/services/notificationService.ts`

**What happened:** Early in the project, user data was stored in a local `User` table. This was later removed in favour of using Supabase's own authentication system directly, with no local user table. One query in the notification service still tried to include a relation to that table, which no longer existed in the schema. This did not appear as a problem until the code was built inside Docker, at which point TypeScript correctly refused to compile it.

**Fix:** Removed the leftover include clause, since the code did not actually use the related data.

### 8. Debug script referencing the same removed table

**Where:** `src/debug.ts`

**What happened:** Same root cause as bug 7. A diagnostic script written earlier still queried the removed `User` table directly and would have thrown an error the next time it was run.

**Fix:** Removed that section of the script.

### 9. Prisma client was never generated inside the Docker image

**Where:** `Dockerfile`

**What happened:** A Dockerfile update was sent for a different reason (bumping the Node version), but the line that runs `npx prisma generate` was missing from the version that ended up being saved. Without this step, none of the generated database types exist, which caused several TypeScript errors during the build that all trace back to this one missing line.

**Fix:** Re-added `RUN npx prisma generate` as a build step, placed before the TypeScript compile step so the generated types are available when the code is checked.

### 10. Node version mismatch with a dependency's requirements

**Where:** `Dockerfile`

**What happened:** The image used Node 20, but the `concurrently` package added to the project requires Node 22 or later. This did not stop the build outright, but it produced a warning and risked breaking in a future version bump.

**Fix:** Updated the base image in both the backend and frontend Dockerfiles to Node 22.

### 11. Prisma's database engine could not run inside the Alpine Linux image

**Where:** `Dockerfile`

**What happened:** The Prisma client relies on a native engine binary that links against OpenSSL. The Alpine Linux base image used for the Docker build does not include OpenSSL by default, so Prisma could not detect the correct version to link against. It generated an engine file that then failed to load at runtime with a missing shared library error.

**Fix:** Installed OpenSSL explicitly in both the build stage, before `prisma generate` runs, and the runtime stage, before the app starts.

### 12. Lock file out of sync with package.json

**Where:** `package-lock.json` in both the backend and frontend projects

**What happened:** Dependencies had been added to `package.json` at some point without also running a normal install to update the matching lock file. Docker builds use `npm ci`, which requires the two files to match exactly, so the build failed with a list of missing packages.

**Fix:** Ran a normal `npm install` locally in both projects to bring the lock file back in sync, then rebuilt.

## Journey planner bugs

### 13. TfL's disambiguation response was treated as a hard failure

**Where:** `src/services/tflClient.ts`

**What happened:** TfL's Journey Planner API returns an HTTP 300 status when a location is ambiguous, along with a genuine response body listing possible matches. The original code treated any non 200 response as an error and stopped there, so an ambiguous location caused the whole journey request to fail instead of being resolved automatically.

**Fix:** Rewrote the request logic to treat a 300 response as valid, read the disambiguation options from the response body, and automatically retry once using the best match.

### 14. Wrong field names assumed for the disambiguation response

**Where:** `src/services/tflClient.ts`

**What happened:** The first attempt at reading TfL's disambiguation data guessed at the field names based on a secondhand reference rather than a live response, and used `parameterValue` for the match id. Once tested against real data, this field turned out to sometimes be called `id` instead, and the surrounding array was sometimes called `matches` instead of `disambiguationOptions`.

**Fix:** Added a small helper function that checks both possible array names and both possible id field names, so it works regardless of which shape TfL happens to return.

### 15. A literal comma was being URL encoded and breaking the retry

**Where:** `src/services/tflClient.ts`

**What happened:** When a disambiguation match resolved to a latitude and longitude pair, the code encoded it using the standard `encodeURIComponent` function, which turns commas into `%2C`. TfL's own example URLs in the same response left the comma as a literal character, and encoding it caused the retried request to fail with a 404.

**Fix:** Added a small wrapper around the encoding function that leaves commas unencoded, matching what TfL's own API expects.

### 16. Hub ids returned by station search were not reliably accepted by the journey planner

**Where:** `src/services/tflClient.ts`

**What happened:** TfL's station search endpoint legitimately returns combined "hub" ids for interchange stations, for example Bank and Monument sharing a single id. The journey planning endpoint does not reliably accept these same hub ids. Instead of recognising the id, it fell back to fuzzy text matching against unrelated place names that happened to share similar letters.

**Fix:** Added a step that detects hub ids by their prefix, looks up that hub's coordinates through a separate TfL endpoint, and uses the coordinates instead of the raw hub id when planning the journey.

### 17. Missing import after adding a helper function

**Where:** `src/services/tflClient.ts`

**What happened:** A helper function was added that used a type called `TflDisambiguationSide`, but that type was not added to the list of imports at the top of the file. This was a straightforward oversight caught by the TypeScript build.

**Fix:** Added the missing type to the import list.

## Security issues found and fixed

### 18. Row Level Security was not enabled on any database table

**Where:** Supabase project database settings

**What happened:** Supabase automatically exposes every table in the database through a public REST API unless Row Level Security is turned on for that table. This is separate from the app's own backend API and bypasses it completely. Because RLS had not been enabled, anyone with the project's public anon key, which is already visible in the deployed frontend's JavaScript, could have read, changed, or deleted data in every table directly, without going through the app at all. Supabase flagged this automatically through its own security advisor.

**Fix:** Enabled Row Level Security on every table. The app's own backend connects to the database directly through Prisma using a role that is not subject to RLS, so this change had no effect on how the app itself works, while closing off the public API entirely.

### 19. User identity could be spoofed by anyone using the app

**Where:** `src/routes/favourites.ts`, `src/routes/notifications.ts`, `lib/api.ts` in the frontend

**What happened:** Early versions of the app identified the current user using a simple header sent with each request, with the user id itself stored in a frontend environment variable. Because that kind of variable gets baked into the JavaScript sent to every visitor's browser, the id was fully visible to anyone who opened their browser's developer tools, and could be changed freely to look at or modify another user's favourites and notifications.

**Fix:** Replaced this with real authentication through Supabase Auth. The frontend now sends a signed token with each request, and the backend verifies that token against Supabase before trusting who the request claims to be from.

## Security hardening added before deployment

The items below were not bugs in the sense of broken behaviour. Nothing was failing or producing wrong results. These were gaps found during a deliberate security review, done before making the app public, and closed as a precaution rather than in response to something going wrong.

### 20. No rate limiting on any backend route

**Where:** `src/index.ts`

**What was missing:** Nothing stopped a single client from sending requests to the API as fast as it could. This mattered most for the routes that call out to TfL's own API, since repeated hammering of those routes would burn through the app's TfL rate limit and degrade the app for every user, not just the one sending the requests.

**Fix:** Added a general request limit across the whole API, and a stricter, separate limit on the two routes that proxy to TfL.

### 21. CORS allowed requests from any website

**Where:** `src/index.ts`

**What was missing:** The CORS setting used during early development allowed any website to call the API from a visitor's browser, not just the app's own frontend. This is normal while building locally, but not something to leave in place once the app is public.

**Fix:** Set CORS to only allow the app's actual frontend origin, using an environment variable so the allowed origin can be updated once the app is deployed to its real domain.

### 22. Known vulnerabilities in frontend dependencies

**Where:** `frontend/package-lock.json`

**What was missing:** A routine dependency audit found high severity issues in two packages pulled in through Next.js, one allowing arbitrary file reads through a crafted source map, the other inherited from an image processing library. Neither was being triggered by anything the app actually does, but both were fixable for free.

**Fix:** Updated Next.js to the version that pulls in patched versions of both packages, then confirmed the app still built and ran correctly afterward.

### 23. Docker containers ran as root by default

**Where:** `Dockerfile` for both the backend and frontend

**What was missing:** Without specifying otherwise, a Docker container runs its process as the root user inside that container. If a bug or a dependency vulnerability were ever exploited, running as root gives an attacker more room to do damage inside that container than a normal user account would.

**Fix:** Added a dedicated non-root user in both Dockerfiles, gave it ownership of the app files, and switched to that user before the app starts.

### 24. No security headers or Content Security Policy on the frontend

**Where:** `frontend/next.config.ts`

**What was missing:** The site was not sending any of the common browser security headers, such as ones that stop the site being embedded in a hidden iframe on another domain, or that restrict where the page is allowed to load scripts and styles from.

**Fix:** Added a set of standard headers and a Content Security Policy scoped to what the app actually needs. One deliberate relaxation was kept in the policy, allowing inline scripts and styles, since Next.js relies on a small inline script for page data and the app uses inline style attributes throughout. A stricter version of this is possible using per-request nonces, but was judged a bigger change than made sense to take on at the same time as everything else.

### 25. Weak minimum password length

**Where:** `frontend/app/login/page.tsx`, plus Supabase's own auth settings

**What was missing:** Sign up only required a six character password. The form's own minimum length was raised, but that alone would not have been enough, since a request sent directly to the API rather than through the form would ignore it entirely.

**Fix:** Raised the minimum in the sign up form, and separately raised the real minimum in Supabase's authentication settings, which is the setting that actually gets enforced regardless of how the request is made.

## Deployment sync issues

### 26. A frontend file update did not make it into the working copy

**Where:** `frontend/lib/api.ts`

**What happened:** A new function was added to the shared API client to support account deletion. The change was correct in the source it was packaged from, but the working copy of the project did not end up with that change applied, most likely because an earlier version of the file was extracted after the update rather than before it. The build caught this cleanly. TypeScript reported that the account deletion page was calling a function that, as far as the actual file on disk was concerned, did not exist.

**Fix:** Added the missing function directly to the file in place, rather than repeating the same handoff step that had already gone wrong once.

## More security hardening, found while setting up the production server

### 27. Docker publishing a port bypasses the server firewall

**Where:** `docker-compose.yml`, on the real production server

**What was missing:** The server's firewall was set up to only allow ports 22, 80, and 443 from the outside world. Despite that, the backend was still directly reachable on port 4000 from anywhere on the internet. Docker manipulates the server's own firewall rules directly when a container publishes a port, in a way that bypasses the normal firewall's protection for that specific port. This is a well known interaction between Docker and this kind of firewall, not a bug in either one on its own, but easy to miss if you assume the firewall covers everything.

**Fix:** Once a reverse proxy was put in front of both the API and the frontend, there was no longer any need to publish their ports directly to the host at all. Removing those published ports means the reverse proxy still reaches both containers over Docker's own internal network, while neither is reachable from the internet except through the proxy.

## Production configuration corrections

The two items below were caught before they ever caused a real failure, while preparing the app to actually go live rather than only run on a local machine. They are recorded for the same reason as the hardening section above: they show the kind of check that is easy to skip when moving from local development to a real deployment.

### 28. The frontend was still built pointing at a local address

**Where:** `docker-compose.yml`

**What was missing:** The frontend's API address is baked into its JavaScript at build time, not read at runtime. This value had been left pointing at `localhost:4000`, which only ever meant anything on a local machine. Deployed as is, the live site would have tried to call an address that means nothing on a real server, and every request from the deployed frontend to the backend would have failed.

**Fix:** Updated the build argument to the real, public backend address before the first production build.

### 29. The Content Security Policy did not allow the real backend address

**Where:** `frontend/next.config.ts`

**What was missing:** Similar to the item above. The CSP rule controlling which addresses the page is allowed to make requests to had been left listing only `localhost:4000`. Even once the build argument in item 28 was fixed, the browser itself would have blocked every request to the real backend address, since the policy did not name it as allowed.

**Fix:** Added the real backend address to the policy alongside localhost, so the same build works whether it is being tested locally or actually deployed.

## Summary

Twenty nine items are recorded here across backend logic, frontend display, Docker builds, third party API integration, security, one deployment sync issue, and production configuration. Nineteen were genuine bugs in the running code. Seven were hardening steps, six taken during a deliberate security review and one more found while setting up the production server itself. Two were configuration values that would have caused a real failure once deployed, caught and corrected before that happened. One was a mismatch between an intended change and what actually ended up on disk.

Several of these, in particular bug 1, bug 12, bug 18, and bug 26, are the kind of issue that would be easy to miss without deliberately testing the real behaviour of the system rather than assuming it works because the code looks correct.
