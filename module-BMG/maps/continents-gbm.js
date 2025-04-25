console.log("Generating using script continents-eight-mjpcount.js");
import { assignStartPositions, chooseStartSectors } from '/mj-pcount/maps/assign-starting-plots-mjpcount.js';
import { addMountains, addHills, expandCoasts, buildRainfallMap, generateLakes } from '/mj-pcount/maps/elevation-terrain-generator.js';
import { addFeatures, designateBiomes } from '/base-standard/maps/feature-biome-generator.js';
import * as globals from '/base-standard/maps/map-globals.js';
import * as utilities from '/base-standard/maps/map-utilities.js';
import { addNaturalWonders } from '/base-standard/maps/natural-wonder-generator.js';
import { generateResources } from '/base-standard/maps/resource-generator.js';
import { addVolcanoes } from '/base-standard/maps/volcano-generator.js';
import { assignAdvancedStartRegions } from '/base-standard/maps/assign-advanced-start-region.js';
import { generateDiscoveries } from '/base-standard/maps/discovery-generator.js';
import { generateSnow, dumpPermanentSnow } from '/base-standard/maps/snow-generator.js';
import { dumpStartSectors, dumpContinents, dumpTerrain, dumpElevation, dumpRainfall, dumpBiomes, dumpFeatures, dumpResources, dumpNoisePredicate } from '/base-standard/maps/map-debug-helpers.js';


function requestMapData(initParams) {
    console.log(initParams.width);
    console.log(initParams.height);
    console.log(initParams.topLatitude);
    console.log(initParams.bottomLatitude);
    console.log(initParams.wrapX);
    console.log(initParams.wrapY);
    console.log(initParams.mapSize);
    engine.call("SetMapInitData", initParams);
}

function generateMap() {

    console.log("Generating a map!");
    console.log(`Age - ${GameInfo.Ages.lookup(Game.age).AgeType}`);
    let iWidth = GameplayMap.getGridWidth();
    let iHeight = GameplayMap.getGridHeight();

    function WhoManyCliff(nbr){
        console.log("=== Détail des falaise ===" + nbr);
        let cliffTileCount = 0;
        const dirs = DirectionTypes.NUM_DIRECTION_TYPES; // normalement 6

        for (let y = 0; y < iHeight; y++) {
            for (let x = 0; x < iWidth; x++) {
                for (let d = 0; d < dirs; d++) {
                    if (GameplayMap.isCliffCrossing(x, y, d)) {
                        cliffTileCount++;
                        break;  // passe à la tuile suivante dès qu’on trouve une falaise
                    }
                }
            }
        }
        console.log(`Nombre de tuiles adjacentes à au moins une falaise : ${cliffTileCount}`);
    }

    function findResourcePlot(x0, y0, resIdx, maxDist) {
        const seen = new Set();
        let frontier = [{ x: x0, y: y0 }];
        for (let dist = 1; dist <= maxDist; dist++) {
            const next = [];
            for (const { x, y } of frontier) {
                for (let dir = 0; dir < DirectionTypes.NUM_DIRECTION_TYPES; dir++) {
                    const loc = GameplayMap.getAdjacentPlotLocation({ x, y }, dir);
                    const key = loc.x + "," + loc.y;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    if (loc.x < 0 || loc.y < 0 || loc.x >= iWidth || loc.y >= iHeight) continue;
                    if (ResourceBuilder.canHaveResource(loc.x, loc.y, resIdx)) {
                        return loc;
                    }
                    next.push(loc);
                }
            }
            frontier = next;
        }
        return null;
    }
    let uiMapSize = GameplayMap.getMapSize();
    let startPositions = [];
    let mapInfo = GameInfo.Maps.lookup(uiMapSize);
    if (mapInfo == null)
        return;
    let iNumNaturalWonders = mapInfo.NumNaturalWonders;

    let iTilesPerLake = mapInfo.LakeGenerationFrequency;
    let iNumPlayers1 = mapInfo.PlayersLandmass1;
    let iNumPlayers2 = mapInfo.PlayersLandmass2;
    // Establish continent boundaries
    let iOceanWaterColumns = globals.g_OceanWaterColumns;
    let westContinent = {
        west: iOceanWaterColumns / 2,
        east: (iWidth / 2) - (iOceanWaterColumns / 2),
        south: globals.g_PolarWaterRows,
        north: iHeight - globals.g_PolarWaterRows,
        continent: 0
    };
    let eastContinent = {
        west: (iWidth / 2) + (iOceanWaterColumns / 2),
        east: iWidth - (iOceanWaterColumns / 2),
        south: globals.g_PolarWaterRows,
        north: iHeight - globals.g_PolarWaterRows,
        continent: 0
    };
    let startSectors = [];
    let iStartSectorRows = 0;
    let iStartSectorCols = 0;

    let startPosition = Configuration.getMapValue("StartPosition");
    if (startPosition == null) {
        startPosition = Database.makeHash('START_POSITION_STANDARD');
    }
    startPosition = Number(BigInt.asIntN(32, BigInt(startPosition))); // Convert to signed int32.
    let startPositionHash = Database.makeHash("START_POSITION_BALANCED");
    let bIsBalanced = (startPosition == startPositionHash);

    console.log("Balanced Map");
    let iRandom = TerrainBuilder.getRandomNumber(2, "East or West");
    if (iRandom == 1) {
        let iNum1 = iNumPlayers1;
        let iNum2 = iNumPlayers2;
        iNumPlayers1 = iNum2;
        iNumPlayers2 = iNum1;
    }
    let bHumanNearEquator = utilities.needHumanNearEquator();
    iStartSectorRows = mapInfo.StartSectorRows;
    iStartSectorCols = mapInfo.StartSectorCols;
    //log all var in chooseStartSectors
    console.log("chooseStartSectors");
    const alive = Players.getAliveMajorIds();
    console.log("Alive Majors:", alive);               // [1, 2, 3, …]
    alive.forEach(id => {
        const p = Players.get(id);
        const eCivType    = p.civilizationType;
        const eLeaderType = p.leaderType;

        // Récupère les clés de type (ex. "CIVILIZATION_AMERICA" / "LEADER_WASHINGTON")
        const civKey   = GameInfo.Civilizations.lookup(eCivType)?.CivilizationType;
        const leaderKey = GameInfo.Leaders.lookup(eLeaderType)?.LeaderType;

        console.log(`––– Player ${id} –––`);
        console.log(`Civ : ${civKey}`,   JSON.stringify(GameInfo.Civilizations.lookup(eCivType), null, 2));
        console.log(`Leader : ${leaderKey}`, JSON.stringify(GameInfo.Leaders.lookup(eLeaderType), null, 2));



        // Fonction utilitaire pour afficher un tableau de biais
        function logBias(tableName, defs, typeField) {
            const list = defs.filter(def =>
                def.CivilizationType === civKey || def.LeaderType === leaderKey
            );
            if (list.length > 0) {
                console.log(`  ${tableName}:`);
                list.forEach(def => {
                    const what = typeField ? def[typeField] : '';
                    console.log(`    • ${what} → Score ${def.Score}`);
                });
            }
        }

        // Biome biases (ex. “TROPICAL”)
        logBias(
            'Biome biases',
            GameInfo.StartBiasBiomes,
            'BiomeType'
        );

        // Terrain biases (ex. “TERRAIN_HILL”, “TERRAIN_COAST”, etc.)
        logBias(
            'Terrain biases',
            GameInfo.StartBiasTerrains,
            'TerrainType'
        );

        // FeatureClass biases (ex. “FEATURE_CLASS_FOREST”)
        logBias(
            'FeatureClass biases',
            GameInfo.StartBiasFeatureClasses,
            'FeatureClassType'
        );

        // Resource biases (ex. “RESOURCE_IRON”)
        logBias(
            'Resource biases',
            GameInfo.StartBiasResources,
            'ResourceType'
        );

        // Lake biases (Score appliqué à chaque lac, pas de type)
        logBias(
            'Lake biases',
            GameInfo.StartBiasLakes,
            null
        );

        // Natural Wonder biases (ex. “NATURAL_WONDER_GRAND_CANYON”)
        logBias(
            'Natural Wonder biases',
            GameInfo.StartBiasNaturalWonders,
            'NaturalWonderType'
        );


    });


    startSectors = chooseStartSectors(iNumPlayers1, iNumPlayers2, iStartSectorRows, iStartSectorCols, bHumanNearEquator);
    dumpStartSectors(startSectors);

    // ─── Boucle de ré-génération tant que l’équité n’est pas bonne ───
    const maxAttempts      = 5;
    const equityThreshold  = 0.5;   // minScore ≥ 80% de la moyenne
    let attempt            = 0;
    let startScores;

    while (true) {
        attempt++;
        console.log(`– Tentative de génération #${attempt}`);

        // ─── RESET COMPLET DE LA CARTE ──────────────────────────
        console.log("🔄 Reset map state avant regen…");
        for (let y = 0; y < iHeight; y++) {
            for (let x = 0; x < iWidth; x++) {
                // 1) Remise à plat du terrain
                TerrainBuilder.setTerrainType(x, y, globals.g_FlatTerrain);

                // 2) Suppression de tout feature (forêt, volcan, marais…)
                TerrainBuilder.setFeatureType(x, y, { Feature: FeatureTypes.NO_FEATURE, Direction: -1, Elevation: 0 });

                // 3) Suppression des ressources
                ResourceBuilder.setResourceType(x, y, ResourceTypes.NO_RESOURCE);

                // 4) Suppression des rivières & fleuves (si API dispo)
                if (typeof TerrainBuilder.clearRiverAt === "function") {
                    TerrainBuilder.clearRiverAt(x, y);
                }

                // 5) Suppression des floodplains (si API)
                if (typeof TerrainBuilder.clearFloodplains === "function") {
                    TerrainBuilder.clearFloodplains(x, y);
                }
            }
        }
        // ────────────────────────────────────────────────────────

        // 1) Génération terrain+biomes+ressources
        createLandmasses(iWidth, iHeight, westContinent, eastContinent, iStartSectorRows, iStartSectorCols, startSectors);
        utilities.applyCoastalErosionAdjustingForStartSectors(westContinent, eastContinent, .02, 1.5, .8, iStartSectorRows, iStartSectorCols, startSectors);
        utilities.addPlotTags(iHeight, iWidth, eastContinent.west);
        TerrainBuilder.validateAndFixTerrain();
        expandCoasts(iWidth, iHeight);
        utilities.adjustOceanPlotTags(iNumPlayers1 > iNumPlayers2);
        AreaBuilder.recalculateAreas();
        TerrainBuilder.stampContinents();
        addMountains(iWidth, iHeight);
        addVolcanoes(iWidth, iHeight);
        generateLakes(iWidth, iHeight, iTilesPerLake);
        WhoManyCliff(3);

        AreaBuilder.recalculateAreas();
        TerrainBuilder.buildElevation();
        addHills(iWidth, iHeight);
        buildRainfallMap(iWidth, iHeight);
        WhoManyCliff(4);

        TerrainBuilder.modelRivers(5, 15, globals.g_NavigableRiverTerrain);
        TerrainBuilder.validateAndFixTerrain();
        TerrainBuilder.defineNamedRivers();
        designateBiomes(iWidth, iHeight);
        addNaturalWonders(iWidth, iHeight, iNumNaturalWonders);
        // ─── 1) Ajout de patches tropicaux ─────────────────────
        console.log("Ajout de patches tropicaux…");
        const numTropicalPatches = 50;   // nombre de “center points”
        const patchRadius        = 2;    // rayon autour de chaque point

        for (let i = 0; i < numTropicalPatches; i++) {
            const x = TerrainBuilder.getRandomNumber(iWidth,  "TropPatchX");
            const y = TerrainBuilder.getRandomNumber(iHeight, "TropPatchY");
            for (let dy = -patchRadius; dy <= patchRadius; dy++) {
                for (let dx = -patchRadius; dx <= patchRadius; dx++) {
                    const nx = x + dx, ny = y + dy;
                    if (
                        nx >= 0 && nx < iWidth &&
                        ny >= 0 && ny < iHeight &&
                        !GameplayMap.isWater(nx, ny)
                    ) {
                        TerrainBuilder.setBiomeType(nx, ny, globals.g_TropicalBiome);
                    }
                }
            }
        }

// ─── 2) Ajout de lacs supplémentaires ───────────────────
        console.log("Ajout de lacs supplémentaires…");
        const extraLakeFreq = Math.floor(iTilesPerLake * 1.5);
        generateLakes(iWidth, iHeight, extraLakeFreq);

// ─── 3) Passage rivières navigables supplémentaires ────
        console.log("Ajout de rivières navigables…");
        TerrainBuilder.modelRivers(4, 12, globals.g_NavigableRiverTerrain);


// ─── Comptage des biomes ───────────────────────────
        const biomeCounts = {};
        for (let y = 0; y < iHeight; y++) {
            for (let x = 0; x < iWidth; x++) {
                const b = GameplayMap.getBiomeType(x, y);
                biomeCounts[b] = (biomeCounts[b] || 0) + 1;
            }
        }

        console.log("=== Nombre de tuiles par Biome ===");
        for (const [biomeIndex, count] of Object.entries(biomeCounts)) {
            // On récupère le type de biome (ex. "BIOME_TUNDRA")
            const biomeInfo = GameInfo.Biomes.find(b => b.$index === Number(biomeIndex));
            const name = biomeInfo ? biomeInfo.BiomeType : `Index_${biomeIndex}`;
            console.log(`  ${name.padEnd(15)} : ${count}`);
        }
// ────────────────────────────────────────────────────


        TerrainBuilder.addFloodplains(4, 10);
        addFeatures(iWidth, iHeight);
        TerrainBuilder.validateAndFixTerrain();
        AreaBuilder.recalculateAreas();
        TerrainBuilder.storeWaterData();
        generateSnow(iWidth, iHeight);
        dumpContinents(iWidth, iHeight);
        dumpTerrain(iWidth, iHeight);
        dumpElevation(iWidth, iHeight);
        dumpRainfall(iWidth, iHeight);
        dumpBiomes(iWidth, iHeight);
        dumpFeatures(iWidth, iHeight);
        dumpPermanentSnow(iWidth, iHeight);
        generateResources(iWidth, iHeight, westContinent, eastContinent, iNumPlayers1, iNumPlayers2);

        // 2) Placement des joueurs
        startPositions = assignStartPositions(iNumPlayers1, iNumPlayers2, westContinent, eastContinent, iStartSectorRows, iStartSectorCols, startSectors);

// Evaluate spawns multi-criteria
        const positions = startPositions.map(pi=>GameplayMap.getLocationFromIndex(pi));
        const biasScores=[],resCounts=[],fertSums=[],minDists=[];
        positions.forEach((loc,i)=>{
            biasScores.push(StartPositioner.getStartPositionScore(loc.x,loc.y));
            let rc=0,fs=0;
            for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const x=loc.x+dx,y=loc.y+dy;if(x<0||y<0||x>=iWidth||y>=iHeight)continue; if(GameplayMap.getResourceType(x,y)>0&&GameInfo.Resources.lookup(GameplayMap.getResourceType(x,y)).ResourceClassType==='RESOURCECLASS_BONUS') rc++; // Fertility metric removed (getFertility not available)
                fs += 0;}
            resCounts.push(rc); fertSums.push(fs);
            let md=Infinity; positions.forEach((o,j)=>{if(i!==j){const d=GameplayMap.getPlotDistance(loc.x,loc.y,o.x,o.y); if(d<md) md=d;}});
            minDists.push(md);
        });
        const maxBias=Math.max(...biasScores), maxRes=Math.max(...resCounts), maxFert=Math.max(...fertSums), maxDist=Math.max(...minDists);
        const w={bias:0.45,res:0.25,water:0.1,coast:0.1,fert:0,dist:0.1};
        const totalScores=positions.map((loc,i)=>{
            const hasFresh=GameplayMap.isRiver(loc.x,loc.y)||GameplayMap.isAdjacentToRivers(loc.x,loc.y,1);
            const isCoast=GameplayMap.isCoastalLand(loc.x,loc.y);
            const nB=maxBias?biasScores[i]/maxBias:0;
            const nR=maxRes?resCounts[i]/maxRes:0;
            const nF=maxFert?fertSums[i]/maxFert:0;
            const nD=maxDist?minDists[i]/maxDist:0;
            return w.bias*nB + w.res*nR + w.water*(hasFresh?1:0) + w.coast*(isCoast?1:0) + w.fert*nF + w.dist*nD;
        });
        const minTotal=Math.min(...totalScores);
        console.log("Spawn Scores:",totalScores.map(s=>s.toFixed(2)));
        if(minTotal>=equityThreshold) { console.log("✅ Spawns équilibrés"); break; }
        if(attempt>=maxAttempts){ console.log("⚠️ Fin tentatives"); break; }
        console.log("↻ Réessai génération...");
    }
    // ───────────────────────────────────────────────────────
    const cottonRes = GameInfo.Resources.lookup("RESOURCE_COTTON")?.$index;
    const woolRes   = GameInfo.Resources.lookup("RESOURCE_WOOL")?.$index;
    const resOptions = [cottonRes, woolRes].filter(r => r != null);

// Boucle sur chaque spawn
    startPositions.forEach((plotIndex, idx) => {
        if (plotIndex == null) return;
        const spawnLoc = GameplayMap.getLocationFromIndex(plotIndex);

        // 1) Choix cotton ou wool
        const choice = TerrainBuilder.getRandomNumber(resOptions.length, "Choose Cotton/Wool");
        const resType = resOptions[choice];

        // 2) Recherche à dist = 1, puis dist = 2
        let target = findResourcePlot(spawnLoc.x, spawnLoc.y, resType, 1);
        if (!target) {
            target = findResourcePlot(spawnLoc.x, spawnLoc.y, resType, 2);
        }
        if (!target) {
            target = findResourcePlot(spawnLoc.x, spawnLoc.y, resType, 3);
        }

        // 3) Placement ou warning
        if (target) {
            ResourceBuilder.setResourceType(target.x, target.y, resType);
            const nameKey = GameInfo.Resources.lookup(resType).Name;
            console.log(`✅ Placé ${Locale.compose(nameKey)} pour le joueur ${idx+1} en (${target.x},${target.y})`);
        } else {
            console.log(`⚠️ Impossible de placer ${resType === cottonRes ? "Coton" : "Laine"} pour le joueur ${idx+1}`);

        }
    });

// 2) On filtre pour ne garder que les indices valides
    const resourceList = allResources.filter(idx => typeof idx === "number");

// 3) Debug détaillé
    console.log("=== Détail de toutes les ressources générées ===");
    resourceList.forEach(resIdx => {
        const info = GameInfo.Resources.lookup(resIdx);
        if (!info) return console.log(`– Indice invalide : ${resIdx}`);
        console.log(`-- Ressource ${info.ResourceType} (${resIdx}) --`);
        console.log(`   Nom                : ${info.Name}`);
        console.log(`   Poids (Weight)     : ${info.Weight}`);
        console.log(`   Hémisphère         : ${info.Hemispheres}`);
        console.log(`   MinimumPerHemisph. : ${info.MinimumPerHemisphere}`);
        console.log(`   ClassType          : ${info.ResourceClassType}`);
        console.log(`   PlacementPriority  : ${info.PlacementPriority}`);
    });

    generateDiscoveries(iWidth, iHeight, startPositions);
    dumpResources(iWidth, iHeight);
    FertilityBuilder.recalculate(); // Must be after features are added.
    let seed = GameplayMap.getRandomSeed(); // can use any seed you want for different noises
    let avgDistanceBetweenPoints = 3;
    let normalizedRangeSmoothing = 2;
    let poisson = TerrainBuilder.generatePoissonMap(seed, avgDistanceBetweenPoints, normalizedRangeSmoothing);
    let poissonPred = (val) => {
        return val >= 1 ? "*" : " ";
    };
    dumpNoisePredicate(iWidth, iHeight, poisson, poissonPred);
    assignAdvancedStartRegions();
}
// Register listeners.
engine.on('RequestMapInitData', requestMapData);
engine.on('GenerateMap', generateMap);
console.log("Loaded Continents.ts");
console.log("hey, continents is firing");


function createLandmasses(iWidth, iHeight, continent1, continent2, iStartSectorRows, iStartSectorCols, startSectors) {
    FractalBuilder.create(globals.g_LandmassFractal, iWidth, iHeight, 2, 0);
    let iWaterHeight = FractalBuilder.getHeightFromPercent(globals.g_LandmassFractal, globals.g_WaterPercent);
    let iBuffer = Math.floor(iHeight / 18.0);
    let iBuffer2 = Math.floor(iWidth / 28.0);
    for (let iY = 0; iY < iHeight; iY++) {
        for (let iX = 0; iX < iWidth; iX++) {
            let terrain = globals.g_FlatTerrain;
            let iRandom = TerrainBuilder.getRandomNumber(iBuffer, "Random Top/Bottom Edges");
            let iRandom2 = TerrainBuilder.getRandomNumber(iBuffer2, "Random Left/Right Edges");
            //  Must be water if at the poles
            if (iY < continent1.south + iRandom || iY >= continent1.north - iRandom) {
                terrain = globals.g_OceanTerrain;
            }
            // Of if between the continents
            else if (iX < continent1.west + iRandom2 || iX >= continent2.east - iRandom2 ||
                (iX >= continent1.east - iRandom2 && iX < continent2.west + iRandom2)) {
                terrain = globals.g_OceanTerrain;
            }
            else {
                let iPlotHeight = utilities.getHeightAdjustingForStartSector(iX, iY, iWaterHeight, globals.g_FractalWeight, globals.g_CenterWeight, globals.g_StartSectorWeight, continent1, continent2, iStartSectorRows, iStartSectorCols, startSectors);
                // Finally see whether or not this stays as Land or has too low a score and drops back to water
                if (iPlotHeight < iWaterHeight * globals.g_Cutoff) {
                    let iSector = utilities.getSector(iX, iY, iStartSectorRows, iStartSectorCols, continent1.south, continent1.north, continent1.west, continent1.east, continent2.west);
                    if (startSectors[iSector]) {
                        terrain = globals.g_CoastTerrain;
                    }
                    else {
                        terrain = globals.g_OceanTerrain;
                    }
                }
            }
            TerrainBuilder.setTerrainType(iX, iY, terrain);
        }
    }
}

//# sourceMappingURL=file:///base-standard/maps/continents.js.map
