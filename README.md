BMG – Balanced Map Generation (v1.0.0)

The BMG mod introduces a new map type, “Continents-BMG,” specifically designed to balance starting locations and resource distribution across hemispheres, supporting 6 to 8 players per continent.

New Map Generation Script
continents-bmg.js (and the lighter continents-gbm.js) completely replace the standard continents generator. Key adjustments include:

Continent size & positioning

The “primary” continent is larger than its counterpart.

Hill & mountain thresholds

Mountains will no longer spawn directly on your capital tile.

Tropical patches

+5 % additional tropical biome coverage.

Bonus resource placement

Automatic horse placement around capital cities.

Spawn-area terrain balance

≥ 30 % hill tiles within a 3-tile radius of each start.

Minimum 11-tile distance between all players.

New Start-Plot Assignment Algorithm
assign-starting-plots-bmg.js extends and adapts Civilization VII’s algorithm to support 6- and 8-player configurations on the same continent. It fully replaces assign-starting-plots-mjpcount.js.

How to Use
Install the BMG mod in your Mods folder.

In the game’s map selection screen, choose the “Continents-BMG” map type.

Select your desired map size:

Standard Six BMG (6 players/continent)

Standard Eight BMG (8 players/continent)

⚠️ First release: Remapping may be required in some edge cases. Tested in private games, but unanticipated issues may still arise.

Feedback Welcome!
Please report bugs, suggest improvements, or request parameter tweaks on the forum or via Discord (user blind on the CPL server). Your input helps make BMG better!