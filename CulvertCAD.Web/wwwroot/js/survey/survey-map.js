(() => {
    "use strict";

    /* Step 1 : Read survey point data prepared by the app

    Three input - Survey points, alignmentpoints , culverts*/

    const canvas = document.getElementById("survey-map-canvas");
    const leafletContainer = document.getElementById("survey-leaflet-map");
    const status = document.getElementById("survey-map-status");

    if (!canvas || !status) return;

    if (!window.THREE) {
        status.textContent =
            "Map unavailable: Three.js could not be loaded.";
        return;
    }

    try {
        const readJson = (id) => {
            const element = document.getElementById(id);
            return element ? JSON.parse(element.textContent || "null") : null;
        };

        const surveyPoints = readJson("survey-map-points-data") || [];
        const workingCrs = readJson("survey-map-working-crs-data");

        if (!window.L || !leafletContainer || !window.proj4) {
            status.textContent = "Leaflet or coordinate conversion library could not be loaded.";
        } else {
            const utmMatch =
                typeof workingCrs === "string"
                    ? workingCrs.match(/^EPSG:326(4[2-7])$/)
                    : null;

            if (!utmMatch) {
                throw new Error(
                    `Unsupported or missing survey CRS: ${workingCrs}`
                );
            }

            const utmZone = Number(utmMatch[1]);

            proj4.defs(
                workingCrs,
                `+proj=utm +zone=${utmZone} +datum=WGS84 +units=m +no_defs`
            );

            const leafletMap = L.map(leafletContainer);
            leafletContainer.style.display = "none";

            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: "&copy; OpenStreetMap contributors"
            }).addTo(leafletMap);

            window.surveyLeafletMap = leafletMap;

            window.setSurveyMapMode = function (mode) {
                const leaflet = document.getElementById("survey-leaflet-map");
                const surveyCanvas = document.getElementById("survey-map-canvas");
                const show2D = mode === "2d";

                if (leaflet) {
                    leaflet.style.display = show2D ? "block" : "none";
                    leaflet.style.visibility = show2D ? "visible" : "hidden";
                    leaflet.style.pointerEvents = show2D ? "auto" : "none";

                    if (show2D && window.surveyLeafletMap) {
                        window.surveyLeafletMap.invalidateSize();
                    }
                }

                if (surveyCanvas) {
                    surveyCanvas.style.display = show2D ? "none" : "block";
                }
            };
        }

        const alignmentPoints = readJson("survey-map-alignment-data") || [];
        const culverts = readJson("survey-map-culverts-data") || [];

        if (!surveyPoints.length && !alignmentPoints.length) {
            status.textContent = "No survey or alignment points are available.";
            return;
        }

        const THREE = window.THREE;

        const scene = new THREE.Scene();
        scene.background = null;

        const camera = new THREE.PerspectiveCamera(
            50,
            1,
            0.1,
            1000000
        );

        const renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: true
        });

        renderer.setClearColor(0x000000, 0);

        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

        scene.add(new THREE.AmbientLight(0xffffff, 1.4));

        const light = new THREE.DirectionalLight(0xffffff, 1.2);
        light.position.set(100, 200, 150);
        scene.add(light);

        /*  Step 2 : Checks whether the coordinates are usable : Numeric validity

        Filters survey points to keep records with numeric Easting, Northing and RL values */

        const validSurvey = surveyPoints.filter(p =>
            Number.isFinite(Number(p.Easting)) &&
            Number.isFinite(Number(p.Northing)) &&
            Number.isFinite(Number(p.RL))
        );

        if (window.surveyLeafletMap && validSurvey.length > 0) {
            const geographicPoints = validSurvey
                .map(p => {
                    const easting = Number(p.Easting);
                    const northing = Number(p.Northing);

                    if (!Number.isFinite(easting) || !Number.isFinite(northing)) {
                        return null;
                    }

                    const [longitude, latitude] = proj4(
                        workingCrs,
                        "EPSG:4326",
                        [easting, northing]
                    );

                    return [latitude, longitude];
                })
                .filter(p => p !== null);

            if (geographicPoints.length > 0) {
                window.surveyLeafletMap.fitBounds(geographicPoints, {
                    padding: [20, 20]
                });
            }
        }

        const validAlignment = alignmentPoints.filter(p =>
            Number.isFinite(Number(p.Easting)) &&
            Number.isFinite(Number(p.Northing))
        );

        /* Step 3: Calculate viewers horizontal bound  = survey horizontal + alignment horiontal

        Horizontal bounds use both survey and alignment coordinates.
        Elevation bounds use only actual surveyed RL values. */

        const horizontalPoints = [
            ...validSurvey.map(p => ({
                x: Number(p.Easting),
                z: Number(p.Northing)
            })),
            ...validAlignment.map(p => ({
                x: Number(p.Easting),
                z: Number(p.Northing)
            }))
        ];

        const elevations = validSurvey.map(p => Number(p.RL));

        if (!horizontalPoints.length || !elevations.length) {
            status.textContent = "Insufficient valid survey data to render terrain.";
            return;
        }

        const minE = Math.min(...horizontalPoints.map(p => p.x));
        const maxE = Math.max(...horizontalPoints.map(p => p.x));
        const minN = Math.min(...horizontalPoints.map(p => p.z));
        const maxN = Math.max(...horizontalPoints.map(p => p.z));
        const minRL = Math.min(...elevations);
        const maxRL = Math.max(...elevations);
        console.log("Survey coordinate bounds:", {
            minE: Math.min(...validSurvey.map(p => Number(p.Easting))),
            maxE: Math.max(...validSurvey.map(p => Number(p.Easting))),
            minN: Math.min(...validSurvey.map(p => Number(p.Northing))),
            maxN: Math.max(...validSurvey.map(p => Number(p.Northing)))
        });

        console.log("Alignment coordinate bounds:", {
            minE: validAlignment.length
                ? Math.min(...validAlignment.map(p => Number(p.Easting)))
                : null,
            maxE: validAlignment.length
                ? Math.max(...validAlignment.map(p => Number(p.Easting)))
                : null,
            minN: validAlignment.length
                ? Math.min(...validAlignment.map(p => Number(p.Northing)))
                : null,
            maxN: validAlignment.length
                ? Math.max(...validAlignment.map(p => Number(p.Northing)))
                : null
        });

        /* Step 4 : Transformation from Real Survey to coordinate system of three.js

        Local origin keeps large UTM coordinates numerically manageable. */

        const centerE = (minE + maxE) / 2;
        const centerN = (minN + maxN) / 2;
        const baseRL = minRL;

        const terrainScale = 1; // Horizontal preserved numerically
        const verticalExaggeration = 3; // Scale vertically enlarged 3x

        const toWorld = (easting, northing, rl) => new THREE.Vector3(
            (Number(easting) - centerE) * terrainScale,
            (Number(rl) - baseRL) * verticalExaggeration,
            (Number(northing) - centerN) * terrainScale
        );

        /* 5. GRID BELOW SURVEY TERRAIN

        Add simple rectangular grid below the survey terrain. */
        const gridWidth = Math.max(maxE - minE, 10);
        const gridLength = Math.max(maxN - minN, 10);
        const gridSpacing = 50;
        const gridY = -20;

        const gridVertices = [];

        for (let x = -gridWidth / 2; x <= gridWidth / 2; x += gridSpacing) {
            gridVertices.push(
                x, gridY, -gridLength / 2,
                x, gridY, gridLength / 2
            );
        }

        for (let z = -gridLength / 2; z <= gridLength / 2; z += gridSpacing) {
            gridVertices.push(
                -gridWidth / 2, gridY, z,
                gridWidth / 2, gridY, z
            );
        }

        const gridGeometry = new THREE.BufferGeometry();
        gridGeometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(gridVertices, 3)
        );

        const groundGrid = new THREE.LineSegments(
            gridGeometry,
            new THREE.LineBasicMaterial({
                color: 0x939e88,
                transparent: true,
                opacity: 0.65
            })
        );

        scene.add(groundGrid);

        // Ground grid on/off control.
        const groundSheetToggle = document.getElementById(
            "survey-map-toggle-ground-sheet"
        );

        groundSheetToggle?.addEventListener("click", () => {
            groundGrid.visible = !groundGrid.visible;

            const isVisible = groundGrid.visible;

            groundSheetToggle.setAttribute("aria-pressed", String(isVisible));
            groundSheetToggle.innerHTML = isVisible
                ? '<i class="bi bi-grid-3x3"></i> Ground Grid: On'
                : '<i class="bi bi-grid-3x3"></i> Ground Grid: Off';
        });

        /* 5. TRANSPARENT DATUM SHEET

        Default datum RL: median of the actual surveyed elevations.  */
        const sortedElevations = [...elevations].sort((a, b) => a - b);
        const middleIndex = Math.floor(sortedElevations.length / 2);

        const datumRL = sortedElevations.length % 2 === 0
            ? (sortedElevations[middleIndex - 1] +
                sortedElevations[middleIndex]) / 2
            : sortedElevations[middleIndex];

        // Use the same world-coordinate transformation as survey terrain.
        const datumY = (datumRL - baseRL) * verticalExaggeration;

        const datumGeometry = new THREE.PlaneGeometry(
            gridWidth,
            gridLength
        );

        // Rotate the plane horizontally into the X-Z ground plane.
        datumGeometry.rotateX(-Math.PI / 2);

        const datumMaterial = new THREE.MeshBasicMaterial({
            color: 0xA98262,
            transparent: true,
            opacity: 0.22,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        const datumSheet = new THREE.Mesh(
            datumGeometry,
            datumMaterial
        );

        datumSheet.position.set(0, datumY, 0);
        datumSheet.renderOrder = 0;
        scene.add(datumSheet);

        // Independent datum visibility control.
        const datumToggle = document.getElementById(
            "survey-map-toggle-datum"
        );

        datumToggle?.addEventListener("click", () => {
            datumSheet.visible = !datumSheet.visible;

            const isVisible = datumSheet.visible;

            datumToggle.setAttribute(
                "aria-pressed",
                String(isVisible)
            );

            datumToggle.innerHTML = isVisible
                ? '<i class="bi bi-layers"></i> Datum Sheet: On'
                : '<i class="bi bi-layers"></i> Datum Sheet: Off';
        });

        console.info("[Survey Terrain] Datum sheet created:", {
            datumRL: Number(datumRL.toFixed(3)),
            datumWorldY: Number(datumY.toFixed(3)),
            widthM: Number(gridWidth.toFixed(2)),
            lengthM: Number(gridLength.toFixed(2))
        });

        const DATUM_ELEVATION_TOLERANCE_M = 0.10;

        // Survey points: observed survey locations and elevations.
        const surveyGeometry = new THREE.BufferGeometry(); // Stores Geometric data
        const surveyPositions = [];

        validSurvey.forEach(p => {
            const v = toWorld(p.Easting, p.Northing, p.RL);
            surveyPositions.push(v.x, v.y, v.z);
        });

        surveyGeometry.setAttribute(  // Tells that data consists of 3 points
            "position",
            new THREE.Float32BufferAttribute(surveyPositions, 3)
        );

        const surveyMaterial = new THREE.PointsMaterial({ // Look of survey points
            color: 0x2f81f7,
            size: 6,
            sizeAttenuation: true
        });

        // Terrain surface generated from actual surveyed Easting, Northing and RL.

        if (window.Delaunator && validSurvey.length >= 3) {
            const terrainPoints = validSurvey.map(p => ({
                easting: Number(p.Easting),
                northing: Number(p.Northing),
                rl: Number(p.RL),
                pointNo: p.PointNo ?? p.pointNo ?? null,
                code: p.Code ?? p.CodeType ?? p.code ?? null
            }));

            const triangulation = window.Delaunator.from(
                terrainPoints,
                p => (p.easting - centerE) * terrainScale,
                p => (p.northing - centerN) * terrainScale
            );

            window.__terrainGapPointSamples = [23, 3566, 3568].map(index => ({
                index,
                point: terrainPoints[index]
                    ? {
                        pointNo: terrainPoints[index].pointNo,
                        northing: terrainPoints[index].northing,
                        easting: terrainPoints[index].easting,
                        rl: terrainPoints[index].rl
                    }
                    : null
            }));

            console.table(window.__terrainGapPointSamples);

            // Estimate local survey spacing from Delaunay edges. The nearest
            // neighbour of a point is connected by a Delaunay edge, so this
            // avoids an all-pairs O(n^2) scan for large survey datasets.
            const localSpacingM = new Array(terrainPoints.length).fill(Infinity);
            const delaunayTriangles = triangulation.triangles;

            for (let i = 0; i < delaunayTriangles.length; i += 3) {
                const a = delaunayTriangles[i];
                const b = delaunayTriangles[i + 1];
                const c = delaunayTriangles[i + 2];

                for (const [u, v] of [[a, b], [b, c], [c, a]]) {
                    const pu = terrainPoints[u];
                    const pv = terrainPoints[v];
                    const distance = Math.hypot(
                        pu.easting - pv.easting,
                        pu.northing - pv.northing
                    );

                    if (distance > 0) {
                        localSpacingM[u] = Math.min(localSpacingM[u], distance);
                        localSpacingM[v] = Math.min(localSpacingM[v], distance);
                    }
                }
            }

            const sortedLocalSpacingM = localSpacingM
                .filter(Number.isFinite)
                .sort((a, b) => a - b);

            const spacingPercentile = (p) => sortedLocalSpacingM.length
                ? sortedLocalSpacingM[Math.min(
                    sortedLocalSpacingM.length - 1,
                    Math.floor((sortedLocalSpacingM.length - 1) * p)
                )]
                : Infinity;

            const localSpacingP95M = spacingPercentile(0.95);

            const terrainGeometry = new THREE.BufferGeometry();
            const terrainPositions = [];
            const terrainColors = [];

            const naturalColor = new THREE.Color(0x90EE90); // Light green terrain
            const fallColor = new THREE.Color(0xA98262);    // Light earthy brown slopes

            // Classify triangles by slope, but only render triangles
            // whose horizontal circumradius is within the supported scale.
            const triangles = triangulation.triangles;
            const FALL_SLOPE_THRESHOLD = 30; // degrees

            // Survey dataset: approximately 3 x the measured 95th-percentile
            // nearest-neighbour spacing (5.154 m).
            const MAX_TERRAIN_CIRCUMRADIUS_M = 15.5;
            const MIN_TWICE_AREA_M2 = 0.001;

            // Safety gate: keep false until the candidate region report has been
            // reviewed against this survey. No inferred facet is enabled by default.
            const ENABLE_SELECTIVE_GAP_RECONSTRUCTION = false;
            const MAX_RECONSTRUCTION_EDGE_TO_LOCAL_SPACING = 3.0;
            const MAX_RECONSTRUCTION_EDGE_TO_P95_SPACING = 4.0;
            const MAX_RECONSTRUCTION_REGION_SPAN_M = 30.0;

            let acceptedTriangles = 0;
            let rejectedTriangles = 0;
            let rejectedLargeCircumradius = 0;
            let rejectedDegenerate = 0;
            // Keep the accepted triangle indices so we can draw a separate
            // coverage-edge guide without creating or extrapolating terrain.
            const acceptedTriangleIndices = [];

            const rejectedTriangleIndices = [];
            const SHOW_REJECTED_TRIANGLES = true;

            // Full diagnostic collection. Does not affect terrain filtering.
            const rejectedTriangleDiagnostics = [];

            function horizontalCircumradius(a, b, c) {
                const ab = Math.hypot(
                    b.easting - a.easting,
                    b.northing - a.northing
                );
                const bc = Math.hypot(
                    c.easting - b.easting,
                    c.northing - b.northing
                );
                const ca = Math.hypot(
                    a.easting - c.easting,
                    a.northing - c.northing
                );

                // Twice the horizontal triangle area.
                const twiceArea = Math.abs(
                    (b.easting - a.easting) * (c.northing - a.northing) -
                    (b.northing - a.northing) * (c.easting - a.easting)
                );

                // Degenerate or nearly collinear triangles do not define
                // a reliable terrain facet.
                if (twiceArea < MIN_TWICE_AREA_M2) {
                    return Infinity;
                }

                // R = abc / (4A) = abc / (2 * twiceArea).
                return (ab * bc * ca) / (2 * twiceArea);
            }

            // Precompute the full Delaunay adjacency once. This enables a
            // generalized, conservative facet-level exception without hard-coded
            // triangle indices or changing the global circumradius threshold.
            const triangleEvidence = [];
            const terrainEdgeToTriangleIds = new Map();
            const terrainEdgeKey = (u, v) => u < v ? `${u},${v}` : `${v},${u}`;

            for (let i = 0; i < triangles.length; i += 3) {
                const triangleId = i / 3;
                const indices = [triangles[i], triangles[i + 1], triangles[i + 2]];
                const [ia, ib, ic] = indices;
                const [a, b, c] = [terrainPoints[ia], terrainPoints[ib], terrainPoints[ic]];
                const sides = [
                    Math.hypot(a.easting - b.easting, a.northing - b.northing),
                    Math.hypot(b.easting - c.easting, b.northing - c.northing),
                    Math.hypot(c.easting - a.easting, c.northing - a.northing)
                ];
                const twiceArea = Math.abs(
                    (b.easting - a.easting) * (c.northing - a.northing) -
                    (b.northing - a.northing) * (c.easting - a.easting)
                );
                const angleFromSides = (opposite, side1, side2) => {
                    if (side1 <= 0 || side2 <= 0) return 0;
                    const cosine = THREE.MathUtils.clamp(
                        (side1 * side1 + side2 * side2 - opposite * opposite) /
                        (2 * side1 * side2), -1, 1
                    );
                    return THREE.MathUtils.radToDeg(Math.acos(cosine));
                };
                const angles = [
                    angleFromSides(sides[1], sides[0], sides[2]),
                    angleFromSides(sides[2], sides[0], sides[1]),
                    angleFromSides(sides[0], sides[1], sides[2])
                ];
                const vertexSpacings = indices.map(index => localSpacingM[index]);
                const finiteSpacings = vertexSpacings.filter(Number.isFinite).sort((x, y) => x - y);
                const medianVertexSpacingM = finiteSpacings.length
                    ? finiteSpacings[Math.floor((finiteSpacings.length - 1) / 2)]
                    : Infinity;
                const rlValues = [a.rl, b.rl, c.rl];
                const rlRangeM = Math.max(...rlValues) - Math.min(...rlValues);
                const circumradiusM = horizontalCircumradius(a, b, c);
                const edges = [[ia, ib], [ib, ic], [ic, ia]].map(
                    ([u, v]) => terrainEdgeKey(u, v)
                );

                const evidence = {
                    triangleId, indices, edges, sides,
                    circumradiusM,
                    maxEdgeM: Math.max(...sides),
                    minAngleDegrees: Math.min(...angles),
                    rlRangeM,
                    medianVertexSpacingM,
                    baselineAccepted: Number.isFinite(circumradiusM) &&
                        circumradiusM <= MAX_TERRAIN_CIRCUMRADIUS_M,
                    acceptedNeighbours: 0,
                    hullEdgeCount: 0
                };
                triangleEvidence.push(evidence);

                for (const edgeKey of edges) {
                    if (!terrainEdgeToTriangleIds.has(edgeKey)) {
                        terrainEdgeToTriangleIds.set(edgeKey, []);
                    }
                    terrainEdgeToTriangleIds.get(edgeKey).push(triangleId);
                }
            }

            for (const evidence of triangleEvidence) {
                for (const edgeKey of evidence.edges) {
                    const adjacent = terrainEdgeToTriangleIds.get(edgeKey) || [];
                    if (adjacent.length === 1) evidence.hullEdgeCount++;
                    for (const adjacentId of adjacent) {
                        if (adjacentId !== evidence.triangleId &&
                            triangleEvidence[adjacentId]?.baselineAccepted) {
                            evidence.acceptedNeighbours++;
                        }
                    }
                }
                // acceptedNeighbours counts shared edges; this is the intended
                // support measure, not merely shared vertices.
            }

            // Diagnostic only: identify unusually long-edge triangles
            // and group them by shared Delaunay edges.
            // This does not change terrain acceptance.

            const longestEdgesM = triangleEvidence
                .map(evidence => evidence.maxEdgeM)
                .filter(Number.isFinite)
                .sort((a, b) => a - b);

            const medianOf = values => {
                if (!values.length) return Infinity;

                const middle = Math.floor(values.length / 2);

                return values.length % 2
                    ? values[middle]
                    : (values[middle - 1] + values[middle]) / 2;
            };

            const medianLongestEdgeM = medianOf(longestEdgesM);

            // Experimental screening threshold only.
            const diagnosticEdgeMultiplier = 2.5;
            const diagnosticLongEdgeLimitM =
                medianLongestEdgeM * diagnosticEdgeMultiplier;

            const longEdgeTriangleIds = new Set();

            for (const evidence of triangleEvidence) {
                if (Number.isFinite(diagnosticLongEdgeLimitM) &&
                    evidence.maxEdgeM > diagnosticLongEdgeLimitM) {
                    longEdgeTriangleIds.add(evidence.triangleId);
                }
            }

            // Group flagged triangles connected by shared edges.
            const visitedLongEdgeTriangles = new Set();
            const longEdgeComponents = [];

            for (const seed of longEdgeTriangleIds) {
                if (visitedLongEdgeTriangles.has(seed)) continue;

                const stack = [seed];
                const componentTriangleIds = [];

                visitedLongEdgeTriangles.add(seed);

                while (stack.length) {
                    const currentId = stack.pop();
                    componentTriangleIds.push(currentId);

                    const evidence = triangleEvidence[currentId];

                    for (const edgeKey of evidence.edges) {
                        const adjacentIds =
                            terrainEdgeToTriangleIds.get(edgeKey) || [];

                        for (const adjacentId of adjacentIds) {
                            if (!longEdgeTriangleIds.has(adjacentId) ||
                                visitedLongEdgeTriangles.has(adjacentId)) {
                                continue;
                            }

                            visitedLongEdgeTriangles.add(adjacentId);
                            stack.push(adjacentId);
                        }
                    }
                }

                const componentTriangles = componentTriangleIds.map(
                    id => triangleEvidence[id]
                );

                longEdgeComponents.push({
                    triangleCount: componentTriangleIds.length,
                    triangleIds: componentTriangleIds,
                    hullTriangleCount: componentTriangles.filter(
                        t => t.hullEdgeCount > 0
                    ).length,
                    interiorTriangleCount: componentTriangles.filter(
                        t => t.hullEdgeCount === 0
                    ).length,
                    maximumEdgeM: Math.max(
                        ...componentTriangles.map(t => t.maxEdgeM)
                    )
                });
            }

            const terrainEdgeGapDiagnostic = {
                triangleCount: triangleEvidence.length,
                medianLongestEdgeM: Number.isFinite(medianLongestEdgeM)
                    ? Number(medianLongestEdgeM.toFixed(3))
                    : null,
                diagnosticEdgeMultiplier,
                diagnosticLongEdgeLimitM:
                    Number.isFinite(diagnosticLongEdgeLimitM)
                        ? Number(diagnosticLongEdgeLimitM.toFixed(3))
                        : null,
                flaggedTriangleCount: longEdgeTriangleIds.size,
                connectedComponentCount: longEdgeComponents.length,
                components: longEdgeComponents.sort(
                    (a, b) => b.triangleCount - a.triangleCount
                )
            };

            window.__terrainEdgeGapDiagnostic =
                terrainEdgeGapDiagnostic;
            window.__terrainTriangleEvidence = triangleEvidence;

            console.info(
                "[Survey Terrain] Long-edge gap diagnostic:",
                terrainEdgeGapDiagnostic
            );

            const reconstructionRule = {
                enabled: ENABLE_SELECTIVE_GAP_RECONSTRUCTION,
                maxCircumradiusM: 16.0,
                maxEdgeM: 20.0,
                minimumAngleDegrees: 15.0,
                maxRlRangeM: 1.0,
                minimumAcceptedNeighbours: 2,
                maxEdgeToMedianVertexSpacing: MAX_RECONSTRUCTION_EDGE_TO_LOCAL_SPACING,
                maxEdgeToGlobalP95Spacing: MAX_RECONSTRUCTION_EDGE_TO_P95_SPACING,
                rejectConvexHullFacets: true
            };

            const selectiveReconstructionDecision = (evidence) => {
                if (!ENABLE_SELECTIVE_GAP_RECONSTRUCTION) return false;
                if (!Number.isFinite(evidence.circumradiusM) ||
                    evidence.circumradiusM > reconstructionRule.maxCircumradiusM) return false;
                if (evidence.maxEdgeM > reconstructionRule.maxEdgeM) return false;
                if (evidence.minAngleDegrees < reconstructionRule.minimumAngleDegrees) return false;
                if (evidence.rlRangeM > reconstructionRule.maxRlRangeM) return false;
                if (evidence.acceptedNeighbours < reconstructionRule.minimumAcceptedNeighbours) return false;
                if (reconstructionRule.rejectConvexHullFacets && evidence.hullEdgeCount > 0) return false;
                if (!Number.isFinite(evidence.medianVertexSpacingM) ||
                    evidence.maxEdgeM > reconstructionRule.maxEdgeToMedianVertexSpacing *
                    evidence.medianVertexSpacingM) return false;
                if (Number.isFinite(localSpacingP95M) &&
                    evidence.maxEdgeM > reconstructionRule.maxEdgeToGlobalP95Spacing *
                    localSpacingP95M) return false;
                return !evidence.baselineAccepted;
            };

            let selectivelyRestoredTriangles = 0;
            const selectivelyRestoredFacetReport = [];

            for (let i = 0; i < triangles.length; i += 3) {
                const ia = triangles[i];
                const ib = triangles[i + 1];
                const ic = triangles[i + 2];

                const a = terrainPoints[ia];
                const b = terrainPoints[ib];
                const c = terrainPoints[ic];

                const circumradius = horizontalCircumradius(a, b, c);

                // Do not create terrain facets across unsupported gaps
                // or from nearly collinear points.
                if (!Number.isFinite(circumradius)) {
                    rejectedTriangles++;
                    rejectedDegenerate++;
                    continue;
                }

                const facetEvidence = triangleEvidence[i / 3];
                const selectivelyRestoreFacet =
                    circumradius > MAX_TERRAIN_CIRCUMRADIUS_M &&
                    selectiveReconstructionDecision(facetEvidence);

                if (circumradius > MAX_TERRAIN_CIRCUMRADIUS_M &&
                    !selectivelyRestoreFacet) {
                    rejectedTriangles++;
                    rejectedLargeCircumradius++;

                    const edgeAB = Math.hypot(
                        a.easting - b.easting,
                        a.northing - b.northing
                    );

                    const edgeBC = Math.hypot(
                        b.easting - c.easting,
                        b.northing - c.northing
                    );

                    const edgeCA = Math.hypot(
                        c.easting - a.easting,
                        c.northing - a.northing
                    );

                    const twiceArea = Math.abs(
                        (b.easting - a.easting) * (c.northing - a.northing) -
                        (b.northing - a.northing) * (c.easting - a.easting)
                    );

                    const sideLengths = [edgeAB, edgeBC, edgeCA];
                    const angleFromSides = (opposite, side1, side2) => {
                        if (side1 <= 0 || side2 <= 0) return 0;
                        const cosine = THREE.MathUtils.clamp(
                            (side1 * side1 + side2 * side2 - opposite * opposite) /
                            (2 * side1 * side2),
                            -1,
                            1
                        );
                        return THREE.MathUtils.radToDeg(Math.acos(cosine));
                    };
                    const angles = [
                        angleFromSides(edgeBC, edgeAB, edgeCA),
                        angleFromSides(edgeCA, edgeAB, edgeBC),
                        angleFromSides(edgeAB, edgeBC, edgeCA)
                    ];
                    const vertexLocalSpacingM = [ia, ib, ic].map(index =>
                        Number.isFinite(localSpacingM[index])
                            ? Number(localSpacingM[index].toFixed(3))
                            : null
                    );
                    const vertexRlValues = [a.rl, b.rl, c.rl];
                    const rlRangeM = Math.max(...vertexRlValues) - Math.min(...vertexRlValues);
                    const minimumAngleDegrees = Math.min(...angles);
                    const maxEdgeM = Math.max(...sideLengths);
                    let supportClass = "review_with_feature_context";
                    if (minimumAngleDegrees < 10) {
                        supportClass = "sliver_or_near_collinear";
                    } else if (maxEdgeM > 30) {
                        supportClass = "long_span_unsupported_pending_evidence";
                    } else if (maxEdgeM > 20 || rlRangeM > 1) {
                        supportClass = "uncertain_local_support";
                    }

                    rejectedTriangleDiagnostics.push({
                        triangleId: i / 3,
                        indices: [ia, ib, ic],
                        circumradiusM: Number(circumradius.toFixed(3)),
                        edgeAB_M: Number(edgeAB.toFixed(3)),
                        edgeBC_M: Number(edgeBC.toFixed(3)),
                        edgeCA_M: Number(edgeCA.toFixed(3)),
                        maxEdgeM: Number(maxEdgeM.toFixed(3)),
                        minAngleDegrees: Number(minimumAngleDegrees.toFixed(3)),
                        horizontalAreaM2: Number((twiceArea / 2).toFixed(3)),
                        rlRangeM: Number(rlRangeM.toFixed(3)),
                        vertexLocalSpacingM,
                        supportClass,
                        vertices: [a, b, c].map(p => ({
                            pointNo: p.pointNo,
                            code: p.code,
                            easting: p.easting,
                            northing: p.northing,
                            rl: p.rl
                        }))
                    });

                    if (SHOW_REJECTED_TRIANGLES) {
                        rejectedTriangleIndices.push(ia, ib, ic);
                    }

                    continue;
                }

                if (selectivelyRestoreFacet) {
                    selectivelyRestoredTriangles++;
                    selectivelyRestoredFacetReport.push({
                        triangleId: facetEvidence.triangleId,
                        indices: facetEvidence.indices,
                        circumradiusM: Number(facetEvidence.circumradiusM.toFixed(3)),
                        maxEdgeM: Number(facetEvidence.maxEdgeM.toFixed(3)),
                        minAngleDegrees: Number(facetEvidence.minAngleDegrees.toFixed(3)),
                        rlRangeM: Number(facetEvidence.rlRangeM.toFixed(3)),
                        medianVertexSpacingM: Number(facetEvidence.medianVertexSpacingM.toFixed(3)),
                        acceptedNeighbours: facetEvidence.acceptedNeighbours,
                        hullEdgeCount: facetEvidence.hullEdgeCount,
                        vertices: [a, b, c].map(point => ({
                            pointNo: point.pointNo,
                            code: point.code,
                            easting: point.easting,
                            northing: point.northing,
                            rl: point.rl
                        }))
                    });
                }

                const va = toWorld(a.easting, a.northing, a.rl);
                const vb = toWorld(b.easting, b.northing, b.rl);
                const vc = toWorld(c.easting, c.northing, c.rl);

                const ab = new THREE.Vector3(
                    vb.x - va.x,
                    vb.y - va.y,
                    vb.z - va.z
                );

                const ac = new THREE.Vector3(
                    vc.x - va.x,
                    vc.y - va.y,
                    vc.z - va.z
                );

                const normal = new THREE.Vector3()
                    .crossVectors(ab, ac)
                    .normalize();

                const slopeDegrees = THREE.MathUtils.radToDeg(
                    Math.acos(
                        THREE.MathUtils.clamp(
                            Math.abs(normal.y),
                            0,
                            1
                        )
                    )
                );

                const triangleColor =
                    slopeDegrees >= FALL_SLOPE_THRESHOLD
                        ? fallColor
                        : naturalColor;

                // Duplicate vertices so each triangle has its own colour.
                for (const point of [va, vb, vc]) {
                    terrainPositions.push(point.x, point.y, point.z);
                    terrainColors.push(
                        triangleColor.r,
                        triangleColor.g,
                        triangleColor.b
                    );
                }

                acceptedTriangleIndices.push(ia, ib, ic);
                acceptedTriangles++;
            }

            // Read-only diagnostic: classify rejected triangle edges
            // against the accepted mesh boundary and interior.
            const diagnosticAcceptedEdgeCounts = new Map();

            function makeEdgeKey(a, b) {
                return a < b ? `${a},${b}` : `${b},${a}`;
            }

            const coverageEdgeCounts = new Map();

            for (let i = 0; i < acceptedTriangleIndices.length; i += 3) {
                const a = acceptedTriangleIndices[i];
                const b = acceptedTriangleIndices[i + 1];
                const c = acceptedTriangleIndices[i + 2];

                for (const [u, v] of [[a, b], [b, c], [c, a]]) {
                    const key = makeEdgeKey(u, v);
                    diagnosticAcceptedEdgeCounts.set(
                        key,
                        (diagnosticAcceptedEdgeCounts.get(key) || 0) + 1
                    );
                }
            }
            window.__acceptedEdgeCounts = Object.fromEntries(
                diagnosticAcceptedEdgeCounts
            );

            // Read-only diagnostic: map accepted terrain boundary edges
            // to rejected triangles sharing those exact edges.
            const rejectedTrianglesByAcceptedBoundaryEdge = new Map();

            for (let triangleIndex = 0;
                triangleIndex < rejectedTriangleDiagnostics.length;
                triangleIndex++) {
                const triangle = rejectedTriangleDiagnostics[triangleIndex];
                const [a, b, c] = triangle.indices;

                for (const [u, v] of [[a, b], [b, c], [c, a]]) {
                    const edgeKey = makeEdgeKey(u, v);

                    // Only consider edges on the accepted terrain boundary.
                    if (diagnosticAcceptedEdgeCounts.get(edgeKey) !== 1) {
                        continue;
                    }

                    if (!rejectedTrianglesByAcceptedBoundaryEdge.has(edgeKey)) {
                        rejectedTrianglesByAcceptedBoundaryEdge.set(edgeKey, []);
                    }

                    rejectedTrianglesByAcceptedBoundaryEdge
                        .get(edgeKey)
                        .push({
                            triangleIndex,
                            triangleId: triangle.triangleId ?? triangleIndex,
                            indices: triangle.indices,
                            circumradiusM: triangle.circumradiusM ?? null,
                            supportClass: triangle.supportClass ?? null
                        });
                }
            }

            const acceptedBoundaryRejectedAdjacency = [];

            for (const [edgeKey, acceptedCount] of diagnosticAcceptedEdgeCounts) {
                if (acceptedCount !== 1) continue;

                const adjacentRejected =
                    rejectedTrianglesByAcceptedBoundaryEdge.get(edgeKey) ?? [];

                acceptedBoundaryRejectedAdjacency.push({
                    edge: edgeKey,
                    acceptedTriangleCount: 1,
                    rejectedTriangleCount: adjacentRejected.length,
                    rejectedTriangles: adjacentRejected
                });
            }

            window.__acceptedBoundaryRejectedAdjacency =
                acceptedBoundaryRejectedAdjacency;

            console.info(
                "[Survey Terrain] Accepted-boundary / rejected-triangle adjacency:",
                {
                    acceptedBoundaryEdgeCount:
                        acceptedBoundaryRejectedAdjacency.length,

                    boundaryEdgesWithRejectedTriangle:
                        acceptedBoundaryRejectedAdjacency.filter(
                            edge => edge.rejectedTriangleCount > 0
                        ).length,

                    boundaryEdgesWithoutRejectedTriangle:
                        acceptedBoundaryRejectedAdjacency.filter(
                            edge => edge.rejectedTriangleCount === 0
                        ).length,

                    sample: acceptedBoundaryRejectedAdjacency
                        .filter(edge => edge.rejectedTriangleCount > 0)
                        .slice(0, 20)
                }
            );

            // Generalized rejected-region analysis.
            // Groups rejected triangles by shared edges and classifies each connected
            // region using its boundary relationship to the accepted terrain mesh.
            // This is intentionally diagnostic-only: it does not invent terrain.
            const rejectedTriangleByEdge = new Map();

            rejectedTriangleDiagnostics.forEach((triangle, triangleIndex) => {
                const [a, b, c] = triangle.indices;
                const edges = [
                    makeEdgeKey(a, b),
                    makeEdgeKey(b, c),
                    makeEdgeKey(c, a)
                ];

                for (const edgeKey of edges) {
                    if (!rejectedTriangleByEdge.has(edgeKey)) {
                        rejectedTriangleByEdge.set(edgeKey, []);
                    }
                    rejectedTriangleByEdge.get(edgeKey).push(triangleIndex);
                }
            });

            const rejectedNeighbours = rejectedTriangleDiagnostics.map(() => new Set());

            for (const adjacentTriangles of rejectedTriangleByEdge.values()) {
                for (let i = 0; i < adjacentTriangles.length; i++) {
                    for (let j = i + 1; j < adjacentTriangles.length; j++) {
                        rejectedNeighbours[adjacentTriangles[i]].add(adjacentTriangles[j]);
                        rejectedNeighbours[adjacentTriangles[j]].add(adjacentTriangles[i]);
                    }
                }
            }

            const visitedRejectedTriangles = new Set();
            const rejectedRegions = [];

            for (let seed = 0; seed < rejectedTriangleDiagnostics.length; seed++) {
                if (visitedRejectedTriangles.has(seed)) continue;

                const stack = [seed];
                const regionTriangleIds = [];
                visitedRejectedTriangles.add(seed);

                while (stack.length) {
                    const current = stack.pop();
                    regionTriangleIds.push(current);

                    for (const neighbour of rejectedNeighbours[current]) {
                        if (visitedRejectedTriangles.has(neighbour)) continue;
                        visitedRejectedTriangles.add(neighbour);
                        stack.push(neighbour);
                    }
                }

                const regionEdgeCounts = new Map();
                const regionVertexSet = new Set();
                let areaM2 = 0;
                let maxTriangleEdgeM = 0;
                let minE = Infinity;
                let maxE = -Infinity;
                let minN = Infinity;
                let maxN = -Infinity;
                let minRL = Infinity;
                let maxRL = -Infinity;
                let maximumLocalSpacingRatio = 0;
                let allEdgesLocallySupported = true;

                for (const triangleId of regionTriangleIds) {
                    const triangle = rejectedTriangleDiagnostics[triangleId];
                    const [a, b, c] = triangle.indices;
                    areaM2 += triangle.horizontalAreaM2;
                    maxTriangleEdgeM = Math.max(maxTriangleEdgeM, triangle.maxEdgeM);

                    for (const vertexIndex of triangle.indices) {
                        regionVertexSet.add(vertexIndex);
                        const point = terrainPoints[vertexIndex];
                        minE = Math.min(minE, point.easting);
                        maxE = Math.max(maxE, point.easting);
                        minN = Math.min(minN, point.northing);
                        maxN = Math.max(maxN, point.northing);
                        minRL = Math.min(minRL, point.rl);
                        maxRL = Math.max(maxRL, point.rl);
                    }

                    for (const [u, v] of [[a, b], [b, c], [c, a]]) {
                        const edgeKey = makeEdgeKey(u, v);
                        regionEdgeCounts.set(
                            edgeKey,
                            (regionEdgeCounts.get(edgeKey) || 0) + 1
                        );

                        const pu = terrainPoints[u];
                        const pv = terrainPoints[v];
                        const edgeLengthM = Math.hypot(
                            pu.easting - pv.easting,
                            pu.northing - pv.northing
                        );
                        const endpointSupportM = Math.max(
                            localSpacingM[u],
                            localSpacingM[v]
                        );
                        const localRatio = endpointSupportM > 0 &&
                            Number.isFinite(endpointSupportM)
                            ? edgeLengthM / endpointSupportM
                            : Infinity;

                        maximumLocalSpacingRatio = Math.max(
                            maximumLocalSpacingRatio,
                            localRatio
                        );

                        if (
                            !Number.isFinite(localRatio) ||
                            localRatio > MAX_RECONSTRUCTION_EDGE_TO_LOCAL_SPACING ||
                            edgeLengthM > MAX_RECONSTRUCTION_EDGE_TO_P95_SPACING * localSpacingP95M
                        ) {
                            allEdgesLocallySupported = false;
                        }
                    }
                }

                const regionBoundaryEdges = [...regionEdgeCounts.entries()]
                    .filter(([, count]) => count === 1)
                    .map(([key]) => key);

                const boundaryAcceptedCounts = regionBoundaryEdges.map(
                    edgeKey => diagnosticAcceptedEdgeCounts.get(edgeKey) || 0
                );

                const boundaryEdgesAllTouchAcceptedMesh =
                    regionBoundaryEdges.length > 0 &&
                    boundaryAcceptedCounts.every(count => count === 1);

                const hasUnsupportedOuterBoundary =
                    boundaryAcceptedCounts.some(count => count === 0);

                const spanE = maxE - minE;
                const spanN = maxN - minN;
                const spanM = Math.hypot(spanE, spanN);

                let classification;
                let reason;

                if (boundaryEdgesAllTouchAcceptedMesh) {
                    classification = "enclosed_candidate_gap";
                    reason = "Rejected region is enclosed by accepted-mesh boundary edges; survey support must be evaluated before filling.";
                } else if (hasUnsupportedOuterBoundary) {
                    classification = "open_or_outer_rejected_region";
                    reason = "At least one region boundary edge has no accepted neighbouring triangle; this may be an outer coverage boundary or an open gap.";
                } else {
                    classification = "topologically_ambiguous_region";
                    reason = "Boundary adjacency is not sufficient to establish a safely enclosed gap.";
                }

                rejectedRegions.push({
                    regionId: rejectedRegions.length + 1,
                    triangleIndices: regionTriangleIds,
                    classification,
                    reason,
                    triangleCount: regionTriangleIds.length,
                    vertexCount: regionVertexSet.size,
                    boundaryEdgeCount: regionBoundaryEdges.length,
                    acceptedBoundaryEdgeCount:
                        boundaryAcceptedCounts.filter(count => count === 1).length,

                    acceptedBoundaryEdgeRatio: regionBoundaryEdges.length
                        ? Number((
                            boundaryAcceptedCounts.filter(count => count === 1).length /
                            regionBoundaryEdges.length
                        ).toFixed(3))
                        : 0,
                    boundaryEdgesAllTouchAcceptedMesh,
                    areaM2: Number(areaM2.toFixed(3)),
                    spanEastingM: Number(spanE.toFixed(3)),
                    spanNorthingM: Number(spanN.toFixed(3)),
                    diagonalSpanM: Number(spanM.toFixed(3)),
                    maximumTriangleEdgeM: Number(maxTriangleEdgeM.toFixed(3)),
                    elevationRangeM: Number((maxRL - minRL).toFixed(3)),
                    maximumEdgeToLocalSpacingRatio: Number(maximumLocalSpacingRatio.toFixed(3)),
                    allEdgesLocallySupported,
                    bounds: {
                        minEasting: Number(minE.toFixed(3)),
                        maxEasting: Number(maxE.toFixed(3)),
                        minNorthing: Number(minN.toFixed(3)),
                        maxNorthing: Number(maxN.toFixed(3))
                    }
                });
            }

            rejectedRegions.sort((a, b) => b.areaM2 - a.areaM2);
            window.__rejectedTerrainRegions = rejectedRegions;

            const eligibleReconstructionRegionIds = new Set(
                rejectedRegions
                    .filter(region =>
                        region.classification === "enclosed_candidate_gap" &&
                        region.allEdgesLocallySupported &&
                        region.diagonalSpanM <= MAX_RECONSTRUCTION_REGION_SPAN_M
                    )
                    .map(region => region.regionId)
            );

            const reconstructedRejectedTriangleIds = new Set();
            let selectivelyReconstructedTriangles = 0;

            if (ENABLE_SELECTIVE_GAP_RECONSTRUCTION && eligibleReconstructionRegionIds.size) {
                for (const region of rejectedRegions) {
                    if (!eligibleReconstructionRegionIds.has(region.regionId)) continue;

                    // Rebuild region membership by matching its triangle indices
                    // through the connected-component traversal order.
                    // Region membership is retained below during analysis.
                    const regionTriangles = region.triangleIndices || [];
                    for (const triangleId of regionTriangles) {
                        const triangle = rejectedTriangleDiagnostics[triangleId];
                        if (!triangle || reconstructedRejectedTriangleIds.has(triangleId)) continue;

                        const [ia, ib, ic] = triangle.indices;
                        const a = terrainPoints[ia];
                        const b = terrainPoints[ib];
                        const c = terrainPoints[ic];
                        const va = toWorld(a.easting, a.northing, a.rl);
                        const vb = toWorld(b.easting, b.northing, b.rl);
                        const vc = toWorld(c.easting, c.northing, c.rl);
                        const ab = new THREE.Vector3(vb.x - va.x, vb.y - va.y, vb.z - va.z);
                        const ac = new THREE.Vector3(vc.x - va.x, vc.y - va.y, vc.z - va.z);
                        const normal = new THREE.Vector3().crossVectors(ab, ac).normalize();
                        const slopeDegrees = THREE.MathUtils.radToDeg(
                            Math.acos(THREE.MathUtils.clamp(Math.abs(normal.y), 0, 1))
                        );
                        const triangleColor = slopeDegrees >= FALL_SLOPE_THRESHOLD
                            ? fallColor
                            : naturalColor;

                        for (const point of [va, vb, vc]) {
                            terrainPositions.push(point.x, point.y, point.z);
                            terrainColors.push(triangleColor.r, triangleColor.g, triangleColor.b);
                        }

                        acceptedTriangleIndices.push(ia, ib, ic);
                        reconstructedRejectedTriangleIds.add(triangleId);
                        selectivelyReconstructedTriangles++;
                        acceptedTriangles++;
                        rejectedTriangles--;
                        rejectedLargeCircumradius--;
                    }
                }
            }

            window.__terrainReconstructionAssessment = {
                enabled: ENABLE_SELECTIVE_GAP_RECONSTRUCTION,
                localSpacingP95M: Number.isFinite(localSpacingP95M)
                    ? Number(localSpacingP95M.toFixed(3))
                    : null,
                eligibleRegionCount: eligibleReconstructionRegionIds.size,
                selectivelyReconstructedTriangles,
                eligibleRegionIds: [...eligibleReconstructionRegionIds],
                note: "Reconstruction uses measured vertices only. The safety gate is disabled by default pending review of this survey's region report."
            };

            console.info("[Survey Terrain] Connected rejected-region assessment:", {
                regionCount: rejectedRegions.length,
                enclosedCandidateGaps: rejectedRegions.filter(
                    region => region.classification === "enclosed_candidate_gap"
                ).length,
                openOrOuterRegions: rejectedRegions.filter(
                    region => region.classification === "open_or_outer_rejected_region"
                ).length,
                ambiguousRegions: rejectedRegions.filter(
                    region => region.classification === "topologically_ambiguous_region"
                ).length,
                eligibleReconstructionRegions: eligibleReconstructionRegionIds.size,
                selectivelyReconstructedTriangles,
                localSpacingP95M: Number.isFinite(localSpacingP95M)
                    ? Number(localSpacingP95M.toFixed(3))
                    : null,
                largestRegions: rejectedRegions.slice(0, 20),
                note: "No region is reconstructed unless enclosed, locally supported, and within the configured span; feature remains disabled by default."
            });

            const rejectedEdgeAdjacencyReport =
                rejectedTriangleDiagnostics.map(t => {
                    const [a, b, c] = t.indices;

                    const edges = [
                        makeEdgeKey(a, b),
                        makeEdgeKey(b, c),
                        makeEdgeKey(c, a)
                    ];

                    let sharedBoundaryEdges = 0;
                    let sharedInteriorEdges = 0;
                    let sharedUnexpectedEdges = 0;

                    for (const edge of edges) {
                        const count = diagnosticAcceptedEdgeCounts.get(edge) || 0;

                        if (count === 1) sharedBoundaryEdges++;
                        else if (count === 2) sharedInteriorEdges++;
                        else if (count > 2) sharedUnexpectedEdges++;
                    }

                    return {
                        indices: t.indices.join(","),
                        sharedAcceptedEdges:
                            sharedBoundaryEdges +
                            sharedInteriorEdges +
                            sharedUnexpectedEdges,
                        sharedBoundaryEdges,
                        sharedInteriorEdges,
                        sharedUnexpectedEdges,
                        maxEdgeM: t.maxEdgeM,
                        circumradiusM: t.circumradiusM,
                        areaM2: t.horizontalAreaM2
                    };
                });

            window.__rejectedEdgeAdjacencyReport = rejectedEdgeAdjacencyReport;

            const firstRejectedEdgeCheck = rejectedTriangleDiagnostics.length
                ? (() => {
                    const t = rejectedTriangleDiagnostics[0];
                    const [a, b, c] = t.indices;

                    return {
                        triangleIndices: t.indices,
                        edges: [
                            [a, b],
                            [b, c],
                            [c, a]
                        ].map(([u, v]) => {
                            const key = makeEdgeKey(u, v);

                            return {
                                vertices: [u, v],
                                acceptedEdgeCount: diagnosticAcceptedEdgeCounts.get(key) || 0
                            };
                        })
                    };
                })()
                : null;

            console.info(
                "[Survey Terrain] First rejected triangle edge check:",
                firstRejectedEdgeCheck
            );

            console.info(
                "[Survey Terrain] Rejected triangle edge classification:",
                {
                    acceptedUniqueEdges: diagnosticAcceptedEdgeCounts.size,
                    acceptedBoundaryEdges: [...diagnosticAcceptedEdgeCounts.values()]
                        .filter(count => count === 1).length,
                    acceptedInteriorEdges: [...diagnosticAcceptedEdgeCounts.values()]
                        .filter(count => count === 2).length,
                    rejectedTriangleCount:
                        rejectedEdgeAdjacencyReport.length,
                    sharingZeroEdges: rejectedEdgeAdjacencyReport.filter(
                        t => t.sharedAcceptedEdges === 0
                    ).length,
                    sharingBoundaryEdges: rejectedEdgeAdjacencyReport.filter(
                        t => t.sharedBoundaryEdges > 0
                    ).length,
                    sharingInteriorEdges: rejectedEdgeAdjacencyReport.filter(
                        t => t.sharedInteriorEdges > 0
                    ).length,
                    sample: rejectedEdgeAdjacencyReport
                        .filter(t => t.sharedAcceptedEdges > 0)
                        .sort((a, b) =>
                            a.circumradiusM - b.circumradiusM
                        )
                        .slice(0, 30)
                }
            );

            window.__selectivelyRestoredTerrainFacets = selectivelyRestoredFacetReport;
            console.info("[Survey Terrain] Selective reconstruction gate:", {
                enabled: ENABLE_SELECTIVE_GAP_RECONSTRUCTION,
                rule: reconstructionRule,
                restoredFacetCount: selectivelyRestoredTriangles,
                restoredFacets: selectivelyRestoredFacetReport,
                note: "Only non-hull facets passing all geometric/local-support gates are restored. This is a conservative visualization heuristic, not an authoritative surveyed surface."
            });

            console.info("[Survey Terrain] TIN support filtering:", {
                inputTriangles: triangles.length / 3,
                acceptedTriangles,
                rejectedTriangles,
                maximumCircumradiusM: MAX_TERRAIN_CIRCUMRADIUS_M,
                rejectedDegenerate,
                rejectedLargeCircumradius,
                selectivelyRestoredTriangles
            });

            window.__rejectedTriangleDiagnostics = rejectedTriangleDiagnostics;
            window.__rejectedFacetSupportReport = {
                total: rejectedTriangleDiagnostics.length,
                byClass: rejectedTriangleDiagnostics.reduce((counts, triangle) => {
                    counts[triangle.supportClass] = (counts[triangle.supportClass] || 0) + 1;
                    return counts;
                }, {}),
                highestPriorityReview: rejectedTriangleDiagnostics
                    .filter(triangle => triangle.supportClass === "review_with_feature_context")
                    .sort((a, b) => a.circumradiusM - b.circumradiusM)
                    .slice(0, 100),
                note: "Diagnostic triage only; no rejected facet is accepted solely by this classification."
            };

            console.info("[Survey Terrain] Rejected-facet support triage:", {
                count: rejectedTriangleDiagnostics.length,
                byClass: window.__rejectedFacetSupportReport.byClass,
                note: window.__rejectedFacetSupportReport.note
            });

            terrainGeometry.setAttribute(
                "position",
                new THREE.Float32BufferAttribute(terrainPositions, 3)
            );

            terrainGeometry.setAttribute(
                "color",
                new THREE.Float32BufferAttribute(terrainColors, 3)
            );

            terrainGeometry.computeVertexNormals();

            const terrainMaterial = new THREE.MeshBasicMaterial({
                vertexColors: true,
                side: THREE.DoubleSide,
                wireframe: false
            });

            const terrainMesh = new THREE.Mesh(
                terrainGeometry,
                terrainMaterial
            );

            // TERRAIN GAP DIAGNOSTIC — VISUALIZATION ONLY
            // Do not fill rejected triangles or alter the authoritative terrain.

            window.__terrainGapDiagnostic = {
                acceptedTriangleCount: acceptedTriangleIndices.length / 3,
                rejectedTriangleCount: rejectedTriangleDiagnostics.length,
                acceptedTerrainMeshExists: !!terrainMesh,
                acceptedTerrainVertexCount:
                    terrainGeometry.getAttribute("position")?.count ?? 0,
                engineeringUse: false
            };

            console.info(
                "[Survey Terrain] Gap diagnostic:",
                window.__terrainGapDiagnostic
            );

            // AMBER TERRAIN — FULL VISUAL FILL
            // All rejected Delaunay triangles are displayed as provisional terrain.
            // This does not change the authoritative green terrain or calculations.
            // const provisionalTerrainPositions = [];
            // const PROVISIONAL_TERRAIN_COLOR = new THREE.Color(0xD9A441);

            // let provisionalVisualTriangleCount = 0;
            // let skippedInvalid = 0;

            // for (const candidate of rejectedTriangleDiagnostics) {
            //     const [ia, ib, ic] = candidate.indices;

            //     const a = terrainPoints[ia];
            //     const b = terrainPoints[ib];
            //     const c = terrainPoints[ic];

            //     if (!a || !b || !c) {
            //         skippedInvalid++;
            //         continue;
            //     }

            //     const va = toWorld(a.easting, a.northing, a.rl);
            //     const vb = toWorld(b.easting, b.northing, b.rl);
            //     const vc = toWorld(c.easting, c.northing, c.rl);

            //     for (const point of [va, vb, vc]) {
            //         provisionalTerrainPositions.push(
            //             point.x, point.y, point.z
            //         );
            //     }

            //     provisionalVisualTriangleCount++;
            // }

            // let provisionalTerrainMesh = null;

            // if (provisionalTerrainPositions.length > 0) {
            //     const provisionalGeometry = new THREE.BufferGeometry();

            //     provisionalGeometry.setAttribute(
            //         "position",
            //         new THREE.Float32BufferAttribute(
            //             provisionalTerrainPositions, 3
            //         )
            //     );

            //     provisionalGeometry.computeVertexNormals();

            //     const provisionalMaterial = new THREE.MeshBasicMaterial({
            //         color: 0xD9D2B8,       pale sand colour
            //         side: THREE.DoubleSide,
            //         transparent: true,
            //         opacity: 0.25,         Keeps underlying details visible
            //         depthWrite: false,
            //         polygonOffset: true,
            //         polygonOffsetFactor: -1,
            //         polygonOffsetUnits: -1
            //     });

            //     provisionalTerrainMesh = new THREE.Mesh(
            //         provisionalGeometry,
            //         provisionalMaterial
            //     );

            //     provisionalTerrainMesh.name = "provisional-visual-terrain";
            //     provisionalTerrainMesh.renderOrder = 1;
            // }

            // window.__provisionalVisualTerrain = {
            //     triangleCount: provisionalVisualTriangleCount,
            //     vertexCount: provisionalTerrainPositions.length / 3,
            //     skippedInvalid,
            //     meshCreated: !!provisionalTerrainMesh,
            //     meshVisible: provisionalTerrainMesh?.visible ?? false,
            //     engineeringUse: false,
            //     note: "All rejected Delaunay facets are rendered as provisional amber visual terrain only."
            // };

            // console.info(
            //     "[Survey Terrain] Full amber visual fill:",
            //     window.__provisionalVisualTerrain
            // );

            // CYAN TERRAIN OVERLAY — VISUAL ONLY
            // Shows rejected Delaunay facets as a separate cyan surface.
            // Uses measured survey vertices only; not authoritative terrain.
            const cyanTerrainPositions = [];

            for (const candidate of rejectedTriangleDiagnostics) {
                if (reconstructedRejectedTriangleIds.has(candidate.triangleId)) {
                    continue;
                }

                const [ia, ib, ic] = candidate.indices;
                const a = terrainPoints[ia];
                const b = terrainPoints[ib];
                const c = terrainPoints[ic];

                if (!a || !b || !c) continue;

                for (const point of [a, b, c]) {
                    const worldPoint = toWorld(
                        point.easting,
                        point.northing,
                        point.rl
                    );

                    cyanTerrainPositions.push(
                        worldPoint.x,
                        worldPoint.y,
                        worldPoint.z
                    );
                }
            }

            let cyanTerrainMesh = null;

            if (cyanTerrainPositions.length > 0) {
                const cyanTerrainGeometry = new THREE.BufferGeometry();

                cyanTerrainGeometry.setAttribute(
                    "position",
                    new THREE.Float32BufferAttribute(
                        cyanTerrainPositions,
                        3
                    )
                );

                cyanTerrainGeometry.computeVertexNormals();

                const cyanTerrainMaterial = new THREE.MeshBasicMaterial({
                    color: 0x00ffff,
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.22,
                    depthWrite: false,
                    polygonOffset: true,
                    polygonOffsetFactor: -2,
                    polygonOffsetUnits: -2
                });

                cyanTerrainMesh = new THREE.Mesh(
                    cyanTerrainGeometry,
                    cyanTerrainMaterial
                );

                cyanTerrainMesh.name = "cyan-visual-terrain-overlay";
                cyanTerrainMesh.renderOrder = 2;
                cyanTerrainMesh.visible = false;
            }

            window.__cyanVisualTerrain = {
                triangleCount: cyanTerrainPositions.length / 9,
                meshCreated: !!cyanTerrainMesh,
                meshVisible: cyanTerrainMesh?.visible ?? false,
                engineeringUse: false,
                note: "Rejected facets shown using measured vertices for visual diagnosis only."
            };

            // Visualization-only coverage guide. Boundary edges are derived from
            // accepted triangles only; this does not add terrain or elevations.
            // The largest closed boundary loop is highlighted as the primary
            // perimeter for viewing. Other loops remain visible as secondary
            // coverage edges (typically internal holes or disconnected patches).
            // This is a visual classification only, not an engineering boundary.

            for (let i = 0; i < acceptedTriangleIndices.length; i += 3) {
                const triangle = [
                    acceptedTriangleIndices[i],
                    acceptedTriangleIndices[i + 1],
                    acceptedTriangleIndices[i + 2]
                ];

                for (const [u, v] of [
                    [triangle[0], triangle[1]],
                    [triangle[1], triangle[2]],
                    [triangle[2], triangle[0]]
                ]) {
                    const key = u < v ? `${u}:${v}` : `${v}:${u}`;
                    const edge = coverageEdgeCounts.get(key);

                    if (edge) {
                        edge.count++;
                    } else {
                        coverageEdgeCounts.set(key, {
                            a: u,
                            b: v,
                            count: 1
                        });
                    }
                }
            }

            const boundaryEdges = [...coverageEdgeCounts.values()]
                .filter(edge => edge.count === 1);
            const boundaryAdjacency = new Map();
            for (let i = 0; i < boundaryEdges.length; i++) {
                const edge = boundaryEdges[i];
                edge.boundaryId = i;
                for (const [from, to] of [[edge.a, edge.b], [edge.b, edge.a]]) {
                    if (!boundaryAdjacency.has(from)) boundaryAdjacency.set(from, []);
                    boundaryAdjacency.get(from).push({ edgeId: i, to });
                }
            }

            // Discover complete connected boundary components before deciding
            // whether each component is a simple closed cycle.
            const visitedBoundaryEdges = new Set();
            const boundaryLoops = [];
            const secondaryBoundaryEdgeIds = new Set();

            for (let seed = 0; seed < boundaryEdges.length; seed++) {
                if (visitedBoundaryEdges.has(seed)) continue;

                const componentEdges = new Set();
                const componentVertices = new Set();
                const stack = [seed];

                while (stack.length > 0) {
                    const edgeId = stack.pop();
                    if (visitedBoundaryEdges.has(edgeId)) continue;

                    visitedBoundaryEdges.add(edgeId);
                    componentEdges.add(edgeId);

                    const edge = boundaryEdges[edgeId];
                    componentVertices.add(edge.a);
                    componentVertices.add(edge.b);

                    for (const vertex of [edge.a, edge.b]) {
                        for (const neighbour of boundaryAdjacency.get(vertex) || []) {
                            if (!visitedBoundaryEdges.has(neighbour.edgeId)) {
                                stack.push(neighbour.edgeId);
                            }
                        }
                    }
                }

                // A connected component is a simple cycle only when every
                // vertex has degree two within that component.
                const isSimpleCycle = componentEdges.size >= 3 &&
                    [...componentVertices].every(vertex =>
                        (boundaryAdjacency.get(vertex) || []).filter(
                            item => componentEdges.has(item.edgeId)
                        ).length === 2
                    );

                if (!isSimpleCycle) {
                    for (const edgeId of componentEdges) {
                        secondaryBoundaryEdgeIds.add(edgeId);
                    }
                    continue;
                }

                const firstEdgeId = componentEdges.values().next().value;
                const firstEdge = boundaryEdges[firstEdgeId];
                const startVertex = firstEdge.a;
                const loopVertices = [startVertex];
                const orderedEdgeIds = new Set();
                let currentVertex = startVertex;
                let previousEdgeId = -1;
                let closed = false;

                for (let step = 0; step < componentEdges.size; step++) {
                    const next = (boundaryAdjacency.get(currentVertex) || []).find(
                        item => componentEdges.has(item.edgeId) &&
                            item.edgeId !== previousEdgeId
                    );

                    if (!next) break;

                    orderedEdgeIds.add(next.edgeId);
                    previousEdgeId = next.edgeId;
                    currentVertex = next.to;

                    if (currentVertex === startVertex) {
                        closed = true;
                        break;
                    }

                    loopVertices.push(currentVertex);
                }

                if (!closed || orderedEdgeIds.size !== componentEdges.size) {
                    for (const edgeId of componentEdges) {
                        secondaryBoundaryEdgeIds.add(edgeId);
                    }
                    continue;
                }

                // Translate coordinates to a local origin before the shoelace
                // calculation to reduce floating-point cancellation.
                const origin = terrainPoints[loopVertices[0]];
                let twiceArea = 0;
                let validCoordinates = !!origin &&
                    Number.isFinite(origin.easting) &&
                    Number.isFinite(origin.northing);

                if (validCoordinates) {
                    for (let i = 0; i < loopVertices.length; i++) {
                        const a = terrainPoints[loopVertices[i]];
                        const b = terrainPoints[
                            loopVertices[(i + 1) % loopVertices.length]
                        ];

                        if (!a || !b ||
                            !Number.isFinite(a.easting) ||
                            !Number.isFinite(a.northing) ||
                            !Number.isFinite(b.easting) ||
                            !Number.isFinite(b.northing)) {
                            validCoordinates = false;
                            break;
                        }

                        const ax = a.easting - origin.easting;
                        const ay = a.northing - origin.northing;
                        const bx = b.easting - origin.easting;
                        const by = b.northing - origin.northing;
                        twiceArea += ax * by - bx * ay;
                    }
                }

                if (!validCoordinates) {
                    for (const edgeId of componentEdges) {
                        secondaryBoundaryEdgeIds.add(edgeId);
                    }
                    continue;
                }

                boundaryLoops.push({
                    edgeIds: orderedEdgeIds,
                    vertices: loopVertices,
                    area: Math.abs(twiceArea) / 2
                });
            }

            // TEMPORARY READ-ONLY DIAGNOSTIC:
            // Verify that every accepted-mesh boundary edge is accounted
            // for exactly once as either a closed-loop edge or an
            // edge belonging to an invalid/unclosed component.

            const boundaryEdgeMembership = new Map();

            for (let loopIndex = 0;
                loopIndex < boundaryLoops.length;
                loopIndex++) {
                for (const edgeId of boundaryLoops[loopIndex].edgeIds) {
                    boundaryEdgeMembership.set(
                        edgeId,
                        (boundaryEdgeMembership.get(edgeId) || 0) + 1
                    );
                }
            }

            for (const edgeId of secondaryBoundaryEdgeIds) {
                boundaryEdgeMembership.set(
                    edgeId,
                    (boundaryEdgeMembership.get(edgeId) || 0) + 1
                );
            }

            const unaccountedBoundaryEdgeIds = [];
            const multiplyAccountedBoundaryEdgeIds = [];

            for (let edgeId = 0;
                edgeId < boundaryEdges.length;
                edgeId++) {
                const membershipCount =
                    boundaryEdgeMembership.get(edgeId) || 0;

                if (membershipCount === 0) {
                    unaccountedBoundaryEdgeIds.push(edgeId);
                } else if (membershipCount > 1) {
                    multiplyAccountedBoundaryEdgeIds.push(edgeId);
                }
            }

            const closedLoopEdgeCount = boundaryLoops.reduce(
                (sum, loop) => sum + loop.edgeIds.size,
                0
            );

            const unclosedOrInvalidEdgeCount =
                secondaryBoundaryEdgeIds.size;

            window.__boundaryCompletenessDiagnostic = {
                totalBoundaryEdges: boundaryEdges.length,
                closedLoopCount: boundaryLoops.length,
                closedLoopEdgeCount,
                unclosedOrInvalidEdgeCount,
                unaccountedEdgeCount:
                    unaccountedBoundaryEdgeIds.length,
                multiplyAccountedEdgeCount:
                    multiplyAccountedBoundaryEdgeIds.length,

                accountedEdgeCount:
                    closedLoopEdgeCount +
                    unclosedOrInvalidEdgeCount,

                edgeAccountingPasses:
                    unaccountedBoundaryEdgeIds.length === 0 &&
                    multiplyAccountedBoundaryEdgeIds.length === 0 &&
                    boundaryEdgeMembership.size === boundaryEdges.length,

                unaccountedBoundaryEdgeIds,
                multiplyAccountedBoundaryEdgeIds
            };

            console.info(
                "[Survey Terrain] Boundary completeness:",
                window.__boundaryCompletenessDiagnostic
            );

            // TEMPORARY READ-ONLY DIAGNOSTIC:
            // Summarize every accepted-mesh boundary loop and its
            // containment relationship. Does not alter the design.

            function diagnosticPointInLoop(point, polygonVertices) {
                let inside = false;
                const x = point.easting;
                const y = point.northing;

                for (
                    let i = 0, j = polygonVertices.length - 1;
                    i < polygonVertices.length;
                    j = i++
                ) {
                    const a = terrainPoints[polygonVertices[i]];
                    const b = terrainPoints[polygonVertices[j]];

                    if (!a || !b) return false;

                    const crosses =
                        (a.northing > y) !== (b.northing > y) &&
                        x <
                        ((b.easting - a.easting) *
                            (y - a.northing)) /
                        ((b.northing - a.northing) ||
                            Number.EPSILON) +
                        a.easting;

                    if (crosses) inside = !inside;
                }

                return inside;
            }

            const boundaryLoopSummary = boundaryLoops.map(
                (loop, index) => {
                    const uniqueVertices = new Set(loop.vertices);
                    const coordinatesValid = loop.vertices.every(vertex => {
                        const p = terrainPoints[vertex];
                        return p &&
                            Number.isFinite(p.easting) &&
                            Number.isFinite(p.northing);
                    });

                    const possibleContainers = boundaryLoops
                        .map((candidate, candidateIndex) => {
                            if (
                                candidateIndex === index ||
                                candidate.area <= loop.area ||
                                !coordinatesValid
                            ) {
                                return null;
                            }

                            const allVerticesInside = loop.vertices.every(
                                vertex => {
                                    const point = terrainPoints[vertex];
                                    return diagnosticPointInLoop(
                                        point,
                                        candidate.vertices
                                    );
                                }
                            );

                            return allVerticesInside
                                ? {
                                    loop: candidateIndex + 1,
                                    areaM2: candidate.area
                                }
                                : null;
                        })
                        .filter(Boolean)
                        .sort((a, b) => a.areaM2 - b.areaM2);

                    return {
                        loop: index + 1,
                        vertexCount: loop.vertices.length,
                        edgeCount: loop.edgeIds.size,
                        uniqueVertexCount: uniqueVertices.size,
                        areaM2: loop.area,
                        coordinatesValid,
                        nonZeroArea:
                            Number.isFinite(loop.area) && loop.area > 0,
                        possibleContainerLoops: possibleContainers
                            .map(item => item.loop)
                            .join(", ") || "None detected",
                        smallestPossibleContainer:
                            possibleContainers[0]?.loop ?? null
                    };
                }
            );

            window.__boundaryLoopSummary = boundaryLoopSummary;

            console.table(boundaryLoopSummary);

            console.info(
                "[Survey Terrain] Boundary-loop summary:",
                boundaryLoopSummary
            );

            boundaryLoops.sort((a, b) => b.area - a.area);
            const primaryPerimeterEdgeIds = boundaryLoops.length
                ? boundaryLoops[0].edgeIds
                : new Set();

            window.__boundaryDebug = (() => {
                const vertices = boundaryLoops[0]?.vertices ?? [];
                const targets = new Set([2835, 2836, 2838]);

                return {
                    primaryAreaM2: boundaryLoops[0]?.area ?? null,
                    primaryVertexCount: vertices.length,

                    targetVertexSequence: vertices
                        .map((vertex, index) => ({
                            vertex,
                            previous: vertices[
                                (index - 1 + vertices.length) % vertices.length
                            ],
                            next: vertices[(index + 1) % vertices.length]
                        }))
                        .filter(item => targets.has(item.vertex))
                };
            })();

            for (let i = 0; i < boundaryEdges.length; i++) {
                if (!primaryPerimeterEdgeIds.has(i)) {
                    secondaryBoundaryEdgeIds.add(i);
                }
            }

            const primaryPerimeterPositions = [];
            const secondaryCoveragePositions = [];
            for (let i = 0; i < boundaryEdges.length; i++) {
                const edge = boundaryEdges[i];
                const a = terrainPoints[edge.a];
                const b = terrainPoints[edge.b];
                const va = toWorld(a.easting, a.northing, a.rl);
                const vb = toWorld(b.easting, b.northing, b.rl);
                const target = primaryPerimeterEdgeIds.has(i)
                    ? primaryPerimeterPositions
                    : secondaryCoveragePositions;
                target.push(va.x, va.y, va.z, vb.x, vb.y, vb.z);
            }

            function makeBoundaryLine(positions, color, opacity, name, renderOrder) {
                const geometry = new THREE.BufferGeometry();
                geometry.setAttribute(
                    "position",
                    new THREE.Float32BufferAttribute(positions, 3)
                );
                const material = new THREE.LineBasicMaterial({
                    color,
                    transparent: true,
                    opacity,
                    depthTest: false
                });
                const lines = new THREE.LineSegments(geometry, material);
                lines.name = name;
                lines.renderOrder = renderOrder;
                return lines;
            }

            const primaryPerimeterGuide = makeBoundaryLine(
                primaryPerimeterPositions,
                0xff0000, // Red outer boundary; alignment centreline remains orange.
                1.0,
                "Primary terrain coverage perimeter (visual estimate)",
                11
            );
            const secondaryCoverageGuide = makeBoundaryLine(
                secondaryCoveragePositions,
                0xf4d35e,
                0.9,
                "Secondary terrain coverage edges and open boundary chains",
                10
            );

            // Detect candidate interior coverage gaps from accepted-mesh topology,
            // not from rejected triangles alone. A closed boundary loop enclosed
            // by the primary perimeter is highlighted as a candidate uncovered
            // region. This is a visual diagnostic: nested/disconnected coverage
            // islands can resemble holes and must be reviewed before conclusions.
            function pointInSurveyPolygon(point, polygonVertices) {
                let inside = false;
                const x = point.easting;
                const y = point.northing;
                for (let i = 0, j = polygonVertices.length - 1;
                    i < polygonVertices.length; j = i++) {
                    const pi = terrainPoints[polygonVertices[i]];
                    const pj = terrainPoints[polygonVertices[j]];
                    const crosses = ((pi.northing > y) !== (pj.northing > y)) &&
                        (x < (pj.easting - pi.easting) *
                            (y - pi.northing) /
                            ((pj.northing - pi.northing) || Number.EPSILON) + pi.easting);
                    if (crosses) inside = !inside;
                }
                return inside;
            }

            const outerLoop = boundaryLoops[0] ?? null;

            // Identify nested boundary loops conservatively.
            // A loop is considered enclosed only when all its vertices lie
            // inside a larger loop. Its parent is the smallest enclosing loop.
            const boundaryLoopParents = boundaryLoops.map(() => -1);

            for (let i = 0; i < boundaryLoops.length; i++) {
                const loop = boundaryLoops[i];

                if (loop.area <= 0 || loop.vertices.length < 3) {
                    continue;
                }

                let smallestEnclosingArea = Infinity;
                let parentIndex = -1;

                for (let j = 0; j < boundaryLoops.length; j++) {
                    if (i === j) continue;

                    const candidateParent = boundaryLoops[j];

                    if (
                        candidateParent.area <= loop.area ||
                        candidateParent.area >= smallestEnclosingArea ||
                        candidateParent.vertices.length < 3
                    ) {
                        continue;
                    }

                    const fullyContained = loop.vertices.every(vertexIndex => {
                        const point = terrainPoints[vertexIndex];

                        return point &&
                            pointInSurveyPolygon(point, candidateParent.vertices);
                    });

                    if (fullyContained) {
                        smallestEnclosingArea = candidateParent.area;
                        parentIndex = j;
                    }
                }

                boundaryLoopParents[i] = parentIndex;
            }

            // Apply nesting parity:
            // depth 0 = outer boundary, depth 1 = candidate gap,
            // depth 2 = enclosed terrain island, depth 3 = nested candidate gap.
            const candidateInteriorGapLoops = [];
            window.__candidateGapVertexDiagnostics = [];

            for (let i = 0; i < boundaryLoops.length; i++) {
                const loop = boundaryLoops[i];

                if (loop.area <= 0 || loop.vertices.length < 3) {
                    continue;
                }

                let depth = 0;
                let parentIndex = boundaryLoopParents[i];
                let validNesting = true;
                const visitedParents = new Set([i]);

                while (parentIndex !== -1) {
                    if (visitedParents.has(parentIndex)) {
                        validNesting = false;
                        break;
                    }

                    visitedParents.add(parentIndex);
                    depth++;
                    parentIndex = boundaryLoopParents[parentIndex];
                }

                if (validNesting && depth % 2 === 1) {
                    candidateInteriorGapLoops.push(loop);
                }
            }

            const gapFillMeshes = [];
            const gapOutlinePositions = [];

            for (let gapIndex = 0; gapIndex < candidateInteriorGapLoops.length; gapIndex++) {
                const loop = candidateInteriorGapLoops[gapIndex];
                const shape = new THREE.Shape();
                let meanWorldY = 0;
                const worldLoop = loop.vertices.map(index => {
                    const point = terrainPoints[index];
                    const world = toWorld(point.easting, point.northing, point.rl);
                    meanWorldY += world.y;
                    return { point, world };
                });
                meanWorldY /= worldLoop.length;

                worldLoop.forEach(({ world }, index) => {
                    if (index === 0) shape.moveTo(world.x, world.z);
                    else shape.lineTo(world.x, world.z);
                });
                shape.closePath();

                // The fill is a flat, floating diagnostic marker, not terrain.
                // It is deliberately depth-independent so the uncovered region
                // remains visible even when the camera looks through the mesh.
                const fillGeometry = new THREE.ShapeGeometry(shape);
                fillGeometry.rotateX(Math.PI / 2);
                const fillMaterial = new THREE.MeshBasicMaterial({
                    color: 0xff35b8,
                    transparent: true,
                    opacity: 0.38,
                    side: THREE.DoubleSide,
                    depthTest: false,
                    depthWrite: false
                });
                const fillMesh = new THREE.Mesh(fillGeometry, fillMaterial);
                fillMesh.position.y = meanWorldY + 0.08;
                fillMesh.name = `Candidate interior terrain gap fill ${gapIndex + 1}`;
                fillMesh.renderOrder = 998;
                gapFillMeshes.push(fillMesh);

                for (let edgeIndex = 0; edgeIndex < worldLoop.length; edgeIndex++) {
                    // Store independent edge pairs so separate gap loops are never
                    // accidentally joined by a line across the terrain.
                    const a = worldLoop[edgeIndex].world;
                    const b = worldLoop[(edgeIndex + 1) % worldLoop.length].world;
                    gapOutlinePositions.push(
                        a.x, a.y, a.z,
                        b.x, b.y, b.z
                    );
                }
            }

            window.__candidateGapVertexDiagnostics = candidateInteriorGapLoops.map((loop, index) => ({
                id: index + 1,
                areaM2: loop.area,
                vertices: loop.vertices.map(vertexIndex => ({
                    index: vertexIndex,
                    easting: terrainPoints[vertexIndex]?.easting,
                    northing: terrainPoints[vertexIndex]?.northing,
                    elevation: terrainPoints[vertexIndex]?.elevation,
                    rl: terrainPoints[vertexIndex]?.rl
                }))
            }));

            console.table(
                window.__candidateGapVertexDiagnostics.flatMap(gap =>
                    gap.vertices.map(vertex => ({
                        gapId: gap.id,
                        ...vertex
                    }))
                )
            );

            const gapOutlineGeometry = new THREE.BufferGeometry();
            gapOutlineGeometry.setAttribute(
                "position",
                new THREE.Float32BufferAttribute(gapOutlinePositions, 3)
            );
            const candidateGapOutline = new THREE.LineSegments(
                gapOutlineGeometry,
                new THREE.LineBasicMaterial({
                    color: 0x00ffff,
                    transparent: false,
                    depthTest: false
                })
            );
            candidateGapOutline.name = "Cyan outline for candidate interior terrain gaps";
            candidateGapOutline.renderOrder = 999;
            candidateGapOutline.visible = gapOutlinePositions.length >= 12;

            window.__terrainCoverageGaps = {
                candidateGapCount: candidateInteriorGapLoops.length,
                candidates: candidateInteriorGapLoops.map((loop, index) => ({
                    id: index + 1,
                    boundaryVertexCount: loop.vertices.length,
                    approximateAreaM2: loop.area,
                    diagnosticOnly: true
                })),
                note: "Candidate interior uncovered regions are detected from closed boundaries of the accepted mesh, not from rejected facets alone. Visual flags require review; no terrain elevations are inferred."
            };

            const terrainLayer = new THREE.Group();
            terrainLayer.name = "Measured survey terrain and coverage guides";
            terrainLayer.add(terrainMesh);

            // if (provisionalTerrainMesh) {
            //     Share the Terrain toggle with accepted terrain.
            //     terrainLayer.add(provisionalTerrainMesh);
            //     provisionalTerrainMesh.visible = true;
            //     provisionalTerrainMesh.geometry.computeBoundingBox();
            //     provisionalTerrainMesh.geometry.computeBoundingSphere();
            //     window.__provisionalVisualTerrain.meshVisible = provisionalTerrainMesh.visible;
            //     window.__provisionalVisualTerrain.boundingBox = provisionalTerrainMesh.geometry.boundingBox
            //         ? {
            //             min: provisionalTerrainMesh.geometry.boundingBox.min.toArray(),
            //             max: provisionalTerrainMesh.geometry.boundingBox.max.toArray()
            //         }
            //         : null;
            // }

            // Diagnostic overlay: edges of triangles rejected by the
            // maximum circumradius filter. Does not add terrain surfaces.
            if (SHOW_REJECTED_TRIANGLES && rejectedTriangleIndices.length > 0) {
                const rejectedGeometry = new THREE.BufferGeometry();
                const rejectedPositions = [];

                for (let i = 0; i < rejectedTriangleIndices.length; i += 3) {
                    const ia = rejectedTriangleIndices[i];
                    const ib = rejectedTriangleIndices[i + 1];
                    const ic = rejectedTriangleIndices[i + 2];
                    const rejectedTriangleId = rejectedTriangleDiagnostics.findIndex(
                        triangle => triangle.indices[0] === ia &&
                            triangle.indices[1] === ib &&
                            triangle.indices[2] === ic
                    );

                    if (reconstructedRejectedTriangleIds.has(rejectedTriangleId)) continue;

                    const a = terrainPoints[ia];
                    const b = terrainPoints[ib];
                    const c = terrainPoints[ic];

                    if (!a || !b || !c) continue;

                    const va = toWorld(a.easting, a.northing, a.rl);
                    const vb = toWorld(b.easting, b.northing, b.rl);
                    const vc = toWorld(c.easting, c.northing, c.rl);

                    rejectedPositions.push(
                        va.x, va.y, va.z,
                        vb.x, vb.y, vb.z,

                        vb.x, vb.y, vb.z,
                        vc.x, vc.y, vc.z,

                        vc.x, vc.y, vc.z,
                        va.x, va.y, va.z
                    );
                }

                rejectedGeometry.setAttribute(
                    "position",
                    new THREE.Float32BufferAttribute(rejectedPositions, 3)
                );

                const rejectedMaterial = new THREE.LineBasicMaterial({
                    color: 0x00ffff,
                    transparent: false,
                    opacity: 1.0,
                    depthTest: false,
                    depthWrite: false
                });

                const rejectedLines = new THREE.LineSegments(
                    rejectedGeometry,
                    rejectedMaterial
                );

                rejectedLines.name = "RejectedTriangleDiagnostic";

                // Cyan rejected-triangle diagnostic visibility control.
                const rejectedLinesToggle = document.getElementById(
                    "survey-map-toggle-rejected-lines"
                );

                rejectedLinesToggle?.addEventListener("click", () => {
                    rejectedLines.visible = !rejectedLines.visible;

                    const isVisible = rejectedLines.visible;

                    rejectedLinesToggle.setAttribute("aria-pressed", String(isVisible));
                    rejectedLinesToggle.innerHTML = isVisible
                        ? '<i class="bi bi-diagram-3"></i> Cyan Lines: On'
                        : '<i class="bi bi-diagram-3"></i> Cyan Lines: Off';
                });

                rejectedLines.renderOrder = 999;

                terrainLayer.add(rejectedLines);

                console.info("[Survey Terrain] Rejected triangle diagnostic:", {
                    triangleCount: rejectedTriangleIndices.length / 3,
                    lineSegments: rejectedPositions.length / 6
                });
            }

            terrainLayer.add(primaryPerimeterGuide);
            terrainLayer.add(secondaryCoverageGuide);

            // Cyan Terrain visibility control.
            if (cyanTerrainMesh) {
                terrainLayer.add(cyanTerrainMesh);
            }

            const cyanTerrainToggle = document.getElementById(
                "survey-map-toggle-cyan-terrain"
            );

            cyanTerrainToggle?.addEventListener("click", () => {
                if (!cyanTerrainMesh) return;

                cyanTerrainMesh.visible = !cyanTerrainMesh.visible;

                cyanTerrainToggle.setAttribute(
                    "aria-pressed",
                    String(cyanTerrainMesh.visible)
                );

                cyanTerrainToggle.innerHTML = cyanTerrainMesh.visible
                    ? '<i class="bi bi-layers"></i> Cyan Terrain: On'
                    : '<i class="bi bi-layers"></i> Cyan Terrain: Off';
            });

            for (const gapFillMesh of gapFillMeshes) terrainLayer.add(gapFillMesh);

            if (candidateGapOutline.visible) terrainLayer.add(candidateGapOutline);
            scene.add(terrainLayer);

            console.info("[Survey Terrain] Candidate interior coverage gaps:",
                window.__terrainCoverageGaps);

            console.info("[Survey Terrain] Coverage guide:", {
                boundaryEdgeSegments: boundaryEdges.length,
                primaryPerimeterSegments: primaryPerimeterPositions.length / 6,
                secondaryCoverageSegments: secondaryCoveragePositions.length / 6,
                closedBoundaryLoops: boundaryLoops.length,
                primaryLoopAreaM2: boundaryLoops.length ? boundaryLoops[0].area : null,
                meaning: "Red is the largest closed accepted-mesh boundary loop (visual estimate); yellow shows secondary/open coverage edges; magenta fill with cyan outline marks candidate interior gaps from accepted-mesh topology. Gap fills are diagnostic only; no terrain is extrapolated."
            });

            // Terrain layer on/off control.
            const terrainToggle = document.getElementById(
                "survey-map-toggle-terrain"
            );

            terrainToggle?.addEventListener("click", () => {
                terrainLayer.visible = !terrainLayer.visible;

                const isVisible = terrainLayer.visible;

                terrainToggle.setAttribute("aria-pressed", String(isVisible));
                terrainToggle.innerHTML = isVisible
                    ? '<i class="bi bi-layers"></i> Terrain: On'
                    : '<i class="bi bi-layers"></i> Terrain: Off';
            });
        }

        // Keep surveyed points visible above the terrain.
        const surveyLayer = new THREE.Points(surveyGeometry, surveyMaterial);
        scene.add(surveyLayer);

        // Survey data layer on/off control.
        const surveyToggle = document.getElementById(
            "survey-map-toggle-survey"
        );

        surveyToggle?.addEventListener("click", () => {
            surveyLayer.visible = !surveyLayer.visible;

            const isVisible = surveyLayer.visible;

            surveyToggle.setAttribute("aria-pressed", String(isVisible));
            surveyToggle.innerHTML = isVisible
                ? '<i class="bi bi-geo"></i> Survey Data: On'
                : '<i class="bi bi-geo"></i> Survey Data: Off';
        });

        /// Imported road alignment: continuous 7 m visual road surface.
        // Display geometry only; does not change engineering data.
        if (validAlignment.length > 1) {
            const orderedAlignment = [...validAlignment].sort((a, b) => {
                const ca = Number(a.Chainage);
                const cb = Number(b.Chainage);

                if (Number.isFinite(ca) && Number.isFinite(cb)) {
                    return ca - cb;
                }

                return 0;
            });

            const halfRoadWidth = 3.5;
            const visualLift = 0.15;
            const roadPositions = [];
            const roadIndices = [];
            const leftRoadBoundaryPositions = [];
            const rightRoadBoundaryPositions = [];
            const centerlinePositions = [];

            const getAlignmentRL = (p) => {
                if (
                    p.ExistingRL != null &&
                    p.ExistingRL !== "" &&
                    Number.isFinite(Number(p.ExistingRL))
                ) {
                    return Number(p.ExistingRL);
                }

                let nearest = null;
                let nearestDistance = Infinity;

                validSurvey.forEach(s => {
                    const dx = Number(s.Easting) - Number(p.Easting);
                    const dz = Number(s.Northing) - Number(p.Northing);
                    const distance = dx * dx + dz * dz;

                    if (distance < nearestDistance) {
                        nearestDistance = distance;
                        nearest = s;
                    }
                });

                return nearest ? Number(nearest.RL) : baseRL;
            };

            const originalRoadCenters = orderedAlignment.map(p => ({
                e: Number(p.Easting),
                n: Number(p.Northing),
                rl: getAlignmentRL(p)
            }));

            // Add intermediate points to reduce visible gaps between road segments.
            const roadCenters = [];

            for (let i = 0; i < originalRoadCenters.length - 1; i++) {
                const a = originalRoadCenters[i];
                const b = originalRoadCenters[i + 1];

                roadCenters.push(a);

                const distance = Math.hypot(b.e - a.e, b.n - a.n);
                const divisions = Math.max(1, Math.ceil(distance / 1.0));

                for (let j = 1; j < divisions; j++) {
                    const t = j / divisions;

                    roadCenters.push({
                        e: a.e + (b.e - a.e) * t,
                        n: a.n + (b.n - a.n) * t,
                        rl: a.rl + (b.rl - a.rl) * t
                    });
                }
            }

            roadCenters.push(originalRoadCenters[originalRoadCenters.length - 1]);

            const roadElevationDifferences = originalRoadCenters.map(p => ({
                rl: p.rl,
                difference: p.rl - datumRL
            }));

            const belowDatumCount = roadElevationDifferences.filter(
                p => p.difference < -DATUM_ELEVATION_TOLERANCE_M
            ).length;

            const aboveDatumCount = roadElevationDifferences.filter(
                p => p.difference > DATUM_ELEVATION_TOLERANCE_M
            ).length;

            const nearDatumCount = roadElevationDifferences.length
                - belowDatumCount
                - aboveDatumCount;

            const minDifference = Math.min(
                ...roadElevationDifferences.map(p => p.difference)
            );

            const maxDifference = Math.max(
                ...roadElevationDifferences.map(p => p.difference)
            );

            const setText = (id, value) => {
                const element = document.getElementById(id);
                if (element) element.textContent = value;
            };

            setText("survey-datum-rl", datumRL.toFixed(3));
            setText("survey-datum-above-count", aboveDatumCount.toLocaleString());
            setText("survey-datum-below-count", belowDatumCount.toLocaleString());
            setText("survey-datum-near-count", nearDatumCount.toLocaleString());
            setText("survey-datum-min-difference", minDifference.toFixed(3));
            setText("survey-datum-max-difference", `+${maxDifference.toFixed(3)}`);

            console.info("[Survey Terrain] Road vs datum:", {
                datumRL: Number(datumRL.toFixed(3)),
                minimumDifferenceM: Number(minDifference.toFixed(3)),
                maximumDifferenceM: Number(maxDifference.toFixed(3)),
                belowDatum: belowDatumCount,
                nearDatum: nearDatumCount,
                aboveDatum: aboveDatumCount
            });

            // Remove consecutive duplicate points that can cause zero-width segments.
            const cleanCenters = roadCenters.filter((p, i, arr) => {
                if (i === 0) return true;

                const previous = arr[i - 1];
                return Math.hypot(p.e - previous.e, p.n - previous.n) > 0.001;
            });

            cleanCenters.forEach((p, i) => {
                const previous = cleanCenters[Math.max(0, i - 1)];
                const next = cleanCenters[Math.min(cleanCenters.length - 1, i + 1)];

                let dx = next.e - previous.e;
                let dz = next.n - previous.n;
                const length = Math.hypot(dx, dz);

                if (length < 1e-8) {
                    dx = 1;
                    dz = 0;
                } else {
                    dx /= length;
                    dz /= length;
                }

                // Perpendicular offset for the road edges.
                const offsetE = -dz * halfRoadWidth;
                const offsetN = dx * halfRoadWidth;

                const left = toWorld(
                    p.e + offsetE,
                    p.n + offsetN,
                    p.rl
                );

                const right = toWorld(
                    p.e - offsetE,
                    p.n - offsetN,
                    p.rl
                );

                roadPositions.push(
                    left.x, left.y + visualLift, left.z,
                    right.x, right.y + visualLift, right.z
                );

                // Road outer edges are separate overlay lines. Disable depth testing
                // so the red edges remain visible whether the road is above or below
                // the datum sheet; keep them slightly above the road surface.
                const boundaryLift = visualLift + 0.14;
                leftRoadBoundaryPositions.push(
                    left.x, left.y + boundaryLift, left.z
                );
                rightRoadBoundaryPositions.push(
                    right.x, right.y + boundaryLift, right.z
                );

                const center = toWorld(p.e, p.n, p.rl);
                centerlinePositions.push(
                    center.x,
                    center.y + visualLift + 0.12,
                    center.z
                );

                if (i < cleanCenters.length - 1) {
                    const a = i * 2;
                    const b = a + 1;
                    const c = a + 2;
                    const d = a + 3;

                    roadIndices.push(a, b, c);
                    roadIndices.push(b, d, c);
                }
            });

            // Road surface.
            const roadGeometry = new THREE.BufferGeometry();

            roadGeometry.setAttribute(
                "position",
                new THREE.Float32BufferAttribute(roadPositions, 3)
            );

            roadGeometry.setIndex(roadIndices);
            roadGeometry.computeVertexNormals();

            // Colour the road according to elevation relative to the datum.
            // Blue = above, red = below, grey = near datum.
            const roadGeometryColors = [];

            for (let i = 0; i < cleanCenters.length; i++) {
                const rlDifference = cleanCenters[i].rl - datumRL;

                let color;

                if (rlDifference > DATUM_ELEVATION_TOLERANCE_M) {
                    color = new THREE.Color(0x2196F3); // Above datum
                } else if (rlDifference < -DATUM_ELEVATION_TOLERANCE_M) {
                    color = new THREE.Color(0xE57373); // Below datum
                } else {
                    color = new THREE.Color(0xB0BEC5); // Near datum
                }

                // Two road-edge vertices for each centreline point.
                for (let j = 0; j < 2; j++) {
                    roadGeometryColors.push(
                        color.r,
                        color.g,
                        color.b
                    );
                }
            }

            roadGeometry.setAttribute(
                "color",
                new THREE.Float32BufferAttribute(roadGeometryColors, 3)
            );

            const roadMaterial = new THREE.MeshStandardMaterial({
                vertexColors: true,
                roughness: 0.95,
                metalness: 0,
                side: THREE.DoubleSide,
                polygonOffset: true,
                polygonOffsetFactor: -1,
                polygonOffsetUnits: -1
            });

            const roadSurface = new THREE.Mesh(roadGeometry, roadMaterial);
            roadSurface.renderOrder = 1;
            const alignmentLayer = new THREE.Group();
            alignmentLayer.add(roadSurface);
            scene.add(alignmentLayer);

            // Orange imported alignment: separate line above the road surface.
            const alignmentGeometry = new THREE.BufferGeometry();

            alignmentGeometry.setAttribute(
                "position",
                new THREE.Float32BufferAttribute(centerlinePositions, 3)
            );

            const alignmentMaterial = new THREE.LineBasicMaterial({
                color: 0xff8c42,
                depthTest: false,
                depthWrite: false,
                transparent: false
            });

            const alignmentLine = new THREE.Line(
                alignmentGeometry,
                alignmentMaterial
            );

            alignmentLine.renderOrder = 10;
            alignmentLayer.add(alignmentLine);

            // Red road outer boundaries, independent of the datum plane's depth.
            const roadBoundaryMaterial = new THREE.LineBasicMaterial({
                color: 0xff0000,
                depthTest: false,
                depthWrite: false,
                transparent: false
            });

            const leftRoadBoundaryGeometry = new THREE.BufferGeometry();
            leftRoadBoundaryGeometry.setAttribute(
                "position",
                new THREE.Float32BufferAttribute(leftRoadBoundaryPositions, 3)
            );
            const leftRoadBoundary = new THREE.Line(
                leftRoadBoundaryGeometry,
                roadBoundaryMaterial
            );
            leftRoadBoundary.name = "Left road outer boundary (red)";
            leftRoadBoundary.renderOrder = 20;
            alignmentLayer.add(leftRoadBoundary);

            const rightRoadBoundaryGeometry = new THREE.BufferGeometry();
            rightRoadBoundaryGeometry.setAttribute(
                "position",
                new THREE.Float32BufferAttribute(rightRoadBoundaryPositions, 3)
            );
            const rightRoadBoundary = new THREE.Line(
                rightRoadBoundaryGeometry,
                roadBoundaryMaterial
            );
            rightRoadBoundary.name = "Right road outer boundary (red)";
            rightRoadBoundary.renderOrder = 20;
            alignmentLayer.add(rightRoadBoundary);

            // Road alignment layer on/off control.
            const alignmentToggle = document.getElementById(
                "survey-map-toggle-alignment"
            );

            alignmentToggle?.addEventListener("click", () => {
                alignmentLayer.visible = !alignmentLayer.visible;

                const isVisible = alignmentLayer.visible;

                alignmentToggle.setAttribute("aria-pressed", String(isVisible));
                alignmentToggle.innerHTML = isVisible
                    ? '<i class="bi bi-signpost-split"></i> Alignment: On'
                    : '<i class="bi bi-signpost-split"></i> Alignment: Off';
            });
        }

        // Detected culvert groups: locate markers using SurveyPointNos.
        const culvertPoints = [];
        const culvertMarkerData = [];

        const surveyByPointNo = new Map(
            validSurvey.map(p => [Number(p.PointNo), p])
        );

        culverts.forEach(c => {
            const pointNos = c.SurveyPointNos || [];

            const members = pointNos
                .map(pointNo => surveyByPointNo.get(Number(pointNo)))
                .filter(Boolean);

            if (!members.length) return;

            const easting = members.reduce(
                (sum, p) => sum + Number(p.Easting), 0
            ) / members.length;

            const northing = members.reduce(
                (sum, p) => sum + Number(p.Northing), 0
            ) / members.length;

            const rl = members.reduce(
                (sum, p) => sum + Number(p.RL), 0
            ) / members.length;

            const position = toWorld(easting, northing, rl);

            culvertPoints.push(position);

            culvertMarkerData.push({
                data: c,
                position,
                easting,
                northing,
                rl,
                pointNos
            });
        });

        if (culvertPoints.length) {
            const geometry = new THREE.BufferGeometry();
            const positions = [];

            culvertPoints.forEach(v => {
                positions.push(v.x, v.y, v.z);
            });

            geometry.setAttribute(
                "position",
                new THREE.Float32BufferAttribute(positions, 3)
            );

            const material = new THREE.PointsMaterial({
                color: 0x3fb950,
                size: 10,
                sizeAttenuation: false,
                depthTest: false
            });

            const markers = new THREE.Points(geometry, material);
            markers.renderOrder = 999;

            scene.add(markers);

            // ─────────────────────────────────────────────────────────────────
            // 3D Culvert Solid Model Placement (Test Implementation)
            // ─────────────────────────────────────────────────────────────────
            // Dynamic culvert solid data: checks DB first, then sessionStorage, falls back to default sample
            const currentProjectId = (() => {
                const el = document.getElementById("survey-map-project-id");
                if (el && el.textContent.trim()) return parseInt(el.textContent.trim(), 10);
                const p = new URLSearchParams(window.location.search).get("projectId");
                return p ? parseInt(p, 10) : 0;
            })();

            let currentSolidData = null;
            try {
                const cachedSolid = sessionStorage.getItem("culvert_cad_active_solid");
                if (cachedSolid) {
                    currentSolidData = JSON.parse(cachedSolid);
                }
            } catch (e) {
                console.warn("[CulvertCAD] Failed to read cached culvert solid from sessionStorage:", e);
            }
            if (!currentSolidData && window.CULVERT_TEST_SOLID_DATA) {
                currentSolidData = window.CULVERT_TEST_SOLID_DATA;
            }

            // Master group for all 3D culvert solids
            const culvertSolidsGroup = new THREE.Group();
            culvertSolidsGroup.name = "All_Culvert_3D_Solids";
            scene.add(culvertSolidsGroup);

            // Helper to get alignment tangent direction at a given chainage
            function getAlignmentDirectionAtChainage(chainage) {
                if (!validAlignment || validAlignment.length < 2) return 0;
                let p1 = validAlignment[0];
                let p2 = validAlignment[1];

                for (let i = 0; i < validAlignment.length - 1; i++) {
                    if (validAlignment[i + 1].Chainage >= chainage) {
                        p1 = validAlignment[i];
                        p2 = validAlignment[i + 1];
                        break;
                    }
                }

                const dE = Number(p2.Easting) - Number(p1.Easting);
                const dN = Number(p2.Northing) - Number(p1.Northing);
                return Math.atan2(dE, dN); // Road heading angle
            }

            // Function to build Three.js meshes from a solid definition
            function buildCulvertSolidMeshGroup(sourceData) {
                const data = sourceData || currentSolidData || window.CULVERT_TEST_SOLID_DATA;
                const group = new THREE.Group();
                group.name = "Culvert_3D_Solid_Assembly";
                if (!data || !data.solids) return group;

                function buildPartMesh(part, color, layer) {
                    const geom = new THREE.BufferGeometry();
                    const positions = [];

                    for (const f of part.faces) {
                        if (layer === 'PipeBaseArea' && f.length > 3) {
                            const pts = f.map(ix => part.vertices[ix]);
                            let nx = 0, ny = 0, nz = 0;
                            for (let i = 0; i < pts.length; i++) {
                                const a = pts[i], b = pts[(i + 1) % pts.length];
                                nx += (a[1] - b[1]) * (a[2] + b[2]);
                                ny += (a[2] - b[2]) * (a[0] + b[0]);
                                nz += (a[0] - b[0]) * (a[1] + b[1]);
                            }
                            const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
                            const contour = pts.map(v =>
                                ax >= ay && ax >= az ? new THREE.Vector2(v[1], v[2])
                                    : ay >= az ? new THREE.Vector2(v[0], v[2])
                                        : new THREE.Vector2(v[0], v[1])
                            );
                            let tris = [];
                            try { tris = THREE.ShapeUtils.triangulateShape(contour, []); } catch (e) { }
                            if (tris.length) {
                                for (const tri of tris) for (const j of tri) positions.push(...pts[j]);
                            } else {
                                for (let i = 1; i < f.length - 1; i++) {
                                    for (const ix of [f[0], f[i], f[i + 1]]) positions.push(...part.vertices[ix]);
                                }
                            }
                        } else {
                            for (let i = 1; i < f.length - 1; i++) {
                                for (const ix of [f[0], f[i], f[i + 1]]) positions.push(...part.vertices[ix]);
                            }
                        }
                    }

                    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                    geom.computeVertexNormals();

                    // Solid, dark, non-transparent engineering palette
                    let partColor = color;
                    if (layer === 'Pipe') {
                        partColor = '#1d4ed8';           // Deep solid blue barrel
                    } else if (layer === 'PipeBaseArea') {
                        partColor = '#785634';           // Dark rich bedding cradle
                    } else if (layer === 'LeftWall' || layer === 'RightWall') {
                        partColor = '#475569';           // Dark solid concrete slate
                    } else if (layer === 'PCC' || layer === 'Apron') {
                        partColor = '#334155';           // Deep solid foundation slab
                    } else if (layer === 'StonePitching') {
                        partColor = '#574838';           // Dark solid stone pitching
                    } else if (layer === 'StoneGuard' || layer === 'IncribingPillar') {
                        partColor = '#94a3b8';           // Guide pillars
                    } else if (layer === 'BC' || layer === 'DBM') {
                        partColor = '#0f172a';           // Dark black asphalt road top
                    } else if (layer.startsWith('WMM') || layer.startsWith('GSB') || layer === 'Subgrade') {
                        partColor = '#3f4854';           // Compacted road courses
                    }

                    // 100% Opaque, solid, filled material (no transparency)
                    const mat = new THREE.MeshStandardMaterial({
                        color: new THREE.Color(partColor),
                        roughness: 0.65,
                        metalness: 0.15,
                        transparent: false,
                        opacity: 1.0,
                        depthWrite: true,
                        depthTest: true,
                        side: THREE.DoubleSide
                    });
                    const mesh = new THREE.Mesh(geom, mat);
                    mesh.userData.layer = layer;

                    // Add crisp dark edge outlines so facets look sharp and solid
                    const edgeGeom = new THREE.EdgesGeometry(geom, 28);
                    const edgeLines = new THREE.LineSegments(
                        edgeGeom,
                        new THREE.LineBasicMaterial({ color: 0x0a0e14, linewidth: 1 })
                    );
                    mesh.add(edgeLines);
                    return mesh;
                }

                for (const s of data.solids) {
                    const solidGroup = new THREE.Group();
                    solidGroup.name = `${s.layer} [${s.handle}]`;
                    for (const p of s.parts) {
                        solidGroup.add(buildPartMesh(p, s.color, s.layer));
                    }
                    group.add(solidGroup);
                }

                return group;
            }

            // Function to render / re-render culvert solids across all detected culverts
            function renderCulvertSolids(solidData) {
                // Clear existing culvert models
                while (culvertSolidsGroup.children.length > 0) {
                    const child = culvertSolidsGroup.children[0];
                    culvertSolidsGroup.remove(child);
                    child.traverse(obj => {
                        if (obj.geometry) obj.geometry.dispose();
                        if (obj.material) {
                            if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                            else obj.material.dispose();
                        }
                    });
                }

                if (!solidData || !solidData.solids || !culvertMarkerData.length) return;

                culvertMarkerData.forEach(marker => {
                    const culvertModel = buildCulvertSolidMeshGroup(solidData);
                    culvertModel.scale.set(1, 1, 1);

                    const roadRL = (marker.data && marker.data.RoadRL)
                        ? Number(marker.data.RoadRL)
                        : (Number(marker.rl) + 1.34);

                    const roadWorldPos = toWorld(marker.easting, marker.northing, roadRL);

                    culvertModel.position.set(
                        roadWorldPos.x,
                        roadWorldPos.y - 1.34,
                        roadWorldPos.z
                    );

                    const roadHeading = getAlignmentDirectionAtChainage(marker.data.Chainage || 0);
                    culvertModel.rotation.y = roadHeading;

                    culvertSolidsGroup.add(culvertModel);
                });

                // Update Culvert Parts in unified CAD Layers Drawer
                updateCulvertLayersDrawer(solidData);
            }

            function updateCulvertLayersDrawer(solidData) {
                const layersDrawer = document.getElementById("survey-cad-layers-drawer");
                if (!layersDrawer) return;

                const oldSection = document.getElementById("culvert-parts-container");
                if (oldSection) oldSection.remove();

                const culvertSection = document.createElement("div");
                culvertSection.id = "culvert-parts-container";
                culvertSection.className = "cad-layers-accordion-group";

                const layerStats = new Map();
                solidData.solids.forEach(s => {
                    const lyr = s.layer;
                    const clr = (lyr === 'Pipe') ? '#4a90e2' : (lyr === 'PipeBaseArea' ? '#d4a574' : s.color);
                    const current = layerStats.get(lyr) || { count: 0, color: clr };
                    current.count += s.parts.length;
                    layerStats.set(lyr, current);
                });

                culvertSection.innerHTML = `
                    <div style="display:flex;align-items:center;justify-content:space-between;">
                        <button type="button" class="cad-layers-group-toggle" data-target="cad-group-culvert-parts" style="flex:1;">
                            <span><i class="bi bi-chevron-down cad-accordion-arrow"></i> Culvert Parts</span>
                            <span class="cad-group-badge">${layerStats.size}</span>
                        </button>
                        <div style="display:flex;gap:4px;padding-right:10px;">
                            <button type="button" id="culvert-layers-all" style="background:#21262d;color:#c9d1d9;border:1px solid #30363d;border-radius:3px;padding:1px 5px;font-size:10px;cursor:pointer;">All</button>
                            <button type="button" id="culvert-layers-none" style="background:#21262d;color:#c9d1d9;border:1px solid #30363d;border-radius:3px;padding:1px 5px;font-size:10px;cursor:pointer;">None</button>
                        </div>
                    </div>
                `;

                const partsList = document.createElement("div");
                partsList.id = "cad-group-culvert-parts";
                partsList.className = "cad-layers-list";

                const checkboxMap = new Map();

                Array.from(layerStats.keys()).sort().forEach(layerName => {
                    const stat = layerStats.get(layerName);
                    const row = document.createElement("div");
                    row.style.cssText = "display:flex;align-items:center;gap:7px;padding:3px 2px;";

                    const chk = document.createElement("input");
                    chk.type = "checkbox";
                    chk.checked = true;
                    chk.id = "lyr_chk_" + layerName;
                    chk.style.cursor = "pointer";

                    chk.addEventListener("change", () => {
                        culvertSolidsGroup.traverse(mesh => {
                            if (mesh.userData && mesh.userData.layer === layerName) {
                                mesh.visible = chk.checked;
                            }
                        });
                    });

                    checkboxMap.set(layerName, chk);

                    const swatch = document.createElement("span");
                    swatch.style.cssText = `width:10px;height:10px;border-radius:2px;background:${stat.color};flex:none;`;

                    const lbl = document.createElement("label");
                    lbl.htmlFor = chk.id;
                    lbl.textContent = `${layerName} (${stat.count})`;
                    lbl.style.cssText = "flex:1;cursor:pointer;user-select:none;color:#cfd8e3;font-size:11px;";

                    row.append(chk, swatch, lbl);
                    partsList.appendChild(row);
                });

                culvertSection.appendChild(partsList);
                layersDrawer.appendChild(culvertSection);

                // Wire All / None buttons
                document.getElementById("culvert-layers-all")?.addEventListener("click", () => {
                    checkboxMap.forEach((chk, layerName) => {
                        chk.checked = true;
                        culvertSolidsGroup.traverse(m => {
                            if (m.userData && m.userData.layer === layerName) m.visible = true;
                        });
                    });
                });

                document.getElementById("culvert-layers-none")?.addEventListener("click", () => {
                    checkboxMap.forEach((chk, layerName) => {
                        chk.checked = false;
                        culvertSolidsGroup.traverse(m => {
                            if (m.userData && m.userData.layer === layerName) m.visible = false;
                        });
                    });
                });
            }

            // Initial render of culverts if data is available
            if (currentSolidData && culvertMarkerData.length) {
                renderCulvertSolids(currentSolidData);
                console.info("[CulvertCAD] Initial 3D Culvert Solids rendered at detected culvert locations:", culvertMarkerData.length);
            }

            // Fetch saved 3D solid model from MongoDB for this project if available
            if (currentProjectId > 0) {
                fetch(`/Survey/GetCulvertSolid?projectId=${currentProjectId}`)
                    .then(res => res.ok ? res.json() : null)
                    .then(dbSolid => {
                        if (dbSolid && dbSolid.solids && dbSolid.solids.length > 0) {
                            currentSolidData = dbSolid;
                            try {
                                sessionStorage.setItem("culvert_cad_active_solid", JSON.stringify(dbSolid));
                            } catch (e) {}
                            renderCulvertSolids(dbSolid);
                            console.info(`[CulvertCAD] Rendered 3D culvert solid model loaded from MongoDB for project ${currentProjectId}.`);
                        }
                    })
                    .catch(err => {
                        console.warn("[CulvertCAD] Failed to fetch culvert solid from MongoDB:", err);
                    });
            }

            // 3D Culvert Structure Toolbar Toggle Button
            const toggleSolidsBtn = document.getElementById("survey-map-toggle-culvert-solids");
            if (toggleSolidsBtn) {
                toggleSolidsBtn.addEventListener("click", () => {
                    culvertSolidsGroup.visible = !culvertSolidsGroup.visible;
                    toggleSolidsBtn.setAttribute("aria-pressed", String(culvertSolidsGroup.visible));
                    toggleSolidsBtn.innerHTML = culvertSolidsGroup.visible
                        ? '<i class="bi bi-box"></i> 3D Culvert: On'
                        : '<i class="bi bi-box"></i> 3D Culvert: Off';
                });
            }

            // Wire Import Culvert Button & File Input
            async function handleCulvertHtmlFile(file) {
                if (!window.CulvertHtmlReader) {
                    console.error("[CulvertCAD] CulvertHtmlReader is not loaded.");
                    return;
                }
                try {
                    const solidModel = await window.CulvertHtmlReader.parse(file);
                    currentSolidData = solidModel;
                    try {
                        sessionStorage.setItem("culvert_cad_active_solid", JSON.stringify(solidModel));
                    } catch (e) {}
                    renderCulvertSolids(solidModel);
                    console.info(`[CulvertCAD] Successfully loaded culvert model '${file.name}' with ${solidModel.solids.length} solids.`);

                    // Background persist to MongoDB for this project
                    if (currentProjectId > 0) {
                        fetch('/Survey/SaveCulvertSolid', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                projectId: currentProjectId,
                                fileName: file.name,
                                modelType: '3D_SOLID',
                                solidDataJson: JSON.stringify(solidModel)
                            })
                        })
                        .then(res => res.json())
                        .then(data => {
                            if (data.success) {
                                console.info(`[CulvertCAD] 3D culvert model saved to MongoDB for project ${currentProjectId}:`, data);
                            }
                        })
                        .catch(err => console.warn("[CulvertCAD] Failed to persist solid model to DB:", err));
                    }
                } catch (err) {
                    console.error("[CulvertCAD] Failed to parse culvert HTML:", err);
                    alert("Failed to parse culvert HTML file: " + (err.message || err));
                }
            }

            const importCulvertBtn = document.getElementById("survey-map-import-culvert");
            const importCulvertInput = document.getElementById("survey-culvert-html-file");
            if (importCulvertBtn && importCulvertInput) {
                importCulvertBtn.addEventListener("click", () => importCulvertInput.click());
                importCulvertInput.addEventListener("change", async (e) => {
                    const file = e.target.files && e.target.files[0];
                    if (!file) return;
                    await handleCulvertHtmlFile(file);
                    importCulvertInput.value = "";
                });
            }

            // Canvas drag and drop for Culvert HTML
            const mapContainerEl = document.getElementById("survey-map-container") || document.getElementById("survey-map-canvas");
            if (mapContainerEl) {
                mapContainerEl.addEventListener("dragenter", (e) => {
                    e.preventDefault();
                    mapContainerEl.style.outline = "3px dashed #00b4d8";
                    mapContainerEl.style.outlineOffset = "-6px";
                });
                mapContainerEl.addEventListener("dragover", (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                    mapContainerEl.style.outline = "3px dashed #00b4d8";
                    mapContainerEl.style.outlineOffset = "-6px";
                });
                mapContainerEl.addEventListener("dragleave", (e) => {
                    if (e.target === mapContainerEl) {
                        mapContainerEl.style.outline = "";
                    }
                });
                mapContainerEl.addEventListener("drop", async (e) => {
                    e.preventDefault();
                    mapContainerEl.style.outline = "";
                    const file = e.dataTransfer.files && e.dataTransfer.files[0];
                    if (file && (file.name.endsWith(".html") || file.name.endsWith(".htm"))) {
                        await handleCulvertHtmlFile(file);
                    }
                });
            }

            // Temporary labels for identifying culvert locations during terrain diagnostics.
            const culvertLabels = new THREE.Group();
            culvertLabels.name = "Temporary culvert location labels";

            culvertMarkerData.forEach(marker => {
                const label = document.createElement("div");
                label.textContent = String(marker.data.LocationIndex);
                label.style.cssText = `
                 color: #ffffff;
                 background: #198754;
                 border: 1px solid #ffffff;
                 border-radius: 50%;
                 width: 24px;
                 height: 24px;
                 display: flex;
                 align-items: center;
                 justify-content: center;
                 font-size: 12px;
                 font-weight: bold;
                 `;
            });

            // Culvert specification information box.
            const infoBox = document.createElement("div");

            infoBox.id = "survey-culvert-info";
            infoBox.style.cssText = `
                position: absolute;
                display: none;
                z-index: 1000;
                width: 300px;
                max-width: calc(100% - 16px);
                max-height: 70%;
                overflow-y: auto;
                box-sizing: border-box;
                padding: 18px;
                background: #f8f9fa;
                color: #212529;
                border: 1px solid #ced4da;
                border-radius: 10px;
                box-shadow: 0 4px 14px rgba(33, 37, 41, 0.12);
                font-family: inherit;
                font-size: 13px;
                line-height: 1.6;
                pointer-events: auto;
            `;

            const mapWorkspace = document.getElementById("survey-map-container");
            mapWorkspace.style.position = "relative";
            mapWorkspace.appendChild(infoBox);

            const culvertRaycaster = new THREE.Raycaster();
            culvertRaycaster.params.Points.threshold = 12;

            let selectedCulvertIndex = -1;

            const showCulvertInfo = (index, event) => {
                const markerData = culvertMarkerData[index];
                if (!markerData) return;

                const data = markerData.data;

                const formatValue = (value, decimals = 3) =>
                    Number.isFinite(Number(value))
                        ? Number(value).toFixed(decimals)
                        : String(value);

                const rows = [
                    {
                        section: "Identification & Status"
                    },
                    ["Culvert Reference", `Location ${data.LocationIndex}`],
                    ["Detection Method", data.IsManual ? "Manual" : "Automatic"],
                    ["Review Status", data.IsConfirmed ? "Confirmed" : "Pending"],
                    ["Design Status", data.DesignId != null ? "Design Created" : "Not Created"],

                    {
                        section: "Location & Survey"
                    },
                    ["Chainage (m)", formatValue(data.Chainage)],
                    ["Easting Coordinate (m)", formatValue(markerData.easting)],
                    ["Northing Coordinate (m)", formatValue(markerData.northing)],
                    ["Average Ground Level (m)", formatValue(markerData.rl)],
                    ["Distance from Alignment (m)", formatValue(data.DistToAlignment)],
                    ["Associated Survey Points", String(data.SurveyPointCount)],
                    ["Survey Point Numbers", (data.SurveyPointNos || []).join(", ")],

                    {
                        section: "Levels & Ground Conditions"
                    },
                    ["Invert Level (RL) (m)", formatValue(data.InvertRL)],
                    ["Road Level (RL) (m)", formatValue(data.RoadRL)],
                    ["Fill Height (m)", formatValue(data.FillHeightM)],
                    ["Bed Slope (%)", `${formatValue(data.BedSlopePct)}%`]
                ];

                infoBox.replaceChildren();

                // Card heading
                const header = document.createElement("div");
                header.textContent = "Culvert Specifications";
                header.style.cssText = `
                    font-size: 15px;
                    font-weight: 600;
                    color: #212529;
                    padding-bottom: 12px;
                    margin-bottom: 10px;
                    border-bottom: 1px solid #dee2e6;
                    `;

                infoBox.appendChild(header);

                // Specification rows

                // Specification rows and section headings.
                rows.forEach((item, index) => {
                    if (item.section) {
                        const section = document.createElement("div");
                        section.textContent = item.section;
                        section.style.cssText = `
                            font-size: 13px;
                            font-weight: 600;
                            color: #212529;
                            padding-top: 12px;
                            padding-bottom: 5px;
                            border-bottom: 1px solid #dee2e6;
                        `;

                        infoBox.appendChild(section);
                        return;
                    }

                    const [label, value] = item;

                    const row = document.createElement("div");
                    row.style.cssText = `
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        gap: 12px;
                        padding: 7px 0;
                        border-bottom: 1px solid #e9ecef;
                    `;

                    const labelElement = document.createElement("span");
                    labelElement.textContent = label;
                    labelElement.style.cssText = `
                        color: #6c757d;
                        flex: 1;
                        min-width: 0;
                        overflow-wrap: anywhere;
                    `;

                    const valueElement = document.createElement("span");
                    valueElement.textContent = String(value);
                    valueElement.style.cssText = `
                        color: #212529;
                        font-weight: 500;
                        text-align: right;
                        flex: 1;
                        min-width: 0;
                        overflow-wrap: anywhere;
                    `;

                    row.appendChild(labelElement);
                    row.appendChild(valueElement);
                    infoBox.appendChild(row);
                });

                infoBox.style.display = "block";

                if (event) {
                    const workspaceRect = mapWorkspace.getBoundingClientRect();

                    let left = event.clientX - workspaceRect.left + 14;
                    let top = event.clientY - workspaceRect.top + 14;

                    const cardWidth = infoBox.offsetWidth;
                    const cardHeight = infoBox.offsetHeight;

                    if (left + cardWidth > workspaceRect.width - 8) {
                        left = event.clientX - workspaceRect.left - cardWidth - 14;
                    }

                    if (top + cardHeight > workspaceRect.height - 8) {
                        top = event.clientY - workspaceRect.top - cardHeight - 14;
                    }

                    left = Math.max(
                        8,
                        Math.min(left, workspaceRect.width - cardWidth - 8)
                    );

                    top = Math.max(
                        8,
                        Math.min(top, workspaceRect.height - cardHeight - 8)
                    );

                    infoBox.style.left = `${left}px`;
                    infoBox.style.top = `${top}px`;
                }
            };

            const findCulvertAtPointer = (event) => {
                const rect = renderer.domElement.getBoundingClientRect();

                const pointer = new THREE.Vector2(
                    ((event.clientX - rect.left) / rect.width) * 2 - 1,
                    -((event.clientY - rect.top) / rect.height) * 2 + 1
                );

                culvertRaycaster.setFromCamera(pointer, camera);

                const hits = culvertRaycaster.intersectObject(markers);

                return hits.length ? hits[0].index : -1;
            };

            // Change cursor to hand/pointer on hover so user knows it is clickable
            renderer.domElement.addEventListener("pointermove", (event) => {
                const index = findCulvertAtPointer(event);
                renderer.domElement.style.cursor = (index !== -1) ? "pointer" : "default";
            });

            // Show card ONLY when explicitly clicked
            // Smooth Camera Glide Function
            let cameraGlideAnimation = null;
            function glideCameraTo(targetPos, viewDistance = 16) {
                if (!controls) return;

                const startTarget = controls.target.clone();
                const endTarget = targetPos.clone();

                const startCameraPos = camera.position.clone();
                // Position camera offset at a natural 3D view angle
                const endCameraPos = new THREE.Vector3(
                    endTarget.x + viewDistance * 0.7,
                    endTarget.y + viewDistance * 0.5,
                    endTarget.z + viewDistance * 0.7
                );

                const startTime = performance.now();
                const duration = 1000; // 1 second smooth glide

                function updateGlide(now) {
                    const progress = Math.min((now - startTime) / duration, 1.0);
                    // Smooth cubic ease-in-out
                    const ease = progress < 0.5
                        ? 4 * progress * progress * progress
                        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

                    controls.target.lerpVectors(startTarget, endTarget, ease);
                    camera.position.lerpVectors(startCameraPos, endCameraPos, ease);
                    controls.update();

                    if (progress < 1.0) {
                        cameraGlideAnimation = requestAnimationFrame(updateGlide);
                    } else {
                        cameraGlideAnimation = null;
                    }
                }

                if (cameraGlideAnimation) cancelAnimationFrame(cameraGlideAnimation);
                cameraGlideAnimation = requestAnimationFrame(updateGlide);
            }

            // Show card AND smoothly glide camera to culvert when clicked
            renderer.domElement.addEventListener("click", (event) => {
                const index = findCulvertAtPointer(event);

                if (index !== -1) {
                    // selectedCulvertIndex = index;
                    // showCulvertInfo(index, event);

                    // Smoothly focus camera on this culvert
                    const marker = culvertMarkerData[index];
                    if (marker) {
                        glideCameraTo(marker.position, 16);
                    }
                } else if (!infoBox.contains(event.target)) {
                    selectedCulvertIndex = -1;
                    infoBox.style.display = "none";
                }
            });
        }

        const span = Math.max(maxE - minE, maxN - minN, 10);
        const target = new THREE.Vector3(
            0,
            ((maxRL - minRL) * verticalExaggeration) / 2,
            0
        );

        const initialDistance = span * 1.2;

        const setCameraView = (view) => {
            const width = canvas.clientWidth || 800;
            const height = canvas.clientHeight || 600;
            const aspect = width / height;

            camera.aspect = aspect;
            camera.updateProjectionMatrix();

            const verticalSpan = Math.max(
                (maxRL - minRL) * verticalExaggeration,
                10
            );

            const horizontalSpan = Math.max(
                maxE - minE,
                maxN - minN,
                10
            );

            const verticalFov = THREE.MathUtils.degToRad(camera.fov);
            const horizontalFov = 2 * Math.atan(
                Math.tan(verticalFov / 2) * aspect
            );

            const distanceForWidth =
                (horizontalSpan / 2) / Math.tan(horizontalFov / 2);

            const distanceForHeight =
                (verticalSpan / 2) / Math.tan(verticalFov / 2);

            const distance = Math.max(
                distanceForWidth,
                distanceForHeight
            ) * 1.25;

            if (view === "top" || view === "north") {
                camera.position.set(
                    target.x,
                    target.y + distance,
                    target.z
                );
                camera.up.set(0, 0, -1);
            } else {
                camera.up.set(0, 1, 0);
                camera.position.set(
                    target.x + distance * 0.65,
                    target.y + distance * 0.65,
                    target.z + distance * 0.65
                );
            }

            camera.lookAt(target);

            if (controls) {
                controls.target.copy(target);
                controls.update();
            }
        };

        camera.position.set(
            target.x + initialDistance * 0.65,
            target.y + initialDistance * 0.65,
            target.z + initialDistance * 0.65
        );
        camera.lookAt(target);

        let controls = null;

        if (THREE.OrbitControls) {
            controls = new THREE.MapControls(camera, renderer.domElement);
            controls.target.copy(target);
            controls.enableDamping = true;
            controls.dampingFactor = 0.08;
            controls.zoomSpeed = 0.75;
            controls.panSpeed = 1.0;
            controls.rotateSpeed = 0.8;

            // Prevent the camera from getting too close to the terrain.
            controls.minDistance = 0.000005;

            // Prevent zooming so far out that the model becomes difficult to find.
            controls.maxDistance = Math.max(500, span * 10);

            // Enable rotation, zoom and panning.
            controls.enableRotate = true;
            controls.enableZoom = true;
            controls.enablePan = true;

            // Right mouse button pans the map.
            controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
            controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
            controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;

            controls.update();
        }

        const resize = () => {
            const width = canvas.clientWidth;
            const height = canvas.clientHeight;

            if (!width || !height) return;

            renderer.setSize(width, height, false);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        };

        // Full-screen survey map workspace
        const mapContainer = document.getElementById("survey-map-container");
        const fullScreenButton = document.getElementById("survey-map-fullscreen");

        fullScreenButton?.addEventListener("click", async () => {
            if (!mapContainer) return;

            try {
                if (!document.fullscreenElement) {
                    await mapContainer.requestFullscreen();
                } else {
                    await document.exitFullscreen();
                }
            } catch (error) {
                console.error("Survey map full-screen error:", error);
                status.textContent = "Could not open the map in full-screen mode.";
            }
        });

        document.addEventListener("fullscreenchange", () => {
            const isFullScreen = document.fullscreenElement === mapContainer;

            if (fullScreenButton) {
                fullScreenButton.innerHTML = isFullScreen
                    ? '<i class="bi bi-arrows-angle-contract"></i> Exit Full Screen'
                    : '<i class="bi bi-arrows-angle-expand"></i> Expand Map';
            }

            // Resize the renderer and camera after the container changes size.
            requestAnimationFrame(() => {
                resize();

                if (window.surveyLeafletMap) {
                    window.surveyLeafletMap.invalidateSize();
                }
            });
        });

        // Survey map navigation buttons
        document.getElementById("survey-map-recenter")?.addEventListener("click", () => {
            window.setSurveyMapMode?.("3d");
            setCameraView("3d");
        });

        document.getElementById("survey-map-top-view")?.addEventListener("click", () => {
            window.setSurveyMapMode?.("top");
            setCameraView("top");
        });

        document.getElementById("survey-map-3d-view")?.addEventListener("click", () => {
            window.setSurveyMapMode?.("3d");
            setCameraView("3d");
        });

        document.getElementById("survey-map-north-up")?.addEventListener("click", () => {
            setCameraView("north");
        });

        // Toggle & Close Floating CAD Layers Drawer
        const cadLayersDrawer = document.getElementById("survey-cad-layers-drawer");
        document.getElementById("survey-cad-layers-toggle")?.addEventListener("click", () => {
            if (cadLayersDrawer) {
                cadLayersDrawer.classList.toggle("collapsed");
            }
        });
        document.getElementById("survey-cad-layers-close")?.addEventListener("click", () => {
            if (cadLayersDrawer) {
                cadLayersDrawer.classList.add("collapsed");
            }
        });

        // Generic accordion collapse/expand for all layer groups
        document.getElementById("survey-cad-layers-drawer")?.addEventListener("click", (e) => {
            const toggleBtn = e.target.closest(".cad-layers-group-toggle");
            if (!toggleBtn) return;
            const targetId = toggleBtn.getAttribute("data-target");
            const targetList = document.getElementById(targetId);
            if (!targetList) return;

            const isCollapsed = targetList.classList.toggle("cad-group-collapsed");
            const arrow = toggleBtn.querySelector(".cad-accordion-arrow");
            if (arrow) {
                arrow.classList.toggle("bi-chevron-down", !isCollapsed);
                arrow.classList.toggle("bi-chevron-right", isCollapsed);
            }
        });

        window.addEventListener("resize", resize);
        resize();

        const animate = () => {
            requestAnimationFrame(animate);

            if (controls) controls.update();

            renderer.render(scene, camera);
        };

        animate();

        status.textContent = "";

        document.getElementById("survey-map-point-count").textContent =
            validSurvey.length.toLocaleString();

        document.getElementById("survey-map-alignment-count").textContent =
            validAlignment.length.toLocaleString();

        document.getElementById("survey-map-culvert-count").textContent =
            culverts.length.toLocaleString();
    } catch (error) {
        console.error("Survey map error:", error);
        status.textContent =
            "The survey map could not be rendered. Check the browser console for details.";
    }
})();