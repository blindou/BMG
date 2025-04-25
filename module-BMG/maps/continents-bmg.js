console.log("Generating using script continents-eight-mjpcount.js");
import { assignStartPositions, chooseStartSectors } from '/bmg-mode/maps/assign-starting-plots-bmg.js';
import { addMountains, addHills, expandCoasts, buildRainfallMap, generateLakes } from '/base-standard/maps/elevation-terrain-generator.js';
import { addFeatures, designateBiomes } from '/base-standard/maps/feature-biome-generator.js';
import * as globals from '/bmg-mode/maps/map-globals-bmg.js';
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
    // juste après avoir récupéré iWidth et iOceanWaterColumns
    const firstContinentFraction = 0.65;      // 60% pour l’ouest, 40% pour l’est
    const margin          = iOceanWaterColumns / 2;
    const dividerColumn   = Math.floor(iWidth * firstContinentFraction);

// nouveau westContinent
    let westContinent = {
        west:   margin,
        east:   dividerColumn - margin,
        south:  globals.g_PolarWaterRows,
        north:  iHeight - globals.g_PolarWaterRows,
        continent: 0
    };

// nouveau eastContinent
    let eastContinent = {
        west:   dividerColumn + margin,
        east:   iWidth - margin,
        south:  globals.g_PolarWaterRows,
        north:  iHeight - globals.g_PolarWaterRows,
        continent: 1
    };
    let startSectors = [];
    let iStartSectorRows = 0;
    let iStartSectorCols = 0;

    let bHumanNearEquator = utilities.needHumanNearEquator();
    iStartSectorRows = mapInfo.StartSectorRows;
    iStartSectorCols = mapInfo.StartSectorCols;
    startSectors = chooseStartSectors(iNumPlayers1, iNumPlayers2, iStartSectorRows, iStartSectorCols, bHumanNearEquator);
    dumpStartSectors(startSectors);
    createLandmasses(iWidth, iHeight, westContinent, eastContinent, iStartSectorRows, iStartSectorCols, startSectors);
    utilities.applyCoastalErosion(westContinent, .02, 1.5, .8, false);
    utilities.applyCoastalErosion(eastContinent, .02, 1.5, .8, false);
    utilities.addPlotTags(iHeight, iWidth, eastContinent.west);

    TerrainBuilder.validateAndFixTerrain();
    expandCoasts(iWidth, iHeight);
    utilities.adjustOceanPlotTags(iNumPlayers1 > iNumPlayers2);
    AreaBuilder.recalculateAreas();
    TerrainBuilder.stampContinents();
    addMountains(iWidth, iHeight);
    addVolcanoes(iWidth, iHeight);
    generateLakes(iWidth, iHeight, iTilesPerLake);
    AreaBuilder.recalculateAreas();
    TerrainBuilder.buildElevation();
    addHills(iWidth, iHeight);
    buildRainfallMap(iWidth, iHeight);
    TerrainBuilder.modelRivers(5, 15, globals.g_NavigableRiverTerrain);
    TerrainBuilder.validateAndFixTerrain();
    TerrainBuilder.defineNamedRivers();
    designateBiomes(iWidth, iHeight);
    addNaturalWonders(iWidth, iHeight, iNumNaturalWonders);

    // ─── 1) Ajout de patches tropicaux ─────────────────────
    console.log("Ajout de patches tropicaux…");
    const numTropicalPatches = 10;   // nombre de “center points”
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

    // ───────────────────────────────────────────────────────

    const horseIdx = GameInfo.Resources.lookup("RESOURCE_HORSES").$index;
    // À placer juste après avoir récupéré startPositions
    startPositions.forEach(plotIndex => {
        if (plotIndex == null) return;
        const { x: x0, y: y0 } = GameplayMap.getLocationFromIndex(plotIndex);
        let hasHores = false;
        let plots3 = GameplayMap.getPlotIndicesInRadius(x0, y0, 3);

        plots3 = plots3.filter(idx => idx !== plotIndex);

        utilities.shuffle(plots3)

        if (plots3.some(idx => {
            const p = GameplayMap.getLocationFromIndex(idx);
            return GameplayMap.getResourceType(p.x, p.y) === horseIdx;
        })) {
            hasHores = true;
        }

        if (!hasHores) {
            const candidates = plots3.filter(idx => {
                const p = GameplayMap.getLocationFromIndex(idx);
                console.log(ResourceBuilder.canHaveResource(p.x, p.y, horseIdx));
                return ResourceBuilder.canHaveResource(p.x, p.y, horseIdx);
            });

            if (candidates.length > 0) {
                // on place sur la première candidate
                const chosenIdx = candidates[0];
                const p = GameplayMap.getLocationFromIndex(chosenIdx);
                ResourceBuilder.setResourceType(p.x, p.y, horseIdx);
                console.log(`🐴 Placé Horses pour joueur à (${p.x},${p.y})`);
            } else {
                // fallback : on force la première case du rayon à devenir valide
                const fallbackIdx = plots3[0];
                const pf = GameplayMap.getLocationFromIndex(fallbackIdx);

                // 1) Transformer si c’est de l’eau en terrain de plaine
                if (GameplayMap.isWater(pf.x, pf.y)) {
                    TerrainBuilder.setTerrainType(pf.x, pf.y, globals.g_PlainTerrain);
                }

                // 2) Supprimer toute feature (falaise, forêt…)
                TerrainBuilder.setFeatureType(pf.x, pf.y, {
                    Feature: FeatureTypes.NO_FEATURE,
                    Direction: -1,
                    Elevation: 0
                });

                // 3) (Optionnel) Vider toute ressource existante
                ResourceBuilder.setResourceType(pf.x, pf.y, ResourceTypes.NO_RESOURCE);

                // 4) Maintenant qu’on a un terrain valide, on place Horses
                ResourceBuilder.setResourceType(pf.x, pf.y, horseIdx);
                console.log(`⚡ Fallback : forcé terrain et placé Horses pour joueur à (${pf.x},${pf.y})`);
            }

        }

        // --- 2) Vérifier proportion de collines (hill terrain) dans le rayon 3 ---
        const hillTerrain = globals.g_HillTerrain;

        let hillCount = 0;
        plots3.forEach(idx => {
            const { x, y } = GameplayMap.getLocationFromIndex(idx);
            if (GameplayMap.getTerrainType(x,y) === hillTerrain) hillCount++;
        });
        const needRatio = 0.30;  // 30%
        if (hillCount / plots3.length < needRatio) {
            // on convertit quelques cases plates en collines
            const toAdd = Math.ceil(needRatio * plots3.length) - hillCount;
            let added = 0;
            for (let idx of utilities.shuffle(plots3)) {
                if (added >= toAdd) break;
                const { x, y } = GameplayMap.getLocationFromIndex(idx);
                if (GameplayMap.getTerrainType(x,y) === globals.g_FlatTerrain) {
                    TerrainBuilder.setTerrainType(x,y, hillTerrain);
                    added++;
                }
            }
            console.log(`⛰️ Ajout de ${added} collines autour de (${x0},${y0})`);
        }

        // --- 3) Forcer la case de la capitale à “fertile” (valeur 3) ---
        // (ici on considère qu’on peut obtenir la "fertilité" via une méthode fictive getFertility)
        if (typeof GameplayMap.getFertility === "function") {
            const fert = GameplayMap.getFertility(x0, y0);
            if (fert < 3) {
                // on remplace la case par une plaine fertilisée, par exemple :
                TerrainBuilder.setTerrainType(x0, y0, globals.g_PlainTerrain);
                // et/ou on ajoute un bonus ressource “grain” si disponible :
                const grainIdx = GameInfo.Resources.lookup("RESOURCE_WHEAT")?.$index;
                if (grainIdx != null) ResourceBuilder.setResourceType(x0, y0, grainIdx);
                console.log(`🌾 Case de spawn (${x0},${y0}) re-fertilée`);
            }
        }

        // --- 4) Nettoyer volcans / montagnes autour (rayon 1) ---
        TerrainBuilder.validateAndFixTerrain(); // s’assurer d’un état cohérent avant
        const plots = GameplayMap.getPlotIndicesInRadius(x0, y0, 1);
        plots.forEach(idx => {
            const { x, y } = GameplayMap.getLocationFromIndex(idx);
            if (GameplayMap.isMountain(x, y) || GameplayMap.getFeatureType(x,y) === FeatureTypes.VOLCANO) {
                // on remet en “plat”
                TerrainBuilder.setTerrainType(x, y, globals.g_FlatTerrain);
                TerrainBuilder.setFeatureType(x, y, {
                    Feature: FeatureTypes.NO_FEATURE,
                    Direction: -1,
                    Elevation: 0
                });
                console.log(`🗻 Suppression montagne/faille en (${x},${y})`);
            }
        });
    });
    TerrainBuilder.validateAndFixTerrain();
    dumpTerrain(iWidth, iHeight);
    dumpElevation(iWidth, iHeight);
    dumpRainfall(iWidth, iHeight);
    dumpBiomes(iWidth, iHeight);
    dumpFeatures(iWidth, iHeight);
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
