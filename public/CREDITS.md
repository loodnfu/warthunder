# Credits and licences

## Aircraft models

The aircraft models in `public/models/` are simplified conversions of aircraft from the
[FlightGear](https://www.flightgear.org) flight simulator. They were converted from AC3D to glTF,
decimated to game-ready triangle counts, and stripped of textures, cockpits, pilots, weapons and
lights. The game paints them with its own liveries. Each stays under the GNU General Public
License version its authors chose. Source: the FlightGear aircraft mirror at https://github.com/FGMEMBERS.

| File | Aircraft (used for) | Licence | Authors (from the aircraft's -set.xml) |
|---|---|---|---|
| f16 | F-16 | GPL v2 | Erik Hofman, Pensacola, Martin "Pegasus" Schmitt, Richard Harrison, Nikolai V. Chr. |
| f18 | F/A-18 (F/A-18E/F, EA-18G) | GPL v2 | Fabrice Kauffmann |
| f22 | F-22 Raptor | GPL v2 | ncc_42, Fabrizio Fracaroli, StuartC, Petar Jedvaj |
| f35 | F-35B airframe (F-35A, F-35B) | GPL v3 | Petar Jedvaj, Detlef Faber, F-GTUX, Stuart Cassie, Gary Brown |
| ef | Eurofighter Typhoon | GPL v2 | Maverick Alex and others |
| b1 | B-1B Lancer | GPL v2 | Markus Zojer, Paul Jay Schrenker, Ludovic Brenta, Andreas Spiekermann |
| b52 | B-52 | GPL v2 | Lee Elliott |
| b737 | Boeing 737-800 (E-7, P-8) | GPL v2 | FlightGear 737-800 contributors |
| f15c | F-15C (F-15C, F-15EX) | GPL v2 | Flying Toaster 3DM, StuartC, Flug, MOJO, Gary Brown |
| f15e | F-15E Strike Eagle | GPL v2 | Flying Toaster 3DM, StuartC, Flug |
| a10 | A-10 Thunderbolt II | GPL v2 | Lee Elliott, Alexis Bory, David Bastien |
| c5 | C-5 Galaxy | GPL v2 | Jon Bourgeois |
| c17 | C-17 Globemaster III | GPL v3 | Mathias Froehlich, Algernon |
| c130 | C-130 / AC-130 (C-130, AC-130J, C-130J) | GPL v2 | Emmanuel Baranger, Didier Fabert, Jettoo, Jack Mermod |
| a400 | A400M Atlas | GPL v2 | Anon (3D), StuartC |
| a330 | A330 (Voyager, KC-30A) | GPL v2 | FlightGear A330 contributors |
| b707 | Boeing 707 (KC-135, RC-135W) | GPL v2 | Lake of Constance Hangar |
| mq9 | MQ-9 Reaper | GPL v2 | Petar Jedvaj |
| pc21 | Pilatus PC-21 | GPL v3 | Petar Jedvaj, Ernest Teuscher |
| su27 | Su-27 (Su-27, Su-30, Su-35) | GPL v2 | Lee Elliott, StuartC, VooDoo |
| mig29 | MiG-29 (MiG-29, MiG-35) | GPL v2 | FlightGear MiG-29 contributors |

The B-2, CH-47, Mirage 2000 and KC-46 repositories had no licence file (or failed conversion), so
those aircraft, and every aircraft not listed above, use the game's own procedural models.

## Code and libraries

- Game code: GPL-3.0-or-later (it ships GPL models).
- [three.js](https://threejs.org) r128 — MIT. [Colyseus](https://colyseus.io) — MIT. [Express](https://expressjs.com) — MIT.
- All textures, sounds and the airport/terrain are generated in code at run time.

Full licence texts: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html and https://www.gnu.org/licenses/gpl-3.0.html
