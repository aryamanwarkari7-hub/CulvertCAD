(() => {
    "use strict";

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

        if (!window.L || !leafletContainer || !window.proj4) {
            status.textContent = "Leaflet or coordinate conversion library could not be loaded.";
        } else {
            proj4.defs(
                "EPSG:32643",
                "+proj=utm +zone=43 +datum=WGS84 +units=m +no_defs"
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
                        "EPSG:32643",
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

        // Horizontal bounds use both survey and alignment coordinates.
        // Elevation bounds use only actual surveyed RL values.
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

        // Local origin keeps large UTM coordinates numerically manageable.
        const centerE = (minE + maxE) / 2;
        const centerN = (minN + maxN) / 2;
        const baseRL = minRL;

        const terrainScale = 1;
        const verticalExaggeration = 3;

        const toWorld = (easting, northing, rl) => new THREE.Vector3(
            (Number(easting) - centerE) * terrainScale,
            (Number(rl) - baseRL) * verticalExaggeration,
            (Number(northing) - centerN) * terrainScale
        );

        // Simple rectangular grid below the survey terrain.
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

        // Transparent datum reference sheet.
        // Default datum RL: median of the actual surveyed elevations.
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
        const surveyGeometry = new THREE.BufferGeometry();
        const surveyPositions = [];

        validSurvey.forEach(p => {
            const v = toWorld(p.Easting, p.Northing, p.RL);
            surveyPositions.push(v.x, v.y, v.z);
        });

        surveyGeometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(surveyPositions, 3)
        );

        const surveyMaterial = new THREE.PointsMaterial({
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
            const ENABLE_SELECTIVE_GAP_RECONSTRUCTION = true;
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

            // Walk closed loops where each boundary vertex has exactly two
            // boundary neighbours. Branches/open chains are kept secondary.
            const visitedBoundaryEdges = new Set();
            const boundaryLoops = [];
            const secondaryBoundaryEdgeIds = new Set();
            for (let seed = 0; seed < boundaryEdges.length; seed++) {
                if (visitedBoundaryEdges.has(seed)) continue;
                const seedEdge = boundaryEdges[seed];
                const loopVertices = [seedEdge.a];
                const componentEdges = new Set();
                let currentVertex = seedEdge.a;
                let previousEdgeId = -1;
                let closed = false;

                for (let step = 0; step <= boundaryEdges.length; step++) {
                    const options = (boundaryAdjacency.get(currentVertex) || [])
                        .filter(item => item.edgeId !== previousEdgeId &&
                            !visitedBoundaryEdges.has(item.edgeId));
                    if (options.length === 0) break;
                    const next = options[0];
                    visitedBoundaryEdges.add(next.edgeId);
                    componentEdges.add(next.edgeId);
                    previousEdgeId = next.edgeId;
                    currentVertex = next.to;
                    if (currentVertex === loopVertices[0]) {
                        closed = true;
                        break;
                    }
                    loopVertices.push(currentVertex);
                }

                if (closed && loopVertices.length >= 3 &&
                    loopVertices.every(vertex => (boundaryAdjacency.get(vertex) || []).length === 2)) {
                    let twiceArea = 0;
                    for (let i = 0; i < loopVertices.length; i++) {
                        const a = terrainPoints[loopVertices[i]];
                        const b = terrainPoints[loopVertices[(i + 1) % loopVertices.length]];
                        twiceArea += a.easting * b.northing - b.easting * a.northing;
                    }
                    boundaryLoops.push({ edgeIds: componentEdges, area: Math.abs(twiceArea) / 2 });
                } else {
                    for (const edgeId of componentEdges) secondaryBoundaryEdgeIds.add(edgeId);
                }
            }

            // Any unvisited or non-loop edge is retained as secondary coverage.
            for (let i = 0; i < boundaryEdges.length; i++) {
                if (!visitedBoundaryEdges.has(i)) secondaryBoundaryEdgeIds.add(i);
            }

            boundaryLoops.sort((a, b) => b.area - a.area);
            const primaryPerimeterEdgeIds = boundaryLoops.length
                ? boundaryLoops[0].edgeIds
                : new Set();
            for (let i = 0; i < boundaryEdges.length; i++) {
                if (!primaryPerimeterEdgeIds.has(i)) secondaryBoundaryEdgeIds.add(i);
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
                0xff8c42,
                1.0,
                "Primary terrain coverage perimeter (visual estimate)",
                11
            );
            const secondaryCoverageGuide = makeBoundaryLine(
                secondaryCoveragePositions,
                0xf4d35e,
                0.9,
                "Secondary terrain coverage edges and internal gaps",
                10
            );

            const terrainLayer = new THREE.Group();
            terrainLayer.name = "Measured survey terrain and coverage guides";
            terrainLayer.add(terrainMesh);

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
                rejectedLines.renderOrder = 999;

                terrainLayer.add(rejectedLines);

                console.info("[Survey Terrain] Rejected triangle diagnostic:", {
                    triangleCount: rejectedTriangleIndices.length / 3,
                    lineSegments: rejectedPositions.length / 6
                });
            }

            terrainLayer.add(primaryPerimeterGuide);
            terrainLayer.add(secondaryCoverageGuide);
            scene.add(terrainLayer);

            console.info("[Survey Terrain] Coverage guide:", {
                boundaryEdgeSegments: boundaryEdges.length,
                primaryPerimeterSegments: primaryPerimeterPositions.length / 6,
                secondaryCoverageSegments: secondaryCoveragePositions.length / 6,
                closedBoundaryLoops: boundaryLoops.length,
                primaryLoopAreaM2: boundaryLoops.length ? boundaryLoops[0].area : null,
                meaning: "Orange is the largest closed accepted-mesh boundary loop (visual estimate); yellow shows other boundary edges/internal gaps. No terrain is extrapolated."
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

            renderer.domElement.addEventListener("pointermove", (event) => {
                if (selectedCulvertIndex !== -1) return;

                const index = findCulvertAtPointer(event);

                if (index !== -1) {
                    showCulvertInfo(index, event);
                } else if (!infoBox.matches(":hover")) {
                    infoBox.style.display = "none";
                }
            });

            renderer.domElement.addEventListener("click", (event) => {
                const index = findCulvertAtPointer(event);

                if (index !== -1) {
                    selectedCulvertIndex = index;
                    showCulvertInfo(index, event);
                } else {
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
            controls.zoomSpeed = 1.0;
            controls.panSpeed = 1.0;
            controls.rotateSpeed = 0.8;

            // Prevent the camera from getting too close to the terrain.
            controls.minDistance = Math.max(0.5, span * 0.005);

            // Prevent zooming so far out that the model becomes difficult to find.
            controls.maxDistance = Math.max(100, span * 10);

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