// Continents.ts
/**
 * Base game map script - Produces widely varied continents.
 * @packageDocumentation
 */
console.log("Generating using script Continents.ts");
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
    if (bIsBalanced) {
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
        startSectors = chooseStartSectors(iNumPlayers1, iNumPlayers2, iStartSectorRows, iStartSectorCols, bHumanNearEquator);
        dumpStartSectors(startSectors);
        createLandmasses(iWidth, iHeight, westContinent, eastContinent, iStartSectorRows, iStartSectorCols, startSectors);
        utilities.applyCoastalErosionAdjustingForStartSectors(westContinent, eastContinent, .02, 1.5, .8, iStartSectorRows, iStartSectorCols, startSectors);
        utilities.applyCoastalErosionAdjustingForStartSectors(eastContinent, eastContinent, .02, 1.5, .8, iStartSectorRows, iStartSectorCols, startSectors);
        utilities.addPlotTags(iHeight, iWidth, eastContinent.west);
    }
    else {
        console.log("Standard Map");
        let iFractalGrain = 2;
        let iWaterPercent = globals.g_WaterPercent * globals.g_Cutoff;
        let iLargestContinentPercent = 18;
        utilities.createOrganicLandmasses(iWidth, iHeight, westContinent, eastContinent, iFractalGrain, iWaterPercent, iLargestContinentPercent);
        utilities.addPlotTags(iHeight, iWidth, eastContinent.west);
        utilities.applyCoastalErosion(westContinent, .02, 1.5, .8, false);
        utilities.applyCoastalErosion(eastContinent, .02, 1.5, .8, false);
        // Is biggest area in west or east?
        let iAreaID = AreaBuilder.findBiggestArea(false);
        let kBoundaries = AreaBuilder.getAreaBoundary(iAreaID);
        console.log("BIGGEST AREA");
        console.log("  West: " + kBoundaries.west);
        console.log("  East: " + kBoundaries.east);
        console.log("  South: " + kBoundaries.south);
        console.log("  North: " + kBoundaries.north);
        if (kBoundaries.west > (iWidth / 2)) {
            let iNum1 = iNumPlayers1;
            let iNum2 = iNumPlayers2;
            iNumPlayers1 = iNum2;
            iNumPlayers2 = iNum1;
        }
    }
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

    const horseIdx = GameInfo.Resources.lookup("RESOURCE_HORSES").$index;
    const ironIdx = GameInfo.Resources.lookup("RESOURCE_IRON")?.$index ?? -1;
    startPositions.forEach(plotIndex => {
        if (plotIndex == null) return;
        const {x: x0, y: y0} = GameplayMap.getLocationFromIndex(plotIndex);

        // 1) Placement de Horses et Iron dans l'anneau de distance ]3;6]
        const plots6 = GameplayMap.getPlotIndicesInRadius(x0, y0, 6).filter(idx => idx !== plotIndex);
        utilities.shuffle(plots6);
        const hasHorse = plots6.some(idx => {
            const p = GameplayMap.getLocationFromIndex(idx);
            return GameplayMap.getResourceType(p.x, p.y) === horseIdx;
        });
        const hasIron = ironIdx >= 0 && plots6.some(idx => {
            const p = GameplayMap.getLocationFromIndex(idx);
            return GameplayMap.getResourceType(p.x, p.y) === ironIdx;
        });
        const ring = plots6.filter(idx => {
            const p = GameplayMap.getLocationFromIndex(idx);
            const d = GameplayMap.getPlotDistance(x0, y0, p.x, p.y);
            return d > 3 && d <= 6;
        });
        if (!hasHorse) {
            const horseCands = ring.filter(idx => {
                const p = GameplayMap.getLocationFromIndex(idx);
                return ResourceBuilder.canHaveResource(p.x, p.y, horseIdx);
            });
            if (horseCands.length > 0) {
                const p = GameplayMap.getLocationFromIndex(horseCands[0]);
                ResourceBuilder.setResourceType(p.x, p.y, horseIdx);
                console.log(`🐴 Placé Horses à (${p.x},${p.y})`);
            }
        }
        if (ironIdx >= 0 && !hasIron) {
            const ironCands = ring.filter(idx => {
                const p = GameplayMap.getLocationFromIndex(idx);
                return ResourceBuilder.canHaveResource(p.x, p.y, ironIdx);
            });
            if (ironCands.length > 0) {
                const p = GameplayMap.getLocationFromIndex(ironCands[0]);
                ResourceBuilder.setResourceType(p.x, p.y, ironIdx);
                console.log(`⛓️ Placé Iron à (${p.x},${p.y})`);
            }
        }

        // 2) Vérifier proportion de collines et forêts dans le rayon 3
        // const hillTerrain = globals.g_HillTerrain;
        // const forestFeature = GameInfo.Features.find(f => f.FeatureType === "FEATURE_FOREST").$index; // index de la forêt
        // let goodCount = 0;
        // const plots3 = GameplayMap.getPlotIndicesInRadius(x0, y0, 3).filter(idx => idx !== plotIndex);
        // plots3.forEach(idx => {
        //     const {x, y} = GameplayMap.getLocationFromIndex(idx);
        //     if (GameplayMap.getTerrainType(x, y) === hillTerrain ||
        //         GameplayMap.getFeatureType(x, y) === forestFeature) {
        //         goodCount++;
        //     }
        // });
        // const needRatio = 0.12;  // 12%
        // if (goodCount / plots3.length < needRatio) {
        //     const toAdd = Math.ceil(needRatio * plots3.length) - goodCount;
        //     let added = 0;
        //     for (let idx of utilities.shuffle(plots3)) {
        //         if (added >= toAdd) break;
        //         const {x, y} = GameplayMap.getLocationFromIndex(idx);
        //         // Vérifier que la case n'a pas déjà une forêt ou une colline
        //         if (GameplayMap.getTerrainType(x, y) === globals.g_FlatTerrain &&
        //             GameplayMap.getFeatureType(x, y) !== forestFeature) {
        //             // 50% de chance d'ajouter une forêt ou une colline
        //             if (Math.random() < 0.5) {
        //                 TerrainBuilder.setTerrainType(x, y, hillTerrain);
        //             } else {
        //                 TerrainBuilder.setFeatureType(x, y, forestFeature);
        //             }
        //             added++;
        //         }
        //     }
        //     console.log(`⛰️🌲 Ajout de ${added} collines/forêts autour de (${x0},${y0})`);
        // }
    });
    TerrainBuilder.validateAndFixTerrain();
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
    console.log("Spawn Scores:",totalScores.map(s=>s.toFixed(2)));




    const minTotal=Math.min(...totalScores);
    if (minTotal < 0.45) {
        console.log(`❌ Score minimum détecté : ${minTotal}, relance de la carte...`);
        // engine.trigger("GenerateMap");
        return;
    }

    // ───────────────────────────────────────────────────────



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
            //  Must be water if at the poles - Augmenter la zone d'eau aux pôles
            if (iY < continent1.south + iBuffer + 2 || iY >= continent1.north - iBuffer - 2) {
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
