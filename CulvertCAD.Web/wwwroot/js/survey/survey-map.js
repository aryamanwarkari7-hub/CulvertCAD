
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
                color: 0x626d78,
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
                rl: Number(p.RL)
            }));

            const triangulation = window.Delaunator.from(
                terrainPoints,
                p => (p.easting - centerE) * terrainScale,
                p => (p.northing - centerN) * terrainScale
            );

            const terrainGeometry = new THREE.BufferGeometry();
            const terrainPositions = [];
            const terrainColors = [];

            const naturalColor = new THREE.Color(0x90EE90); // Light green terrain
            const fallColor = new THREE.Color(0xA98262);    // Light earthy brown slopes

            // Classify each triangle independently by its slope.
            const triangles = triangulation.triangles;
            const FALL_SLOPE_THRESHOLD = 30; // degrees

            for (let i = 0; i < triangles.length; i += 3) {
                const ia = triangles[i];
                const ib = triangles[i + 1];
                const ic = triangles[i + 2];

                const a = terrainPoints[ia];
                const b = terrainPoints[ib];
                const c = terrainPoints[ic];

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
            }

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

            const terrainLayer = terrainMesh;
            scene.add(terrainLayer);

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

            const roadMaterial = new THREE.MeshStandardMaterial({
                color: 0x50545a,
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
