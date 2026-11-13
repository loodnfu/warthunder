# Coral Front — Air War

A browser air-combat flight game with online multiplayer. One Node.js server (Express + Colyseus over WebSockets) serves the game and runs the authoritative simulation for every room.

- 54 flyable aircraft: the USAF, RAF and RAAF fleets plus other nations (F-22, F-35A/B, F-15C/E/EX, Typhoon, Su-57, J-20, B-52, C-17, E-7, P-8, MQ-9, CH-47 and more)
- Private and public rooms with 6-character codes, teams, team balancing, AI fill-in, reconnection
- Play against AI offline, with 4 difficulty levels, 2 game modes, weather and time of day
- Crash physics (bounces, belly slides, wings breaking off, debris), bomb craters that close runways, repair crews
- Airports with marked runways, PAPI, approach and edge lights, taxiway signs, shelters, hangars, tower, vehicles and ground crew
- Spoken ATC (ground, tower, departure, approach) that reacts to what your aircraft is doing
- Dynamic weather, day and night, rain on the canopy, thunderstorms, wind and windsocks

## Run it locally

Needs Node.js 20 or newer.

```bash
npm install
npm start            # http://localhost:2567
npm test             # simulation + multiplayer checks
```

Open http://localhost:2567, press **PLAY**, enter a username, then either **PLAY AGAINST AI**, **CREATE ROOM**, or type a room code and **JOIN MULTIPLAYER**. Open a second browser window to test multiplayer on one machine.

## Deploy on Render

1. **Put the code on GitHub.** Create an empty repository (for example `coral-front`) and push this folder to it:
   ```bash
   git init && git add -A && git commit -m "Coral Front"
   git branch -M main
   git remote add origin https://github.com/<you>/coral-front.git
   git push -u origin main
   ```
2. **Create the service.** In the Render dashboard choose **New → Blueprint**, connect your GitHub account, and pick the repository. Render reads `render.yaml` and creates a Node web service called `coral-front`. Press **Apply**.

   Prefer to set it up by hand? Choose **New → Web Service**, pick the repo, and use:
   - Runtime: **Node**
   - Build command: `npm ci --omit=dev`
   - Start command: `npm start`
   - Health check path: `/health`
   - Environment variable: `NODE_VERSION` = `22`
3. **Wait for the first deploy** (2–3 minutes). The service shows *Live* when `/health` answers.
4. **Play.** Open `https://coral-front-xxxx.onrender.com` (the address Render shows). Share that address and a room code with friends.

There are no secrets to configure. Render sets `PORT`, and the server listens on it. The page connects back to the same address with `wss://` automatically, because Render serves it over HTTPS.

**Free vs paid:** on Render's free plan the service sleeps after 15 minutes without visitors and takes about a minute to wake up, which ends any open rooms. To keep rooms always available, change `plan: free` to `plan: starter` in `render.yaml` (a paid plan) or pick a paid instance type in the dashboard.

Every push to `main` redeploys automatically (`autoDeploy: true`).

## How multiplayer works

- `server/AirWarRoom.js` is a Colyseus room. It owns the world: AI aircraft, missiles, bombs, damage, kills, airport damage and repairs, weather and ATC. It sends snapshots 15 times a second and airport damage twice a second when it changes.
- Each player flies their own aircraft locally for instant controls and sends its state about 20 times a second. The server checks the state, fires the guns, runs the ATC for that player and decides every hit and crash.
- Other aircraft are drawn 120 ms in the past, smoothly interpolated between snapshots.
- A dropped connection keeps your seat for 45 seconds; the page reconnects by itself.
- `shared/sim.js` is the simulation used by both the server and the browser (single-player runs it entirely in the browser).

HTTP endpoints: `GET /health`, `GET /api/rooms` (public rooms), `GET /api/rooms/:code` (does a code exist; 404 or 409 with a message).

## Controls

| Key | Action |
|---|---|
| Mouse | Steer (nosewheel on the ground; pull back to rotate) |
| W / S | Throttle (S at idle = brakes) |
| Left click / Space | Cannon (Space = brakes on the ground) |
| F / right click | Missile (after lock) · T cycles targets |
| X / Z | Flares / chaff |
| B / N | Bomb / nuke |
| G, Q / E, R | Gear, flaps, reverse thrust |
| H | Request approach |
| P | Rearm and repair when stopped at your home base |
| C, 1–8 | Cameras (cockpit, chase, wide, fly-by, bomb cam, rear, tower, orbit) |
| Tab / Enter | Scoreboard / chat |

## Project layout

```
server/      index.js (Express + Colyseus), AirWarRoom.js (room logic)
shared/      sim.js (flight model, AI, weapons, airports, ATC, weather)
public/      index.html, js/ (renderer, HUD, cockpit, world, network), models/ (glTF aircraft)
test/        sim.test.js, multiplayer.test.js
render.yaml  Render Blueprint
```

See `CREDITS.md` for the aircraft model authors and licences.
