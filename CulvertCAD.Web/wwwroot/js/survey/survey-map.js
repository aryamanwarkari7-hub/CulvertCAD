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

        // =====================================================
        //
        // Purpose:
        // Read JSON data embedded in the page by the ASP.NET
        // Core application.
        //
        // The application prepares the data; this JavaScript
        // reads it for subsequent visualization and processing.
        //
        // =====================================================

        const readJson = (id) => {
            const element = document.getElementById(id);
            return element ? JSON.parse(element.textContent || "null") : null;
        };

        // Survey observations supplied by the application.
        const surveyPoints = readJson("survey-map-points-data") || [];

        // Coordinate Reference System associated with the survey.
        const workingCrs = readJson("survey-map-working-crs-data");

        // =====================================================
        // SECTION 03: CRS VALIDATION AND 2D MAP INITIALIZATION
        // =====================================================
        //
        // Purpose:
        // Validate the survey coordinate reference system and
        // prepare Leaflet for geographic map visualization.
        //
        // Three.js displays the survey in local 3D coordinates.
        // Leaflet displays the same survey geographically on
        // an OpenStreetMap background.
        //
        // proj4 converts between projected survey coordinates
        // (Easting, Northing) and geographic coordinates
        // (Longitude, Latitude).
        //
        // =====================================================

        if (!window.L || !leafletContainer || !window.proj4) {
            // Stop 2D map initialization if Leaflet, its HTML
            // container or the coordinate conversion library
            // is unavailable.
            status.textContent =
                "Leaflet or coordinate conversion library could not be loaded.";
        } else {

            // Currently supported CRS:
            // WGS84 / UTM Northern Hemisphere, zones 42–47.
            //
            // Example: EPSG:32643 represents UTM Zone 43N.
            // The application must supply the working CRS in
            // the expected EPSG format.
            const utmMatch =
                typeof workingCrs === "string"
                    ? workingCrs.match(/^EPSG:326(4[2-7])$/)
                    : null;

            // Reject missing or unsupported coordinate systems.
            if (!utmMatch) {
                throw new Error(
                    `Unsupported or missing survey CRS: ${workingCrs}`
                );
            }

            // Extract the UTM zone number from the EPSG code.
            const utmZone = Number(utmMatch[1]);

            // Define the working CRS for proj4.
            // Coordinates are expressed in metres using WGS84.
            proj4.defs(
                workingCrs,
                `+proj=utm +zone=${utmZone} +datum=WGS84 +units=m +no_defs`
            );

            // Create the Leaflet map inside its HTML container.
            const leafletMap = L.map(leafletContainer);

            // Keep the Leaflet map hidden initially.
            // The 3D Three.js viewer is the initial display.
            leafletContainer.style.display = "none";

            // Add OpenStreetMap as the geographic background.
            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: "&copy; OpenStreetMap contributors"
            }).addTo(leafletMap);

            // Make the Leaflet map accessible to other functions
            // in the application through the global window object.
            window.surveyLeafletMap = leafletMap;

            // Switch between the geographic 2D map and the
            // Three.js 3D survey viewer.
            window.setSurveyMapMode = function (mode) {

                const leaflet = document.getElementById("survey-leaflet-map");
                const surveyCanvas = document.getElementById("survey-map-canvas");

                // Only the explicit "2d" mode displays Leaflet.
                const show2D = mode === "2d";

                if (leaflet) {
                    leaflet.style.display = show2D ? "block" : "none";
                    leaflet.style.visibility = show2D ? "visible" : "hidden";
                    leaflet.style.pointerEvents = show2D ? "auto" : "none";

                    // Leaflet needs its dimensions recalculated
                    // when its container becomes visible.
                    if (show2D && window.surveyLeafletMap) {
                        window.surveyLeafletMap.invalidateSize();
                    }
                }

                // Display Three.js whenever the 2D map is hidden.
                if (surveyCanvas) {
                    surveyCanvas.style.display = show2D ? "none" : "block";
                }
            };
        }

        // =====================================================
        // SECTION 04: ALIGNMENT AND CULVERT DATA
        // =====================================================
        //
        // Purpose:
        // Read the remaining datasets required by the survey
        // viewer.
        //
        // Three primary spatial inputs are now available:
        //
        // 1. Survey points:
        //    Actual surveyed Easting, Northing and RL values.
        //
        // 2. Alignment points:
        //    Imported road alignment coordinates and chainage.
        //
        // 3. Culvert records:
        //    Detected culvert locations and their associated
        //    survey point references.
        //
        // These datasets are prepared by the application.
        // Subsequent sections determine how each is visualized.
        //
        // =====================================================

        // Read imported road alignment data.
        const alignmentPoints = readJson("survey-map-alignment-data") || [];

        // Read detected culvert location records.
        const culverts = readJson("survey-map-culverts-data") || [];

        // At least one spatial dataset must be available:
        // survey observations or alignment coordinates.
        //
        // Without either dataset, the 3D viewer cannot establish
        // a meaningful horizontal spatial extent.
        if (!surveyPoints.length && !alignmentPoints.length) {
            status.textContent = "No survey or alignment points are available.";
            return;
        }

        // Access the Three.js library for subsequent scene,
        // geometry, coordinate transformation and rendering work.
        const THREE = window.THREE;

        // =====================================================
        // SECTION 05: THREE.JS SCENE INITIALIZATION
        // =====================================================
        //
        // Purpose:
        // Establish the 3D environment in which survey terrain,
        // alignment geometry, culvert locations and other
        // visualization elements will be displayed.
        //
        // Three.js uses three main components:
        //
        // Scene:
        //    Container holding all 3D objects and lights.
        //
        // Camera:
        //    Defines the viewing position and perspective.
        //
        // Renderer:
        //    Draws the scene onto the HTML canvas.
        //
        // =====================================================

        // Create the main 3D scene.
        const scene = new THREE.Scene();

        // Keep the scene background transparent so the canvas
        // can use the background styling of its parent element.
        scene.background = null;

        // -----------------------------------------------------
        // Perspective Camera
        // -----------------------------------------------------
        //
        // A perspective camera provides a 3D viewing effect.
        //
        // Parameters:
        // 50     = Vertical field of view in degrees.
        // 1      = Initial aspect ratio (updated during resize).
        // 0.5    = Minimum camera viewing distance.
        // 50000  = Maximum camera viewing distance.
        //
        // The camera position and orientation are configured
        // later, after the survey spatial bounds are calculated.
        //
        // -----------------------------------------------------

        const camera = new THREE.PerspectiveCamera(
            50,
            1,
            0.5,
            50000
        );

        // -----------------------------------------------------
        // WebGL Renderer
        // -----------------------------------------------------
        //
        // Connect the Three.js scene to the existing HTML canvas.
        //
        // antialias:
        //    Reduces visible jagged edges.
        //
        // alpha:
        //    Allows a transparent canvas background.
        //
        // logarithmicDepthBuffer:
        //    Improves depth-buffer precision across large
        //    viewing-distance ranges.
        //
        // pixelRatio:
        //    Limits rendering resolution to a maximum device
        //    pixel ratio of 2 to balance quality and performance.
        //
        // -----------------------------------------------------

        const renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: true,
            logarithmicDepthBuffer: true
        });

        // Explicitly keep the renderer background transparent.
        renderer.setClearColor(0x000000, 0);

        // Set the renderer's pixel density according to the device.
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

        // -----------------------------------------------------
        // Scene Lighting
        // -----------------------------------------------------
        //
        // Purpose:
        // Provide illumination so terrain relief and 3D objects
        // can be visually distinguished.
        //
        // Ambient light:
        //    Provides general illumination from all directions.
        //
        // Directional light:
        //    Simulates light coming from a particular direction
        //    and produces surface shading.
        //
        // Sky fill light:
        //    Provides additional illumination from another
        //    direction to soften darker areas.
        //
        // These lighting settings affect visualization only.
        // They do not modify survey elevations or geometry.
        //
        // -----------------------------------------------------

        // General illumination across the scene.
        scene.add(new THREE.AmbientLight(0xffffff, 0.65));

        // Main directional light.
        const sunLight = new THREE.DirectionalLight(0xfff8ee, 1.35);
        sunLight.position.set(250, 600, 350);
        scene.add(sunLight);

        // Secondary directional fill light.
        const skyFillLight = new THREE.DirectionalLight(0x7da4d4, 0.45);
        skyFillLight.position.set(-250, 400, -350);
        scene.add(skyFillLight);

        // =====================================================
        // SECTION 06: SURVEY AND ALIGNMENT DATA VALIDATION
        // =====================================================
        //
        // Purpose:
        // Identify usable survey and alignment records before
        // using them for spatial processing and visualization.
        //
        // Survey points require:
        //    Easting  - Horizontal coordinate (X)
        //    Northing - Horizontal coordinate (Y / Z)
        //    RL       - Reduced Level / ground elevation
        //
        // Alignment points require:
        //    Easting  - Horizontal coordinate
        //    Northing - Horizontal coordinate
        //
        // Survey points provide terrain elevations.
        // Alignment points provide the road's horizontal path.
        //
        // =====================================================

        // -----------------------------------------------------
        // 6.1 Validate Survey Points
        // -----------------------------------------------------
        //
        // Retain survey records whose Easting, Northing and RL
        // values can be converted into finite JavaScript numbers.
        //
        // These valid records will subsequently be used for:
        //    - Survey point visualization.
        //    - Terrain triangulation.
        //    - Elevation calculations.
        //    - Culvert location association.
        //
        // -----------------------------------------------------

        const validSurvey = surveyPoints.filter(p =>
            Number.isFinite(Number(p.Easting)) &&
            Number.isFinite(Number(p.Northing)) &&
            Number.isFinite(Number(p.RL))
        );

        // -----------------------------------------------------
        // 6.2 Position the Survey on the 2D Geographic Map
        // -----------------------------------------------------
        //
        // Leaflet requires geographic coordinates:
        //    Latitude and Longitude.
        //
        // Survey data is stored in projected coordinates:
        //    Easting and Northing.
        //
        // proj4 converts the survey coordinates from the
        // working UTM CRS into geographic EPSG:4326.
        //
        // The resulting coordinates are supplied to Leaflet
        // so that the map automatically frames the survey area.
        //
        // -----------------------------------------------------

        if (window.surveyLeafletMap && validSurvey.length > 0) {
            const geographicPoints = validSurvey
                .map(p => {
                    const easting = Number(p.Easting);
                    const northing = Number(p.Northing);

                    if (!Number.isFinite(easting) || !Number.isFinite(northing)) {
                        return null;
                    }

                    // Convert projected coordinates into:
                    // [Longitude, Latitude]
                    const [longitude, latitude] = proj4(
                        workingCrs,
                        "EPSG:4326",
                        [easting, northing]
                    );

                    // Leaflet expects:
                    // [Latitude, Longitude]
                    return [latitude, longitude];
                })
                .filter(p => p !== null);

            // Adjust the geographic map view to include all
            // available valid survey points.
            if (geographicPoints.length > 0) {
                window.surveyLeafletMap.fitBounds(geographicPoints, {
                    padding: [20, 20]
                });
            }
        }

        // -----------------------------------------------------
        // 6.3 Validate and Order Alignment Points
        // -----------------------------------------------------
        //
        // Alignment points require valid horizontal coordinates.
        // RL is not mandatory at this stage.
        //
        // Sort the alignment records by Chainage so that
        // subsequent road geometry follows the intended
        // alignment sequence.
        //
        // Missing or null Chainage values default to zero
        // during sorting.
        //
        // These records are subsequently used for:
        //    - Road alignment visualization.
        //    - Road centreline generation.
        //    - Culvert positioning relative to the road.
        //    - Chainage milestone placement.
        //
        // -----------------------------------------------------

        const validAlignment = alignmentPoints.filter(p =>
            Number.isFinite(Number(p.Easting)) &&
            Number.isFinite(Number(p.Northing))
        ).sort((a, b) => {
            const ca = Number(a.Chainage ?? 0);
            const cb = Number(b.Chainage ?? 0);
            return ca - cb;
        });

        // =====================================================
        // SECTION 07: SPATIAL BOUNDS CALCULATION
        // =====================================================
        //
        // Purpose:
        // Calculate the horizontal and vertical extents of the
        // available survey and alignment datasets.
        //
        // Horizontal bounds:
        //    Calculated using both survey and alignment points.
        //
        // Vertical bounds:
        //    Calculated exclusively from actual surveyed RL values.
        //
        // Why separate these calculations?
        //    Alignment points extend the horizontal viewing area,
        //    but they do not automatically provide actual terrain
        //    elevation observations.
        //
        // These bounds are subsequently used for:
        //    - Establishing the local coordinate origin.
        //    - Positioning the ground grid and datum sheet.
        //    - Calculating the initial camera view.
        //
        // =====================================================

        // -----------------------------------------------------
        // 7.1 Collect Horizontal Coordinates
        // -----------------------------------------------------
        //
        // Combine Easting and Northing coordinates from:
        //    1. Valid survey points.
        //    2. Valid alignment points.
        //
        // Three.js uses:
        //    X = Easting
        //    Z = Northing
        //
        // RL is deliberately excluded from this collection.
        //
        // -----------------------------------------------------

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

        // -----------------------------------------------------
        // 7.2 Collect Survey Elevations
        // -----------------------------------------------------
        //
        // Extract actual surveyed Reduced Levels.
        //
        // Alignment elevations are not included here because
        // their values may be missing or derived later.
        //
        // -----------------------------------------------------

        const elevations = validSurvey.map(p => Number(p.RL));

        // Stop terrain initialization when either:
        //    - No valid horizontal coordinates are available.
        //    - No actual surveyed elevations are available.
        //
        // A terrain surface requires both horizontal positions
        // and surveyed elevation observations.
        if (!horizontalPoints.length || !elevations.length) {
            status.textContent = "Insufficient valid survey data to render terrain.";
            return;
        }

        // -----------------------------------------------------
        // 7.3 Calculate Horizontal and Vertical Limits
        // -----------------------------------------------------
        //
        // Horizontal limits:
        //    Minimum and maximum Easting.
        //    Minimum and maximum Northing.
        //
        // Vertical limits:
        //    Minimum and maximum surveyed RL.
        //
        // Together, these values define the overall spatial
        // extent used by the 3D viewer.
        //
        // -----------------------------------------------------

        const minE = Math.min(...horizontalPoints.map(p => p.x));
        const maxE = Math.max(...horizontalPoints.map(p => p.x));
        const minN = Math.min(...horizontalPoints.map(p => p.z));
        const maxN = Math.max(...horizontalPoints.map(p => p.z));

        const minRL = Math.min(...elevations);
        const maxRL = Math.max(...elevations);

        // -----------------------------------------------------
        // 7.4 Coordinate Bounds Diagnostics
        // -----------------------------------------------------
        //
        // Log survey and alignment coordinate extents separately.
        //
        // These diagnostics help identify:
        //    - Differences between survey and alignment coverage.
        //    - Alignment coordinates outside the survey extent.
        //    - Unexpected coordinate ranges.
        //
        // These logs do not modify the spatial data.
        //
        // -----------------------------------------------------

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

        // =====================================================
        // SECTION 08: REAL-WORLD TO THREE.JS COORDINATE
        //             TRANSFORMATION
        // =====================================================
        //
        // Purpose:
        // Convert actual survey coordinates into a local
        // coordinate system suitable for Three.js rendering.
        //
        // REAL-WORLD COORDINATES:
        //    Easting  = UTM Easting (metres)
        //    Northing = UTM Northing (metres)
        //    RL       = Reduced Level (metres)
        //
        // THREE.JS COORDINATES:
        //    X = Local Easting
        //    Y = Local elevation
        //    Z = Local Northing
        //
        // Why use a local origin?
        //    UTM coordinates contain large numerical values.
        //    Subtracting a local origin keeps the 3D coordinates
        //    relatively small and manageable.
        //
        // IMPORTANT:
        //    The transformation changes the coordinate origin.
        //    It does not change the original survey observations.
        //
        // =====================================================

        // -----------------------------------------------------
        // 8.1 Establish the Horizontal Local Origin
        // -----------------------------------------------------
        //
        // Use the midpoint of the combined horizontal bounds
        // calculated from survey and alignment coordinates.
        //
        // This makes the centre of the overall viewing area
        // approximately (0, 0) in the Three.js X-Z plane.
        //
        // -----------------------------------------------------

        const centerE = (minE + maxE) / 2;
        const centerN = (minN + maxN) / 2;

        // -----------------------------------------------------
        // 8.2 Establish the Vertical Reference
        // -----------------------------------------------------
        //
        // Use the minimum actual surveyed RL as the vertical
        // reference elevation.
        //
        // Consequently, the lowest surveyed elevation becomes
        // Y = 0 before vertical exaggeration is applied.
        //
        // -----------------------------------------------------

        const baseRL = minRL;

        // -----------------------------------------------------
        // 8.3 Configure Coordinate Scaling
        // -----------------------------------------------------
        //
        // terrainScale:
        //    Horizontal scale factor.
        //    Value 1 preserves horizontal numerical distances.
        //
        // verticalExaggeration:
        //    Vertical display multiplier.
        //    Value 3 makes elevation differences appear three
        //    times larger in the 3D visualization.
        //
        // IMPORTANT:
        //    Vertical exaggeration is for visual interpretation.
        //    It is not a modification of actual RL values.
        //
        // -----------------------------------------------------

        const terrainScale = 1;
        const verticalExaggeration = 3;

        // -----------------------------------------------------
        // 8.4 Coordinate Transformation Function
        // -----------------------------------------------------
        //
        // Input:
        //    easting  = Real-world Easting
        //    northing = Real-world Northing
        //    rl       = Real-world Reduced Level
        //
        // Processing:
        //    1. Subtract the local Easting origin.
        //    2. Subtract the vertical reference elevation.
        //    3. Subtract the local Northing origin.
        //    4. Apply the configured scale factors.
        //
        // Output:
        //    THREE.Vector3 containing local X, Y and Z values.
        //
        // This function is reused throughout the viewer for
        // survey points, terrain vertices, road geometry,
        // culvert locations and other spatial objects.
        //
        // -----------------------------------------------------

        const toWorld = (easting, northing, rl) => new THREE.Vector3(
            (Number(easting) - centerE) * terrainScale,
            (Number(rl) - baseRL) * verticalExaggeration,
            (Number(northing) - centerN) * terrainScale
        );

        // =====================================================
        // SECTION 09: GROUND GRID GENERATION
        // =====================================================
        //
        // Purpose:
        // Create a rectangular reference grid below the survey
        // terrain to provide a visual sense of spatial scale
        // and orientation in the 3D viewer.
        //
        // The grid is constructed using individual line
        // segments in the horizontal X-Z plane.
        //
        // IMPORTANT:
        // This is a visualization reference only.
        // It does not represent actual surveyed ground,
        // geological strata or a physical foundation.
        //
        // =====================================================

        // -----------------------------------------------------
        // 9.1 Determine Grid Dimensions
        // -----------------------------------------------------
        //
        // Grid width:
        //    Based on the horizontal Easting extent.
        //
        // Grid length:
        //    Based on the horizontal Northing extent.
        //
        // A minimum dimension of 10 metres is maintained
        // to prevent a zero-sized or excessively small grid.
        //
        // Both dimensions are centred around the local origin.
        //
        // -----------------------------------------------------

        const gridWidth = Math.max(maxE - minE, 10);
        const gridLength = Math.max(maxN - minN, 10);

        // Distance between consecutive grid lines, in metres.
        const gridSpacing = 50;

        // Vertical position of the reference grid in Three.js.
        // The negative value places it below the local elevation
        // origin (baseRL).
        //
        // This is a display position, not an actual RL datum.
        const gridY = -120;

        // -----------------------------------------------------
        // 9.2 Generate Grid Line Coordinates
        // -----------------------------------------------------
        //
        // Store the line coordinates in an array.
        //
        // Each line requires two 3D endpoints:
        //    X, Y, Z of starting point.
        //    X, Y, Z of ending point.
        //
        // First loop:
        //    Generates lines parallel to the Northing axis (Z).
        //
        // Second loop:
        //    Generates lines parallel to the Easting axis (X).
        //
        // -----------------------------------------------------

        const gridVertices = [];

        // Generate lines parallel to the Z axis.
        for (let x = -gridWidth / 2; x <= gridWidth / 2; x += gridSpacing) {
            gridVertices.push(
                x, gridY, -gridLength / 2,
                x, gridY, gridLength / 2
            );
        }

        // Generate lines parallel to the X axis.
        for (let z = -gridLength / 2; z <= gridLength / 2; z += gridSpacing) {
            gridVertices.push(
                -gridWidth / 2, gridY, z,
                gridWidth / 2, gridY, z
            );
        }

        // -----------------------------------------------------
        // 9.3 Create Three.js Grid Geometry
        // -----------------------------------------------------
        //
        // BufferGeometry stores the generated vertex coordinates.
        //
        // Each pair of points defines one independent line
        // segment. LineSegments renders these pairs without
        // connecting one grid line to another.
        //
        // -----------------------------------------------------

        const gridGeometry = new THREE.BufferGeometry();

        gridGeometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(gridVertices, 3)
        );

        // -----------------------------------------------------
        // 9.4 Define Grid Appearance
        // -----------------------------------------------------
        //
        // LineBasicMaterial controls the grid colour and opacity.
        //
        // The grid is displayed using a muted colour so that
        // it does not dominate the terrain visualization.
        //
        // -----------------------------------------------------

        const groundGrid = new THREE.LineSegments(
            gridGeometry,
            new THREE.LineBasicMaterial({
                color: 0x939e88,
                transparent: false,
                opacity: 0.65
            })
        );

        // Add the completed grid to the main Three.js scene.
        scene.add(groundGrid);

        // -----------------------------------------------------
        // 9.5 Ground Grid Visibility Control
        // -----------------------------------------------------
        //
        // Connect the grid to its corresponding toolbar button.
        //
        // Clicking the button:
        //    1. Toggles grid visibility.
        //    2. Updates the button's accessibility state.
        //    3. Updates the displayed button text.
        //
        // The grid geometry itself remains unchanged.
        //
        // -----------------------------------------------------

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

        // =====================================================
        // SECTION 10: DATUM SHEET GENERATION
        // =====================================================
        //
        // Purpose:
        // Create a horizontal reference plane within the 3D
        // survey viewer using a representative surveyed RL.
        //
        // The reference RL is calculated using the MEDIAN
        // of all valid surveyed elevations.
        //
        // Why median?
        //    The median represents the middle value of the
        //    ordered elevation dataset.
        //
        //    Unlike the arithmetic mean, it is less affected
        //    by unusually high or low elevation observations.
        //
        // IMPORTANT:
        //    This is a visualization reference plane.
        //    It is not automatically an engineering datum,
        //    formation level or construction reference level.
        //
        // =====================================================

        // -----------------------------------------------------
        // 10.1 Calculate the Median Surveyed RL
        // -----------------------------------------------------
        //
        // First, create a sorted copy of the surveyed elevations.
        //
        // Sorting is performed in ascending numerical order.
        // The original elevations array remains unchanged.
        //
        // -----------------------------------------------------

        const sortedElevations = [...elevations].sort((a, b) => a - b);

        // Determine the middle position in the sorted dataset.
        const middleIndex = Math.floor(sortedElevations.length / 2);

        // For an odd number of observations:
        //    The median is the single middle value.
        //
        // For an even number of observations:
        //    The median is the arithmetic mean of the two
        //    middle values.
        //
        const datumRL = sortedElevations.length % 2 === 0
            ? (sortedElevations[middleIndex - 1] +
                sortedElevations[middleIndex]) / 2
            : sortedElevations[middleIndex];

        // -----------------------------------------------------
        // 10.2 Convert Datum RL into Three.js Elevation
        // -----------------------------------------------------
        //
        // Use the same vertical transformation established
        // in Section 08.
        //
        // Subtract baseRL to obtain the local elevation.
        // Apply verticalExaggeration for display.
        //
        // The resulting datumY is the vertical position of
        // the reference plane in Three.js coordinates.
        //
        // -----------------------------------------------------

        const datumY = (datumRL - baseRL) * verticalExaggeration;

        // -----------------------------------------------------
        // 10.3 Create the Datum Plane Geometry
        // -----------------------------------------------------
        //
        // Create a rectangular plane using the same horizontal
        // dimensions as the ground grid.
        //
        // PlaneGeometry initially lies in the X-Y plane.
        // Rotate it by -90 degrees around the X axis to place
        // it horizontally in the X-Z plane.
        //
        // -----------------------------------------------------

        const datumGeometry = new THREE.PlaneGeometry(
            gridWidth,
            gridLength
        );

        // Rotate the plane into the horizontal ground plane.
        datumGeometry.rotateX(-Math.PI / 2);

        // -----------------------------------------------------
        // 10.4 Define Datum Sheet Appearance
        // -----------------------------------------------------
        //
        // MeshBasicMaterial displays the plane using its
        // specified colour without requiring scene lighting.
        //
        // transparent:
        //    Allows other objects to remain visible through it.
        //
        // opacity:
        //    Controls the transparency level.
        //
        // DoubleSide:
        //    Allows the plane to be visible from either side.
        //
        // depthWrite:
        //    Disabled to reduce depth-buffer conflicts caused
        //    by transparent surfaces.
        //
        // depthTest:
        //    Retains depth testing against other scene objects.
        //
        // -----------------------------------------------------

        const datumMaterial = new THREE.MeshBasicMaterial({
            color: 0xA98262,
            transparent: true,
            opacity: 0.52,
            side: THREE.DoubleSide,
            depthWrite: false,
            depthTest: true
        });

        // Create the actual datum sheet mesh from its geometry
        // and material.
        const datumSheet = new THREE.Mesh(
            datumGeometry,
            datumMaterial
        );

        // Position the plane at the calculated datum elevation.
        // Its horizontal position remains at the local origin.
        datumSheet.position.set(0, datumY, 0);

        // Rendering order controls its drawing priority
        // relative to other scene objects.
        datumSheet.renderOrder = 0;

        // The current implementation displays the datum sheet
        // by default when the viewer is initialized.
        datumSheet.visible = true;

        // Add the datum sheet to the main Three.js scene.
        scene.add(datumSheet);

        // -----------------------------------------------------
        // 10.5 Datum Sheet Visibility Control
        // -----------------------------------------------------
        //
        // Allow the user to independently switch the datum
        // sheet on or off from the map toolbar.
        //
        // The button's initial state must match the mesh's
        // initial visibility.
        //
        // -----------------------------------------------------

        const datumToggle = document.getElementById(
            "survey-map-toggle-datum"
        );

        // Set the toolbar button's initial state to active.
        if (datumToggle) {
            datumToggle.setAttribute("aria-pressed", "true");
            datumToggle.innerHTML =
                '<i class="bi bi-layers"></i> Datum Sheet: On';
        }

        // Toggle datum sheet visibility when the user clicks.
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

        // -----------------------------------------------------
        // 10.6 Datum Sheet Diagnostic Information
        // -----------------------------------------------------
        //
        // Log the calculated reference elevation and plane
        // dimensions for verification during development.
        //
        // This is diagnostic information only.
        //
        // -----------------------------------------------------

        console.info("[Survey Terrain] Datum sheet created:", {
            datumRL: Number(datumRL.toFixed(3)),
            datumWorldY: Number(datumY.toFixed(3)),
            widthM: Number(gridWidth.toFixed(2)),
            lengthM: Number(gridLength.toFixed(2))
        });

        // =====================================================
        // SECTION 11: SURVEY POINT GEOMETRY
        // =====================================================
        //
        // Purpose:
        // Convert actual surveyed observations into Three.js
        // point geometry for visualization.
        //
        // Each survey observation contains:
        //    Easting  - Horizontal position.
        //    Northing - Horizontal position.
        //    RL       - Observed ground elevation.
        //
        // The original survey records remain unchanged.
        // Only their display coordinates are transformed.
        //
        // =====================================================

        // -----------------------------------------------------
        // 11.1 Datum Elevation Comparison Tolerance
        // -----------------------------------------------------
        //
        // Define the elevation tolerance used later when
        // comparing road alignment elevations against datumRL.
        //
        // A difference within +/- 0.10 m is considered
        // approximately equal to the datum for visualization.
        //
        // This tolerance does not change surveyed RL values.
        //
        // -----------------------------------------------------

        const DATUM_ELEVATION_TOLERANCE_M = 0.10;

        // -----------------------------------------------------
        // 11.2 Create Survey Point Geometry
        // -----------------------------------------------------
        //
        // BufferGeometry stores the 3D positions of survey points.
        //
        // Each point is transformed from real-world coordinates
        // into the local Three.js coordinate system using toWorld().
        //
        // The resulting position array contains consecutive
        // X, Y and Z values for every valid survey observation.
        //
        // -----------------------------------------------------

        // Create an empty geometry to hold survey point positions.
        const surveyGeometry = new THREE.BufferGeometry();

        // Temporary array for transformed XYZ coordinates.
        const surveyPositions = [];

        // Convert every valid survey observation into
        // its corresponding local Three.js position.
        validSurvey.forEach(p => {
            const v = toWorld(p.Easting, p.Northing, p.RL);

            surveyPositions.push(v.x, v.y, v.z);
        });

        // Attach the generated coordinates to the geometry.
        //
        // Each group of three numbers represents one vertex:
        //    X, Y, Z.
        //
        surveyGeometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(surveyPositions, 3)
        );

        // -----------------------------------------------------
        // 11.3 Define Survey Point Appearance
        // -----------------------------------------------------
        //
        // PointsMaterial controls how individual survey
        // observations appear in the 3D viewer.
        //
        // color:
        //    Blue identifies actual surveyed points.
        //
        // size:
        //    Defines the point display size.
        //
        // sizeAttenuation:
        //    Allows point size to change with camera distance.
        //
        // This material controls appearance only.
        // It does not modify the survey coordinates.
        //
        // -----------------------------------------------------

        const surveyMaterial = new THREE.PointsMaterial({
            color: 0x2f81f7,
            size: 4,
            sizeAttenuation: true
        });

        // =====================================================
        // SECTION 12: TERRAIN TIN GENERATION
        // =====================================================
        //
        // Purpose:
        // Generate an initial Triangulated Irregular Network
        // (TIN) using the actual surveyed point distribution.
        //
        // A TIN represents the terrain as interconnected
        // triangular facets.
        //
        // Each triangle connects three surveyed vertices.
        //
        // Delaunator determines the horizontal triangulation
        // using Easting and Northing coordinates.
        //
        // RL is retained as the elevation of each vertex and
        // is used later when constructing the 3D terrain mesh.
        //
        // IMPORTANT:
        // This stage generates the initial triangulation.
        // It does not yet decide which triangles are suitable
        // for displaying as accepted terrain.
        //
        // =====================================================

        // Delaunay triangulation requires at least three valid
        // survey points and the Delaunator library.
        if (window.Delaunator && validSurvey.length >= 3) {

            // -------------------------------------------------
            // 12.1 Prepare Terrain Vertices
            // -------------------------------------------------
            //
            // Convert the validated survey records into a
            // simplified structure for terrain processing.
            //
            // Each terrain point retains:
            //    easting  - Horizontal coordinate.
            //    northing - Horizontal coordinate.
            //    rl       - Actual surveyed elevation.
            //    pointNo  - Survey point identification.
            //    code     - Survey point classification, if available.
            //
            // Point identification and classification are retained
            // for diagnostics; they do not control triangulation.
            //
            // -------------------------------------------------

            const terrainPoints = validSurvey.map(p => ({
                easting: Number(p.Easting),
                northing: Number(p.Northing),
                rl: Number(p.RL),
                pointNo: p.PointNo ?? p.pointNo ?? null,
                code: p.Code ?? p.CodeType ?? p.code ?? null
            }));

            // -------------------------------------------------
            // 12.2 Generate Delaunay Triangulation
            // -------------------------------------------------
            //
            // Delaunator.from() generates triangles from the
            // horizontal distribution of terrain vertices.
            //
            // X coordinate:
            //    Local Easting.
            //
            // Y coordinate supplied to Delaunator:
            //    Local Northing.
            //
            // The local origin is subtracted before triangulation.
            // Translation does not change the relative geometry
            // of the point distribution.
            //
            // Output:
            //    triangulation.triangles contains vertex indices
            //    arranged in groups of three.
            //
            // These indices reference terrainPoints.
            //
            // Example:
            //    [0, 1, 2, 2, 1, 3]
            //
            //    Triangle 1 = vertices 0, 1 and 2.
            //    Triangle 2 = vertices 2, 1 and 3.
            //
            // -------------------------------------------------

            const triangulation = window.Delaunator.from(
                terrainPoints,
                p => (p.easting - centerE) * terrainScale,
                p => (p.northing - centerN) * terrainScale
            );

            // -------------------------------------------------
            // 12.3 Temporary Survey Point Diagnostics
            // -------------------------------------------------
            //
            // Inspect selected entries from the terrainPoints
            // array during development.
            //
            // These entries help verify the relationship between
            // array indices and their original survey records.
            //
            // IMPORTANT:
            // The indices below (23, 3566, 3568) are fixed
            // diagnostic samples from a particular investigation.
            //
            // They do not influence Delaunay triangulation,
            // triangle acceptance or terrain generation.
            //
            // This diagnostic should eventually be generalized
            // or removed from the production viewer.
            //
            // -------------------------------------------------

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

            // =================================================
            // SECTION 13: LOCAL SURVEY-POINT SPACING
            // =================================================
            //
            // Purpose:
            // Estimate the local spacing between surveyed points
            // using the edges of the generated Delaunay network.
            //
            // Why is this required?
            //    A triangle's edge length should be evaluated
            //    relative to the surrounding survey-point density.
            //
            //    An edge of 10 m may be reasonable in a sparsely
            //    surveyed area but unusually large in a densely
            //    surveyed area.
            //
            // The Delaunay network provides a spatially efficient
            // way to identify neighbouring survey points without
            // comparing every point against every other point.
            //
            // This calculation does not modify the triangulation.
            //
            // =================================================

            // -------------------------------------------------
            // 13.1 Initialize Local Spacing for Every Survey Point
            // -------------------------------------------------
            //
            // localSpacingM stores the shortest observed
            // Delaunay-edge distance connected to each point.
            //
            // Initially set every value to Infinity because
            // no neighbouring edge has been evaluated yet.
            //
            // Array index corresponds directly to the index
            // of the corresponding terrainPoints entry.
            //
            // -------------------------------------------------

            const localSpacingM = new Array(terrainPoints.length).fill(Infinity);

            // Access the triangle vertex-index array generated
            // by Delaunator.
            const delaunayTriangles = triangulation.triangles;

            // -------------------------------------------------
            // 13.2 Calculate Neighbouring Edge Distances
            // -------------------------------------------------
            //
            // Each Delaunay triangle contains three vertices:
            //    a, b and c.
            //
            // Therefore, each triangle contributes three edges:
            //    a-b
            //    b-c
            //    c-a
            //
            // Calculate the horizontal distance of each edge
            // using its original Easting and Northing coordinates.
            //
            // Update both endpoint records with the minimum
            // edge distance encountered so far.
            //
            // The resulting value represents the shortest
            // connected Delaunay edge at each survey point.
            //
            // -------------------------------------------------

            for (let i = 0; i < delaunayTriangles.length; i += 3) {
                const a = delaunayTriangles[i];
                const b = delaunayTriangles[i + 1];
                const c = delaunayTriangles[i + 2];

                // Evaluate all three edges of the triangle.
                for (const [u, v] of [[a, b], [b, c], [c, a]]) {
                    const pu = terrainPoints[u];
                    const pv = terrainPoints[v];

                    // Calculate horizontal distance in metres.
                    //
                    // RL is deliberately excluded because this
                    // is a horizontal survey-spacing measurement.
                    const distance = Math.hypot(
                        pu.easting - pv.easting,
                        pu.northing - pv.northing
                    );

                    // Ignore zero-length edges.
                    //
                    // Retain the shortest positive edge distance
                    // for both connected survey points.
                    if (distance > 0) {
                        localSpacingM[u] = Math.min(localSpacingM[u], distance);
                        localSpacingM[v] = Math.min(localSpacingM[v], distance);
                    }
                }
            }

            // -------------------------------------------------
            // 13.3 Prepare Local Spacing Distribution
            // -------------------------------------------------
            //
            // Collect finite local-spacing values and sort them
            // in ascending order.
            //
            // Points without a valid neighbouring edge retain
            // Infinity and are excluded from this distribution.
            //
            // -------------------------------------------------

            const sortedLocalSpacingM = localSpacingM
                .filter(Number.isFinite)
                .sort((a, b) => a - b);

            // -------------------------------------------------
            // 13.4 Calculate a Spacing Percentile
            // -------------------------------------------------
            //
            // Retrieve a value from the sorted local-spacing
            // distribution at the requested percentile.
            //
            // p = 0.50 represents the approximate median.
            // p = 0.95 represents the approximate 95th percentile.
            //
            // The selected index uses zero-based array positioning.
            //
            // If no finite spacing values exist, return Infinity.
            //
            // -------------------------------------------------

            const spacingPercentile = (p) => sortedLocalSpacingM.length
                ? sortedLocalSpacingM[Math.min(
                    sortedLocalSpacingM.length - 1,
                    Math.floor((sortedLocalSpacingM.length - 1) * p)
                )]
                : Infinity;

            // -------------------------------------------------
            // 13.5 Calculate Global P95 Local Spacing
            // -------------------------------------------------
            //
            // Determine the 95th-percentile value of the
            // point-wise nearest Delaunay-edge distances.
            //
            // This provides a dataset-level reference for
            // evaluating unusually long terrain edges.
            //
            // It will be used later in the selective
            // reconstruction support assessment.
            //
            // IMPORTANT:
            // P95 is a statistical spacing reference.
            // It is not itself a terrain acceptance rule.
            //
            // -------------------------------------------------

            const localSpacingP95M = spacingPercentile(0.95);

            // =================================================
            // SECTION 14: TERRAIN MESH PREPARATION
            // =================================================
            //
            // Purpose:
            // Prepare the geometry containers, visual properties
            // and evaluation thresholds required to construct
            // the accepted terrain surface.
            //
            // The initial Delaunay triangulation contains all
            // generated candidate triangles.
            //
            // Not every candidate triangle will be accepted.
            // Each triangle must pass the geometric support
            // evaluation performed in the following sections.
            //
            // =================================================

            // -------------------------------------------------
            // 14.1 Initialize Terrain Geometry Containers
            // -------------------------------------------------
            //
            // terrainGeometry:
            //    Final BufferGeometry for the accepted terrain.
            //
            // terrainPositions:
            //    Stores transformed XYZ coordinates of accepted
            //    terrain triangle vertices.
            //
            // terrainColors:
            //    Stores RGB colour values for individual
            //    terrain triangle vertices.
            //
            // Separate vertices are stored for each triangle
            // to allow independent triangle colouring.
            //
            // -------------------------------------------------

            const terrainGeometry = new THREE.BufferGeometry();
            const terrainPositions = [];
            const terrainColors = [];

            // -------------------------------------------------
            // 14.2 Define Terrain Classification Colours
            // -------------------------------------------------
            //
            // Natural terrain:
            //    Green colour for slopes below the configured
            //    slope classification threshold.
            //
            // Steep terrain:
            //    Earth-brown colour for slopes at or above
            //    the configured threshold.
            //
            // These colours communicate visual terrain
            // classification, not engineering material types.
            //
            // -------------------------------------------------

            const naturalColor = new THREE.Color(0x5c7f5a);
            const fallColor = new THREE.Color(0x8a7055);

            // -------------------------------------------------
            // 14.3 Establish Triangle Evaluation Parameters
            // -------------------------------------------------
            //
            // The following parameters control which Delaunay
            // triangles are accepted for the primary terrain mesh.
            //
            // Triangle acceptance is initially based on
            // horizontal circumradius and geometric validity.
            //
            // Additional support measurements are retained
            // for diagnostic and experimental evaluation.
            //
            // -------------------------------------------------

            const triangles = triangulation.triangles;

            // Slope classification threshold in degrees.
            const FALL_SLOPE_THRESHOLD = 30;

            // Maximum permitted horizontal circumradius
            // for the primary accepted terrain mesh.
            //
            // Triangles exceeding this threshold are rejected
            // unless a separate selective reconstruction rule
            // explicitly permits their restoration.
            const MAX_TERRAIN_CIRCUMRADIUS_M = 15.5;

            // Minimum permitted twice-area of a triangle.
            //
            // Used to identify degenerate or nearly collinear
            // horizontal triangles.
            //
            // Such triangles cannot provide a reliable
            // horizontal terrain facet.
            const MIN_TWICE_AREA_M2 = 0.001;

            // -------------------------------------------------
            // 14.4 Selective Gap Reconstruction Configuration
            // -------------------------------------------------
            //
            // Experimental reconstruction settings.
            //
            // The intention is to evaluate whether certain
            // rejected triangles inside enclosed regions have
            // sufficient surrounding survey support.
            //
            // Reconstruction is disabled by default.
            // No rejected terrain is restored under the current
            // default configuration.
            //
            // The additional limits provide conservative
            // screening criteria if this feature is enabled.
            //
            // -------------------------------------------------

            const ENABLE_SELECTIVE_GAP_RECONSTRUCTION = false;

            const MAX_RECONSTRUCTION_EDGE_TO_LOCAL_SPACING = 3.0;
            const MAX_RECONSTRUCTION_EDGE_TO_P95_SPACING = 4.0;
            const MAX_RECONSTRUCTION_REGION_SPAN_M = 30.0;

            // -------------------------------------------------
            // 14.5 Initialize Triangle Evaluation Counters
            // -------------------------------------------------
            //
            // These counters record the results of terrain
            // triangle evaluation.
            //
            // acceptedTriangles:
            //    Total triangles included in the terrain mesh.
            //
            // rejectedTriangles:
            //    Total triangles rejected from the primary mesh.
            //
            // rejectedLargeCircumradius:
            //    Rejected triangles exceeding the maximum
            //    circumradius threshold.
            //
            // rejectedDegenerate:
            //    Rejected triangles that fail the minimum
            //    horizontal area requirement.
            //
            // -------------------------------------------------

            let acceptedTriangles = 0;
            let rejectedTriangles = 0;
            let rejectedLargeCircumradius = 0;
            let rejectedDegenerate = 0;

            // -------------------------------------------------
            // 14.6 Retain Triangle Index Collections
            // -------------------------------------------------
            //
            // acceptedTriangleIndices:
            //    Retains the original survey-point indices
            //    belonging to accepted triangles.
            //
            //    Used later for terrain boundary extraction
            //    and coverage analysis.
            //
            // rejectedTriangleIndices:
            //    Retains the original survey-point indices
            //    belonging to rejected triangles.
            //
            //    Used to generate diagnostic triangle edges.
            //
            // SHOW_REJECTED_TRIANGLES:
            //    Controls whether rejected triangle edges
            //    are prepared for visualization.
            //
            // -------------------------------------------------

            const acceptedTriangleIndices = [];

            const rejectedTriangleIndices = [];
            const SHOW_REJECTED_TRIANGLES = true;

            // Store detailed measurements for every rejected
            // triangle.
            //
            // These records support subsequent investigations
            // into unsupported terrain regions and coverage gaps.
            //
            // Diagnostic collection does not independently
            // determine triangle acceptance.
            const rejectedTriangleDiagnostics = [];

            // =================================================
            // SECTION 15: HORIZONTAL CIRCUMRADIUS CALCULATION
            // =================================================
            //
            // Purpose:
            // Calculate the horizontal circumradius of a
            // candidate triangle.
            //
            // Circumradius:
            //    Radius of the circle passing through all
            //    three vertices of a triangle.
            //
            // Why horizontal circumradius?
            //    Terrain triangulation is generated using
            //    Easting and Northing.
            //
            //    The acceptance threshold therefore evaluates
            //    the horizontal geometry rather than the
            //    vertically exaggerated Three.js geometry.
            //
            // Formula:
            //
            //              R = (a x b x c) / (4 x A)
            //
            // Where:
            //    a, b, c = Horizontal side lengths.
            //    A       = Horizontal triangle area.
            //
            // IMPORTANT:
            // The function returns Infinity for degenerate
            // or nearly collinear triangles.
            //
            // =================================================

            function horizontalCircumradius(a, b, c) {

                // Calculate horizontal lengths of all three sides.
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

                // Calculate twice the horizontal triangle area
                // using the coordinate cross-product formula.
                //
                // twiceArea = 2 x A
                //
                // This avoids requiring the triangle's angles
                // or vertical RL differences.
                const twiceArea = Math.abs(
                    (b.easting - a.easting) * (c.northing - a.northing) -
                    (b.northing - a.northing) * (c.easting - a.easting)
                );

                // Reject degenerate or nearly collinear triangles.
                //
                // Such triangles have insufficient horizontal
                // area to define a numerically reliable facet.
                if (twiceArea < MIN_TWICE_AREA_M2) {
                    return Infinity;
                }

                // Calculate the horizontal circumradius.
                //
                // Since twiceArea = 2A:
                //
                // R = (a x b x c) / (2 x twiceArea)
                //
                return (ab * bc * ca) / (2 * twiceArea);
            }

            // =================================================
            // SECTION 16: TRIANGLE EVIDENCE AND ADJACENCY
            // =================================================
            //
            // Purpose:
            // Examine every Delaunay triangle and collect its
            // geometric measurements and topological relationships.
            //
            // Geometric evidence:
            //    - Side lengths.
            //    - Maximum edge length.
            //    - Minimum internal angle.
            //    - Horizontal circumradius.
            //    - Elevation range.
            //    - Local survey-point spacing.
            //
            // Topological evidence:
            //    - Shared edges with neighbouring triangles.
            //    - Whether edges belong to the Delaunay convex hull.
            //    - Whether neighbouring triangles pass the
            //      initial circumradius acceptance threshold.
            //
            // IMPORTANT:
            // This section prepares evidence for subsequent
            // evaluation. It does not change terrain geometry
            // or restore rejected triangles.
            //
            // =================================================

            // -------------------------------------------------
            // 16.1 Initialize Triangle Evidence Collections
            // -------------------------------------------------
            //
            // triangleEvidence:
            //    Stores one evidence record for every Delaunay
            //    triangle.
            //
            // terrainEdgeToTriangleIds:
            //    Maps each unique Delaunay edge to the IDs of
            //    triangles sharing that edge.
            //
            // This edge map allows efficient identification
            // of triangle neighbours.
            //
            // -------------------------------------------------

            const triangleEvidence = [];
            const terrainEdgeToTriangleIds = new Map();

            // Generate a consistent edge identifier.
            //
            // The same edge must produce the same key regardless
            // of the order in which its two vertex indices appear.
            //
            // Example:
            //    (4, 9) and (9, 4) both produce "4,9".
            //
            const terrainEdgeKey = (u, v) => u < v ? `${u},${v}` : `${v},${u}`;

            // -------------------------------------------------
            // 16.2 Build Evidence for Every Delaunay Triangle
            // -------------------------------------------------
            //
            // Delaunator stores triangle vertices in consecutive
            // groups of three indices.
            //
            // Each iteration processes one triangle.
            //
            // triangleId:
            //    Zero-based identifier of the current triangle.
            //
            // indices:
            //    Original indices of its three survey vertices.
            //
            // -------------------------------------------------

            for (let i = 0; i < triangles.length; i += 3) {
                const triangleId = i / 3;

                const indices = [
                    triangles[i],
                    triangles[i + 1],
                    triangles[i + 2]
                ];

                const [ia, ib, ic] = indices;

                const [a, b, c] = [
                    terrainPoints[ia],
                    terrainPoints[ib],
                    terrainPoints[ic]
                ];

                // -------------------------------------------------
                // 16.2.1 Calculate Horizontal Side Lengths
                // -------------------------------------------------
                //
                // Calculate all three horizontal triangle edges.
                //
                // These measurements are based on actual
                // Easting and Northing coordinates.
                //
                // RL is not included in horizontal edge lengths.
                //
                // -------------------------------------------------

                const sides = [
                    Math.hypot(a.easting - b.easting, a.northing - b.northing),
                    Math.hypot(b.easting - c.easting, b.northing - c.northing),
                    Math.hypot(c.easting - a.easting, c.northing - a.northing)
                ];

                // -------------------------------------------------
                // 16.2.2 Calculate Horizontal Triangle Area
                // -------------------------------------------------
                //
                // Calculate twice the horizontal triangle area
                // using the coordinate cross-product formula.
                //
                // This is retained as a geometric measurement
                // for evaluating triangle shape and validity.
                //
                // -------------------------------------------------

                const twiceArea = Math.abs(
                    (b.easting - a.easting) * (c.northing - a.northing) -
                    (b.northing - a.northing) * (c.easting - a.easting)
                );

                // -------------------------------------------------
                // 16.2.3 Calculate Internal Triangle Angles
                // -------------------------------------------------
                //
                // Calculate each internal angle using the
                // cosine rule.
                //
                // Formula:
                //
                // cos(A) = (b² + c² - a²) / (2bc)
                //
                // The resulting cosine is clamped between
                // -1 and 1 to prevent floating-point errors
                // from producing invalid inverse cosine values.
                //
                // -------------------------------------------------

                const angleFromSides = (opposite, side1, side2) => {
                    if (side1 <= 0 || side2 <= 0) return 0;

                    const cosine = THREE.MathUtils.clamp(
                        (side1 * side1 + side2 * side2 - opposite * opposite) /
                        (2 * side1 * side2), -1, 1
                    );

                    return THREE.MathUtils.radToDeg(Math.acos(cosine));
                };

                // Calculate the three internal angles.
                const angles = [
                    angleFromSides(sides[1], sides[0], sides[2]),
                    angleFromSides(sides[2], sides[0], sides[1]),
                    angleFromSides(sides[0], sides[1], sides[2])
                ];

                // -------------------------------------------------
                // 16.2.4 Obtain Local Survey Spacing at Vertices
                // -------------------------------------------------
                //
                // Retrieve the previously calculated nearest
                // Delaunay-edge spacing for each triangle vertex.
                //
                // Use the median of the available vertex spacings
                // as the representative local spacing for this
                // triangle.
                //
                // The median reduces the influence of one unusually
                // small or large vertex-spacing measurement.
                //
                // -------------------------------------------------

                const vertexSpacings = indices.map(index => localSpacingM[index]);

                const finiteSpacings = vertexSpacings
                    .filter(Number.isFinite)
                    .sort((x, y) => x - y);

                const medianVertexSpacingM = finiteSpacings.length
                    ? finiteSpacings[Math.floor((finiteSpacings.length - 1) / 2)]
                    : Infinity;

                // -------------------------------------------------
                // 16.2.5 Calculate Triangle Elevation Range
                // -------------------------------------------------
                //
                // Obtain the actual surveyed RL values of the
                // three triangle vertices.
                //
                // Elevation range:
                //    Maximum vertex RL - Minimum vertex RL.
                //
                // This records the vertical variation between
                // the measured vertices.
                //
                // It is not an average slope measurement.
                //
                // -------------------------------------------------

                const rlValues = [a.rl, b.rl, c.rl];

                const rlRangeM = Math.max(...rlValues) - Math.min(...rlValues);

                // -------------------------------------------------
                // 16.2.6 Calculate Triangle Circumradius
                // -------------------------------------------------
                //
                // Use the horizontal circumradius function
                // established in Section 15.
                //
                // This provides the primary geometric measurement
                // used by the existing terrain acceptance rule.
                //
                // -------------------------------------------------

                const circumradiusM = horizontalCircumradius(a, b, c);

                // -------------------------------------------------
                // 16.2.7 Generate Triangle Edge Identifiers
                // -------------------------------------------------
                //
                // Create consistent keys for the three edges:
                //    ia-ib
                //    ib-ic
                //    ic-ia
                //
                // These identifiers are used to establish
                // relationships between neighbouring triangles.
                //
                // -------------------------------------------------

                const edges = [[ia, ib], [ib, ic], [ic, ia]].map(
                    ([u, v]) => terrainEdgeKey(u, v)
                );

                // -------------------------------------------------
                // 16.2.8 Create the Triangle Evidence Record
                // -------------------------------------------------
                //
                // Store all measurements in one record.
                //
                // baselineAccepted:
                //    Indicates whether this triangle passes the
                //    initial circumradius threshold.
                //
                // acceptedNeighbours:
                //    Initialized to zero and calculated after
                //    all triangle evidence records are available.
                //
                // hullEdgeCount:
                //    Number of edges belonging to the outer convex
                //    hull of the Delaunay triangulation.
                //
                // -------------------------------------------------

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

                // -------------------------------------------------
                // 16.2.9 Build the Edge-to-Triangle Relationship
                // -------------------------------------------------
                //
                // Register the current triangle against each
                // of its three edges.
                //
                // Later, triangles sharing the same edge can
                // be identified as direct neighbours.
                //
                // A Delaunay edge normally belongs to:
                //    - One triangle at the convex hull.
                //    - Two triangles in the interior.
                //
                // -------------------------------------------------

                for (const edgeKey of edges) {
                    if (!terrainEdgeToTriangleIds.has(edgeKey)) {
                        terrainEdgeToTriangleIds.set(edgeKey, []);
                    }

                    terrainEdgeToTriangleIds.get(edgeKey).push(triangleId);
                }
            }

            // -------------------------------------------------
            // 16.3 Evaluate Triangle Neighbour Relationships
            // -------------------------------------------------
            //
            // By this stage, all triangle evidence records and
            // their edge relationships have been created.
            //
            // Now evaluate each triangle's three edges.
            //
            // For each edge:
            //
            // 1. Retrieve all triangles sharing that edge.
            //
            // 2. If only one triangle uses the edge, identify it
            //    as a convex-hull boundary edge.
            //
            // 3. Identify adjacent triangles that pass the
            //    baseline circumradius acceptance threshold.
            //
            // acceptedNeighbours counts shared edges with
            // baseline-accepted adjacent triangles.
            //
            // It does not count shared vertices.
            //
            // hullEdgeCount identifies exposure to the outer
            // convex hull of the original Delaunay triangulation.
            //
            // -------------------------------------------------

            for (const evidence of triangleEvidence) {
                for (const edgeKey of evidence.edges) {
                    const adjacent = terrainEdgeToTriangleIds.get(edgeKey) || [];

                    // An edge used by only one triangle belongs
                    // to the outer convex hull of the triangulation.
                    if (adjacent.length === 1) evidence.hullEdgeCount++;

                    // Identify adjacent triangles that pass
                    // the initial circumradius threshold.
                    for (const adjacentId of adjacent) {
                        if (adjacentId !== evidence.triangleId &&
                            triangleEvidence[adjacentId]?.baselineAccepted) {
                            evidence.acceptedNeighbours++;
                        }
                    }
                }

                // acceptedNeighbours counts shared edges,
                // representing direct accepted-triangle support.
            }

            // -------------------------------------------------
            // 16.4 Long-edge Gap Diagnostic
            // -------------------------------------------------
            //
            // Purpose:
            // Identify triangles containing unusually long edges
            // and group connected flagged triangles into regions.
            //
            // This is a diagnostic operation only.
            // It does not accept or reject terrain triangles.
            //
            // The comparison is relative to the dataset:
            // the median of all triangle maximum-edge lengths
            // provides the reference value.
            //
            // -------------------------------------------------

            const longestEdgesM = triangleEvidence
                .map(evidence => evidence.maxEdgeM)
                .filter(Number.isFinite)
                .sort((a, b) => a - b);

            // Calculate the statistical median of the supplied values.
            // Return Infinity when no valid values are available.
            const medianOf = values => {
                if (!values.length) return Infinity;

                const middle = Math.floor(values.length / 2);

                return values.length % 2
                    ? values[middle]
                    : (values[middle - 1] + values[middle]) / 2;
            };

            const medianLongestEdgeM = medianOf(longestEdgesM);

            // Diagnostic screening threshold.
            // A triangle is flagged when its longest edge exceeds
            // 2.5 times the median longest edge in this dataset.
            //
            // This multiplier is an experimental diagnostic setting,
            // not an engineering acceptance criterion.
            const diagnosticEdgeMultiplier = 2.5;
            const diagnosticLongEdgeLimitM =
                medianLongestEdgeM * diagnosticEdgeMultiplier;

            const longEdgeTriangleIds = new Set();

            // Identify triangles exceeding the diagnostic threshold.
            for (const evidence of triangleEvidence) {
                if (Number.isFinite(diagnosticLongEdgeLimitM) &&
                    evidence.maxEdgeM > diagnosticLongEdgeLimitM) {
                    longEdgeTriangleIds.add(evidence.triangleId);
                }
            }

            // -------------------------------------------------
            // Group Connected Long-edge Triangles
            // -------------------------------------------------
            //
            // Flagged triangles are grouped when they share
            // a Delaunay edge.
            //
            // Shared vertices alone do not establish connectivity.
            //
            // A stack-based traversal discovers each connected
            // component without processing the same triangle twice.
            //
            // -------------------------------------------------

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

                    // Find triangles sharing each edge of the current triangle.
                    const adjacentIds = [];

                    for (const edgeKey of evidence.edges) {
                        const sharedTriangles =
                            terrainEdgeToTriangleIds.get(edgeKey) || [];

                        for (const adjacentId of sharedTriangles) {
                            if (!longEdgeTriangleIds.has(adjacentId) ||
                                visitedLongEdgeTriangles.has(adjacentId)) {
                                continue;
                            }

                            visitedLongEdgeTriangles.add(adjacentId);
                            stack.push(adjacentId);
                        }
                    }
                }

                // Retrieve the evidence records belonging to this component.
                const componentTriangles = componentTriangleIds.map(
                    id => triangleEvidence[id]
                );

                // Summarize the component's size and its relationship
                // to the original Delaunay convex-hull boundary.
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

            // Consolidate the diagnostic results.
            // Components are ordered from largest to smallest.
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

            // Expose diagnostic information for browser-console inspection.
            window.__terrainEdgeGapDiagnostic =
                terrainEdgeGapDiagnostic;
            window.__terrainTriangleEvidence = triangleEvidence;

            console.info(
                "[Survey Terrain] Long-edge gap diagnostic:",
                terrainEdgeGapDiagnostic
            );

            // -------------------------------------------------
            // 16.5 Selective Gap Reconstruction Rules
            // -------------------------------------------------
            //
            // Defines the geometric and survey-support conditions
            // required before a baseline-rejected triangle can be
            // considered for selective reconstruction.
            //
            // These rules are additional safeguards, not a
            // replacement for the baseline terrain acceptance test.
            //
            // Reconstruction remains controlled by
            // ENABLE_SELECTIVE_GAP_RECONSTRUCTION.
            //
            // -------------------------------------------------

            const reconstructionRule = {
                enabled: ENABLE_SELECTIVE_GAP_RECONSTRUCTION,

                // Maximum permitted horizontal circumradius.
                maxCircumradiusM: 20.0,

                // Maximum permitted horizontal edge length.
                maxEdgeM: 20.0,

                // Reject triangles with an excessively narrow angle.
                minimumAngleDegrees: 15.0,

                // Maximum permitted elevation difference (RL)
                // between the triangle's three survey vertices.
                maxRlRangeM: 1.0,

                // Minimum number of baseline-accepted neighbouring
                // triangles required for local edge support.
                minimumAcceptedNeighbours: 2,

                // Restrict edge length relative to the median
                // local survey-point spacing of the triangle vertices.
                maxEdgeToMedianVertexSpacing: MAX_RECONSTRUCTION_EDGE_TO_LOCAL_SPACING,

                // Restrict edge length relative to the global
                // 95th-percentile local survey-point spacing.
                maxEdgeToGlobalP95Spacing: MAX_RECONSTRUCTION_EDGE_TO_P95_SPACING,

                // Prevent reconstruction of triangles touching
                // the original Delaunay convex-hull boundary.
                rejectConvexHullFacets: true
            };

            // -------------------------------------------------
            // 16.6 Selective Reconstruction Decision
            // -------------------------------------------------
            //
            // Evaluates whether a triangle rejected by the
            // baseline circumradius filter can be selectively
            // restored.
            //
            // Every configured safeguard must pass.
            // Failure of any condition immediately rejects
            // the reconstruction attempt.
            //
            // -------------------------------------------------

            const selectiveReconstructionDecision = (evidence) => {

                // Master safety switch:
                // reconstruction is disabled unless explicitly enabled.
                if (!ENABLE_SELECTIVE_GAP_RECONSTRUCTION) return false;

                // Geometric size check:
                // circumradius must be valid and within the configured limit.
                if (!Number.isFinite(evidence.circumradiusM) ||
                    evidence.circumradiusM > reconstructionRule.maxCircumradiusM) return false;

                // Reject triangles with excessively long edges.
                if (evidence.maxEdgeM > reconstructionRule.maxEdgeM) return false;

                // Reject narrow or poorly shaped triangles.
                if (evidence.minAngleDegrees < reconstructionRule.minimumAngleDegrees) return false;

                // Reject triangles with excessive elevation variation
                // between their three survey vertices.
                if (evidence.rlRangeM > reconstructionRule.maxRlRangeM) return false;

                // Require sufficient support from neighbouring
                // triangles that passed baseline acceptance.
                if (evidence.acceptedNeighbours < reconstructionRule.minimumAcceptedNeighbours) return false;

                // Reject triangles exposed to the original
                // Delaunay convex-hull boundary.
                if (reconstructionRule.rejectConvexHullFacets && evidence.hullEdgeCount > 0) return false;

                // Local support check:
                // the maximum triangle edge must remain within
                // the configured multiple of its median vertex spacing.
                // Missing or invalid local spacing also causes rejection.
                if (!Number.isFinite(evidence.medianVertexSpacingM) ||
                    evidence.maxEdgeM > reconstructionRule.maxEdgeToMedianVertexSpacing *
                    evidence.medianVertexSpacingM) return false;

                // Dataset-wide support check:
                // compare the maximum edge against the configured
                // multiple of the survey's 95th-percentile local spacing.
                if (Number.isFinite(localSpacingP95M) &&
                    evidence.maxEdgeM > reconstructionRule.maxEdgeToGlobalP95Spacing *
                    localSpacingP95M) return false;

                // Final condition:
                // only triangles rejected by the baseline test
                // can be considered for selective reconstruction.
                return !evidence.baselineAccepted;
            };

            // -------------------------------------------------
            // 16.7 Selective Reconstruction Tracking
            // -------------------------------------------------
            //
            // Track the number of triangles restored through
            // the selective reconstruction process.
            //
            // The report collection stores the geometric and
            // survey-support evidence for each restored triangle.
            //
            // These records are diagnostic and provide traceability
            // for reviewing reconstruction decisions.
            //
            // -------------------------------------------------

            let selectivelyRestoredTriangles = 0;
            const selectivelyRestoredFacetReport = [];

            // -------------------------------------------------
            // 16.8 Main Triangle Processing
            // -------------------------------------------------
            //
            // Process the Delaunay triangulation one triangle
            // at a time. Each triangle is represented by three
            // consecutive vertex indices.
            //
            // -------------------------------------------------

            for (let i = 0; i < triangles.length; i += 3) {

                // Retrieve the three survey-point indices
                // belonging to the current triangle.
                const ia = triangles[i];
                const ib = triangles[i + 1];
                const ic = triangles[i + 2];

                // Retrieve the corresponding survey-point records.
                // Each record contains the original survey coordinates
                // and associated point information.
                const a = terrainPoints[ia];
                const b = terrainPoints[ib];
                const c = terrainPoints[ic];

                // Calculate the triangle's horizontal circumradius.
                // This is used to evaluate the triangle's geometric
                // spread independently of its displayed 3D slope.
                const circumradius = horizontalCircumradius(a, b, c);

                // Reject invalid or degenerate triangles.
                // A non-finite circumradius indicates that a reliable
                // horizontal circumradius could not be calculated.
                //
                // Such triangles are counted separately and are not
                // included in the terrain mesh.
                if (!Number.isFinite(circumradius)) {
                    rejectedTriangles++;
                    rejectedDegenerate++;
                    continue;
                }

                // Retrieve the previously calculated evidence for
                // this triangle, using its position in the triangulation.
                const facetEvidence = triangleEvidence[i / 3];

                // Check whether a baseline-rejected triangle qualifies
                // for selective reconstruction under the configured rules.
                const selectivelyRestoreFacet =
                    circumradius > MAX_TERRAIN_CIRCUMRADIUS_M &&
                    selectiveReconstructionDecision(facetEvidence);

                // Reject triangles exceeding the baseline circumradius
                // threshold unless they qualify for selective restoration.
                if (circumradius > MAX_TERRAIN_CIRCUMRADIUS_M &&
                    !selectivelyRestoreFacet) {
                    rejectedTriangles++;
                    rejectedLargeCircumradius++;
                    // -------------------------------------------------
                    // Rejected Triangle: Geometric Diagnostics
                    // -------------------------------------------------
                    //
                    // Calculate additional geometric measurements
                    // for a triangle rejected by the circumradius limit.
                    //
                    // These measurements are recorded for diagnosis.
                    // They do not change the rejection decision.
                    //
                    // -------------------------------------------------

                    // Calculate the horizontal lengths of all three edges.
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

                    // Calculate twice the horizontal triangle area
                    // using the coordinate cross-product.
                    // The absolute value removes orientation dependence.
                    const twiceArea = Math.abs(
                        (b.easting - a.easting) * (c.northing - a.northing) -
                        (b.northing - a.northing) * (c.easting - a.easting)
                    );

                    const sideLengths = [edgeAB, edgeBC, edgeCA];

                    // Calculate an internal angle from its three side lengths
                    // using the cosine rule.
                    const angleFromSides = (opposite, side1, side2) => {
                        if (side1 <= 0 || side2 <= 0) return 0;

                        // Clamp the cosine to the valid inverse-cosine range
                        // to protect against floating-point rounding errors.
                        const cosine = THREE.MathUtils.clamp(
                            (side1 * side1 + side2 * side2 - opposite * opposite) /
                            (2 * side1 * side2),
                            -1,
                            1
                        );

                        return THREE.MathUtils.radToDeg(Math.acos(cosine));
                    };

                    // Calculate the three internal angles.
                    const angles = [
                        angleFromSides(edgeBC, edgeAB, edgeCA),
                        angleFromSides(edgeCA, edgeAB, edgeBC),
                        angleFromSides(edgeAB, edgeBC, edgeCA)
                    ];


                    // -------------------------------------------------
                    // Vertex Spacing and Elevation Analysis
                    // -------------------------------------------------
                    //
                    // Examine the local survey-point spacing at each
                    // triangle vertex and the elevation variation
                    // across its three vertices.
                    //
                    // These measurements help assess whether the
                    // triangle is supported by the surrounding survey data.
                    //
                    // -------------------------------------------------

                    // Retrieve local spacing for each triangle vertex.
                    // Invalid spacing values are represented as null
                    // in the diagnostic report.
                    const vertexLocalSpacingM = [ia, ib, ic].map(index =>
                        Number.isFinite(localSpacingM[index])
                            ? Number(localSpacingM[index].toFixed(3))
                            : null
                    );

                    // Retrieve the three vertex reduced levels (RL).
                    const vertexRlValues = [a.rl, b.rl, c.rl];

                    // Calculate the elevation range between the
                    // highest and lowest triangle vertices.
                    const rlRangeM = Math.max(...vertexRlValues) - Math.min(...vertexRlValues);

                    // Identify the smallest internal angle and
                    // longest horizontal edge for geometric screening.
                    const minimumAngleDegrees = Math.min(...angles);
                    const maxEdgeM = Math.max(...sideLengths);

                    // Assign an initial diagnostic classification.
                    // This classification describes the evidence
                    // and does not independently approve reconstruction.
                    let supportClass = "review_with_feature_context";

                    // Very small minimum angles indicate a narrow
                    // or nearly collinear triangle.
                    if (minimumAngleDegrees < 10) {
                        supportClass = "sliver_or_near_collinear";

                        // Long spans require further evidence before
                        // they can be considered locally supported.
                    } else if (maxEdgeM > 30) {
                        supportClass = "long_span_unsupported_pending_evidence";

                        // Moderately long edges or significant RL variation
                        // indicate uncertain local survey support.
                    } else if (maxEdgeM > 20 || rlRangeM > 1) {
                        supportClass = "uncertain_local_support";
                    }

                    // -------------------------------------------------
                    // 16.12 Store Rejected Triangle Diagnostics
                    // -------------------------------------------------
                    //
                    // Record the geometric measurements, survey-point
                    // information and diagnostic classification for
                    // the rejected triangle.
                    //
                    // These records support later analysis of rejected
                    // regions and their relationship to accepted terrain.
                    //
                    // Recording evidence does not change acceptance.
                    //
                    // -------------------------------------------------

                    rejectedTriangleDiagnostics.push({

                        // Original triangle identifier and vertex indices.
                        triangleId: i / 3,
                        indices: [ia, ib, ic],

                        // Horizontal geometric measurements.
                        circumradiusM: Number(circumradius.toFixed(3)),
                        edgeAB_M: Number(edgeAB.toFixed(3)),
                        edgeBC_M: Number(edgeBC.toFixed(3)),
                        edgeCA_M: Number(edgeCA.toFixed(3)),
                        maxEdgeM: Number(maxEdgeM.toFixed(3)),
                        minAngleDegrees: Number(minimumAngleDegrees.toFixed(3)),
                        horizontalAreaM2: Number((twiceArea / 2).toFixed(3)),

                        // Survey support and elevation information.
                        rlRangeM: Number(rlRangeM.toFixed(3)),
                        vertexLocalSpacingM,
                        supportClass,

                        // Preserve the original survey information
                        // for all three triangle vertices.
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

                // Record triangles accepted through the selective reconstruction rules.
                // These triangles exceeded the normal circumradius limit but passed
                // the additional geometry and neighbourhood-support checks.
                if (selectivelyRestoreFacet) {

                    // Count how many triangles have been selectively restored.
                    selectivelyRestoredTriangles++;

                    // Preserve the evidence used to justify accepting this triangle.
                    selectivelyRestoredFacetReport.push({
                        triangleId: facetEvidence.triangleId,
                        indices: facetEvidence.indices,

                        // Record the principal geometric measurements.
                        circumradiusM: Number(facetEvidence.circumradiusM.toFixed(3)),
                        maxEdgeM: Number(facetEvidence.maxEdgeM.toFixed(3)),
                        minAngleDegrees: Number(facetEvidence.minAngleDegrees.toFixed(3)),
                        rlRangeM: Number(facetEvidence.rlRangeM.toFixed(3)),
                        medianVertexSpacingM: Number(facetEvidence.medianVertexSpacingM.toFixed(3)),

                        // Record the triangle's support from neighbouring accepted
                        // triangles and its relationship to the terrain hull.
                        acceptedNeighbours: facetEvidence.acceptedNeighbours,
                        hullEdgeCount: facetEvidence.hullEdgeCount,

                        // Preserve the original survey-point details for traceability.
                        vertices: [a, b, c].map(point => ({
                            pointNo: point.pointNo,
                            code: point.code,
                            easting: point.easting,
                            northing: point.northing,
                            rl: point.rl
                        }))
                    });
                }

                // Convert the three survey vertices from geographic coordinates
                // and RL values into the Three.js world coordinate system.
                const va = toWorld(a.easting, a.northing, a.rl);
                const vb = toWorld(b.easting, b.northing, b.rl);
                const vc = toWorld(c.easting, c.northing, c.rl);

                // Calculate two edges originating from the first vertex.
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

                // Calculate the triangle's normal vector.
                // Its orientation is used to determine the terrain slope.
                const normal = new THREE.Vector3()
                    .crossVectors(ab, ac)
                    .normalize();

                // Calculate the slope angle relative to the horizontal plane.
                const slopeDegrees = THREE.MathUtils.radToDeg(
                    Math.acos(
                        THREE.MathUtils.clamp(
                            Math.abs(normal.y),
                            0,
                            1
                        )
                    )
                );

                // Select the terrain colour according to the configured
                // fall-slope threshold.
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

                // Record the accepted triangle and update its count.
                acceptedTriangleIndices.push(ia, ib, ic);
                acceptedTriangles++;
            }

            // Read-only diagnostic: count how many accepted triangles share
            // each edge. An edge used once is a boundary edge; an edge used
            // twice is an interior edge.
            const diagnosticAcceptedEdgeCounts = new Map();

            // Create a consistent edge key regardless of vertex order.
            // This allows the same edge to be matched across triangles.
            function makeEdgeKey(a, b) {
                return a < b ? `${a},${b}` : `${b},${a}`;
            }

            const coverageEdgeCounts = new Map();

            // Process accepted triangles and count their three edges.
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

            // Expose edge counts for inspection in browser diagnostics.
            window.__acceptedEdgeCounts = Object.fromEntries(
                diagnosticAcceptedEdgeCounts
            );

            // Read-only diagnostic: find rejected triangles that share
            // an edge with the accepted terrain boundary.
            const rejectedTrianglesByAcceptedBoundaryEdge = new Map();

            for (let triangleIndex = 0;
                triangleIndex < rejectedTriangleDiagnostics.length;
                triangleIndex++) {
                const triangle = rejectedTriangleDiagnostics[triangleIndex];
                const [a, b, c] = triangle.indices;

                for (const [u, v] of [[a, b], [b, c], [c, a]]) {
                    const edgeKey = makeEdgeKey(u, v);

                    // Only consider edges used by exactly one accepted triangle.
                    if (diagnosticAcceptedEdgeCounts.get(edgeKey) !== 1) {
                        continue;
                    }

                    // Create an entry for this boundary edge when first encountered.
                    if (!rejectedTrianglesByAcceptedBoundaryEdge.has(edgeKey)) {
                        rejectedTrianglesByAcceptedBoundaryEdge.set(edgeKey, []);
                    }

                    // Associate the rejected triangle and its diagnostic evidence
                    // with the accepted boundary edge it shares.
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

            // Build a complete boundary-edge report, including edges
            // that have no adjacent rejected triangle.
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

            // Expose the adjacency report for browser-side inspection.
            window.__acceptedBoundaryRejectedAdjacency =
                acceptedBoundaryRejectedAdjacency;

            // Summarize how many accepted boundary edges have rejected
            // triangles beside them and how many do not.
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

            // Build an edge-to-triangle lookup for all rejected triangles.
            // Triangles sharing an edge will be treated as neighbours.
            const rejectedTriangleByEdge = new Map();

            rejectedTriangleDiagnostics.forEach((triangle, triangleIndex) => {
                const [a, b, c] = triangle.indices;
                const edges = [
                    makeEdgeKey(a, b),
                    makeEdgeKey(b, c),
                    makeEdgeKey(c, a)
                ];

                // Associate each triangle with its three shared-edge keys.
                for (const edgeKey of edges) {
                    if (!rejectedTriangleByEdge.has(edgeKey)) {
                        rejectedTriangleByEdge.set(edgeKey, []);
                    }
                    rejectedTriangleByEdge.get(edgeKey).push(triangleIndex);
                }
            });

            // Create a neighbour set for every rejected triangle.
            const rejectedNeighbours = rejectedTriangleDiagnostics.map(() => new Set());

            // Establish connections between rejected triangles that share an edge.
            for (const adjacentTriangles of rejectedTriangleByEdge.values()) {
                for (let i = 0; i < adjacentTriangles.length; i++) {
                    for (let j = i + 1; j < adjacentTriangles.length; j++) {
                        rejectedNeighbours[adjacentTriangles[i]].add(adjacentTriangles[j]);
                        rejectedNeighbours[adjacentTriangles[j]].add(adjacentTriangles[i]);
                    }
                }
            }

            // Track visited triangles so each connected region is processed once.
            const visitedRejectedTriangles = new Set();
            const rejectedRegions = [];

            // Start a connected-component search from every unvisited triangle.
            for (let seed = 0; seed < rejectedTriangleDiagnostics.length; seed++) {
                if (visitedRejectedTriangles.has(seed)) continue;

                // Use a stack to traverse all rejected triangles connected to this seed.
                const stack = [seed];
                const regionTriangleIds = [];
                visitedRejectedTriangles.add(seed);

                while (stack.length) {
                    const current = stack.pop();
                    regionTriangleIds.push(current);

                    // Add unvisited rejected neighbours to the current region.
                    for (const neighbour of rejectedNeighbours[current]) {
                        if (visitedRejectedTriangles.has(neighbour)) continue;
                        visitedRejectedTriangles.add(neighbour);
                        stack.push(neighbour);
                    }
                }

                // Initialise measurements and collections for the current region.
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

                // Aggregate geometry, coordinates, elevation and edge support
                // across every rejected triangle belonging to this region.
                for (const triangleId of regionTriangleIds) {
                    const triangle = rejectedTriangleDiagnostics[triangleId];
                    const [a, b, c] = triangle.indices;
                    areaM2 += triangle.horizontalAreaM2;
                    maxTriangleEdgeM = Math.max(maxTriangleEdgeM, triangle.maxEdgeM);

                    // Collect unique vertices and calculate the region's
                    // coordinate and elevation bounds.
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

                    // Count region edges and evaluate each edge against
                    // the local spacing of its endpoint survey points.
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

                        // Track the largest edge-to-local-spacing ratio
                        // and flag regions containing unsupported edges.
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

                // Identify the boundary edges of this connected rejected region.
                // An edge used once within the region belongs to its boundary.
                const regionBoundaryEdges = [...regionEdgeCounts.entries()]
                    .filter(([, count]) => count === 1)
                    .map(([key]) => key);

                // Check how many accepted triangles use each region boundary edge.
                const boundaryAcceptedCounts = regionBoundaryEdges.map(
                    edgeKey => diagnosticAcceptedEdgeCounts.get(edgeKey) || 0
                );

                // Determine whether every region boundary edge touches
                // exactly one accepted triangle.
                const boundaryEdgesAllTouchAcceptedMesh =
                    regionBoundaryEdges.length > 0 &&
                    boundaryAcceptedCounts.every(count => count === 1);

                // Detect boundary edges with no accepted neighbouring triangle.
                const hasUnsupportedOuterBoundary =
                    boundaryAcceptedCounts.some(count => count === 0);

                // Calculate the region's horizontal extent.
                const spanE = maxE - minE;
                const spanN = maxN - minN;
                const spanM = Math.hypot(spanE, spanN);

                // Assign a topological classification based on boundary evidence.
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

                // Store the region's classification, geometry measurements,
                // survey support and coordinate bounds.
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

            // Sort regions by area, largest first, and expose the report
            // for inspection in browser diagnostics.
            rejectedRegions.sort((a, b) => b.areaM2 - a.areaM2);
            window.__rejectedTerrainRegions = rejectedRegions;

            // Identify regions eligible for selective reconstruction.
            // Eligibility requires an enclosed boundary, local edge support
            // and a diagonal span within the configured limit.
            const eligibleReconstructionRegionIds = new Set(
                rejectedRegions
                    .filter(region =>
                        region.classification === "enclosed_candidate_gap" &&
                        region.allEdgesLocallySupported &&
                        region.diagonalSpanM <= MAX_RECONSTRUCTION_REGION_SPAN_M
                    )
                    .map(region => region.regionId)
            );

            // Track rejected triangles that have been reconstructed
            // and maintain a separate reconstruction count.
            const reconstructedRejectedTriangleIds = new Set();
            let selectivelyReconstructedTriangles = 0;

            // Reconstruction requires both the explicit feature switch
            // and at least one region that passed the eligibility checks.
            if (ENABLE_SELECTIVE_GAP_RECONSTRUCTION && eligibleReconstructionRegionIds.size) {
                for (const region of rejectedRegions) {
                    // Skip regions that did not pass the reconstruction assessment.
                    if (!eligibleReconstructionRegionIds.has(region.regionId)) continue;

                    // Retrieve the rejected triangles belonging to this region.
                    const regionTriangles = region.triangleIndices || [];
                    for (const triangleId of regionTriangles) {
                        const triangle = rejectedTriangleDiagnostics[triangleId];

                        // Skip missing triangles and triangles already reconstructed.
                        if (!triangle || reconstructedRejectedTriangleIds.has(triangleId)) continue;

                        // Retrieve the original survey vertices and convert them
                        // into Three.js world coordinates.
                        const [ia, ib, ic] = triangle.indices;
                        const a = terrainPoints[ia];
                        const b = terrainPoints[ib];
                        const c = terrainPoints[ic];
                        const va = toWorld(a.easting, a.northing, a.rl);
                        const vb = toWorld(b.easting, b.northing, b.rl);
                        const vc = toWorld(c.easting, c.northing, c.rl);

                        // Calculate the triangle normal and terrain slope.
                        const ab = new THREE.Vector3(vb.x - va.x, vb.y - va.y, vb.z - va.z);
                        const ac = new THREE.Vector3(vc.x - va.x, vc.y - va.y, vc.z - va.z);
                        const normal = new THREE.Vector3().crossVectors(ab, ac).normalize();
                        const slopeDegrees = THREE.MathUtils.radToDeg(
                            Math.acos(THREE.MathUtils.clamp(Math.abs(normal.y), 0, 1))
                        );

                        // Apply the same slope-based colour classification
                        // used for the baseline accepted terrain triangles.
                        const triangleColor = slopeDegrees >= FALL_SLOPE_THRESHOLD
                            ? fallColor
                            : naturalColor;

                        // Add the reconstructed triangle's vertices and colours
                        // to the terrain geometry buffers.
                        for (const point of [va, vb, vc]) {
                            terrainPositions.push(point.x, point.y, point.z);
                            terrainColors.push(triangleColor.r, triangleColor.g, triangleColor.b);
                        }

                        // Update accepted/rejected counts and record reconstruction.
                        acceptedTriangleIndices.push(ia, ib, ic);
                        reconstructedRejectedTriangleIds.add(triangleId);
                        selectivelyReconstructedTriangles++;
                        acceptedTriangles++;
                        rejectedTriangles--;
                        rejectedLargeCircumradius--;
                    }
                }
            }

            // Expose the reconstruction assessment for browser-side inspection.
            // This records whether reconstruction was enabled, how many regions
            // qualified, and how many rejected triangles were reconstructed.
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

            // Log a summary of connected rejected regions, their classifications,
            // reconstruction eligibility and the largest regions for review.
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

            // Build an edge-adjacency report for every rejected triangle.
            // This shows whether its edges coincide with accepted boundary,
            // interior or unexpected accepted-mesh edges.
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

            // Expose the rejected-triangle edge report for inspection.
            window.__rejectedEdgeAdjacencyReport = rejectedEdgeAdjacencyReport;

            // Inspect the first rejected triangle separately to make its
            // individual edge relationships easier to examine.
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

            // Log the individual edge check for the first rejected triangle.
            console.info(
                "[Survey Terrain] First rejected triangle edge check:",
                firstRejectedEdgeCheck
            );

            // Summarize accepted-mesh edge topology and rejected-triangle
            // relationships to support review of terrain coverage.
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

            // Expose the selectively restored facet evidence and report
            // the rules used by the individual-facet reconstruction gate.
            window.__selectivelyRestoredTerrainFacets = selectivelyRestoredFacetReport;
            console.info("[Survey Terrain] Selective reconstruction gate:", {
                enabled: ENABLE_SELECTIVE_GAP_RECONSTRUCTION,
                rule: reconstructionRule,
                restoredFacetCount: selectivelyRestoredTriangles,
                restoredFacets: selectivelyRestoredFacetReport,
                note: "Only non-hull facets passing all geometric/local-support gates are restored. This is a conservative visualization heuristic, not an authoritative surveyed surface."
            });

            // Summarize the baseline terrain triangulation filtering results.
            console.info("[Survey Terrain] TIN support filtering:", {
                inputTriangles: triangles.length / 3,
                acceptedTriangles,
                rejectedTriangles,
                maximumCircumradiusM: MAX_TERRAIN_CIRCUMRADIUS_M,
                rejectedDegenerate,
                rejectedLargeCircumradius,
                selectivelyRestoredTriangles
            });

            // Expose detailed rejected-triangle evidence and group the
            // rejected facets by their assigned support classification.
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

            // Log the rejected-facet classification totals for review.
            console.info("[Survey Terrain] Rejected-facet support triage:", {
                count: rejectedTriangleDiagnostics.length,
                byClass: window.__rejectedFacetSupportReport.byClass,
                note: window.__rejectedFacetSupportReport.note
            });

            // Attach the accepted terrain vertex coordinates to the geometry.
            terrainGeometry.setAttribute(
                "position",
                new THREE.Float32BufferAttribute(terrainPositions, 3)
            );

            // Attach the per-vertex colour data used to distinguish terrain slopes.
            terrainGeometry.setAttribute(
                "color",
                new THREE.Float32BufferAttribute(terrainColors, 3)
            );

            // Calculate surface normals for lighting and terrain shading.
            terrainGeometry.computeVertexNormals();

            // Configure the material using vertex colours and double-sided rendering.
            const terrainMaterial = new THREE.MeshStandardMaterial({
                vertexColors: true,
                roughness: 0.85,
                metalness: 0.05,
                flatShading: true,
                side: THREE.DoubleSide,
                wireframe: false
            });

            // Create the primary accepted terrain mesh.
            const terrainMesh = new THREE.Mesh(
                terrainGeometry,
                terrainMaterial
            );

            // TERRAIN GAP DIAGNOSTIC — VISUALIZATION ONLY
            // Do not fill rejected triangles or alter the authoritative terrain.

            // TERRAIN GAP DIAGNOSTIC — VISUALIZATION ONLY
            // Do not fill rejected triangles or alter the authoritative terrain.

            // Expose accepted and rejected triangle counts and confirm
            // that the accepted terrain mesh was created.
            window.__terrainGapDiagnostic = {
                acceptedTriangleCount: acceptedTriangleIndices.length / 3,
                rejectedTriangleCount: rejectedTriangleDiagnostics.length,
                acceptedTerrainMeshExists: !!terrainMesh,
                acceptedTerrainVertexCount:
                    terrainGeometry.getAttribute("position")?.count ?? 0,
                engineeringUse: false
            };

            // Log the diagnostic summary for browser-side inspection.
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

            // Collect vertices from rejected triangles that remain unreconstructed.
            for (const candidate of rejectedTriangleDiagnostics) {

                // Exclude triangles already incorporated into accepted terrain.
                if (reconstructedRejectedTriangleIds.has(candidate.triangleId)) {
                    continue;
                }

                const [ia, ib, ic] = candidate.indices;
                const a = terrainPoints[ia];
                const b = terrainPoints[ib];
                const c = terrainPoints[ic];

                // Skip triangles with missing survey-point references.
                if (!a || !b || !c) continue;

                // Convert each original survey vertex into world coordinates.
                for (const point of [a, b, c]) {
                    const worldPoint = toWorld(
                        point.easting,
                        point.northing,
                        point.rl
                    );

                    // Store the converted coordinates for the overlay geometry.
                    cyanTerrainPositions.push(
                        worldPoint.x,
                        worldPoint.y,
                        worldPoint.z
                    );
                }
            }

            // Initialise the overlay mesh reference.
            let cyanTerrainMesh = null;

            // Create the overlay only when rejected-triangle vertices exist.
            if (cyanTerrainPositions.length > 0) {
                const cyanTerrainGeometry = new THREE.BufferGeometry();

                // Attach the rejected-triangle vertex positions.
                cyanTerrainGeometry.setAttribute(
                    "position",
                    new THREE.Float32BufferAttribute(
                        cyanTerrainPositions,
                        3
                    )
                );

                // Calculate normals for the overlay surface.
                cyanTerrainGeometry.computeVertexNormals();

                // Configure a transparent cyan material so the underlying
                // accepted terrain and other details remain visible.
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

                // Create and configure the separate visual overlay mesh.
                cyanTerrainMesh = new THREE.Mesh(
                    cyanTerrainGeometry,
                    cyanTerrainMaterial
                );

                cyanTerrainMesh.name = "cyan-visual-terrain-overlay";
                cyanTerrainMesh.renderOrder = 2;
                cyanTerrainMesh.visible = false;
            }

            // Expose the cyan overlay status and its triangle count.
            // This overlay is for visual diagnosis only, not engineering use.
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

            // Count how many accepted triangles use each edge.
            // Edges appearing once form the accepted terrain boundary.
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
                    // Use a consistent key so reversed vertex order
                    // still identifies the same undirected edge.
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

            // Retain only edges used by exactly one accepted triangle.
            const boundaryEdges = [...coverageEdgeCounts.values()]
                .filter(edge => edge.count === 1);

            // Build vertex-to-boundary-edge adjacency.
            // Each edge is registered in both directions to support traversal.
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

            // Start a graph traversal from every boundary edge not yet visited.
            for (let seed = 0; seed < boundaryEdges.length; seed++) {
                if (visitedBoundaryEdges.has(seed)) continue;

                const componentEdges = new Set();
                const componentVertices = new Set();
                const stack = [seed];

                // Traverse all boundary edges connected to the current seed.
                while (stack.length > 0) {
                    const edgeId = stack.pop();
                    if (visitedBoundaryEdges.has(edgeId)) continue;

                    visitedBoundaryEdges.add(edgeId);
                    componentEdges.add(edgeId);

                    // Collect the vertices belonging to this component.
                    const edge = boundaryEdges[edgeId];
                    componentVertices.add(edge.a);
                    componentVertices.add(edge.b);

                    // Follow every boundary edge connected to either endpoint.
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

                // Components that do not form simple cycles cannot be used
                // as closed terrain boundary loops. Retain their edges separately.
                if (!isSimpleCycle) {
                    for (const edgeId of componentEdges) {
                        secondaryBoundaryEdgeIds.add(edgeId);
                    }
                    continue;
                }

                // Start traversing the component from its first edge.
                const firstEdgeId = componentEdges.values().next().value;
                const firstEdge = boundaryEdges[firstEdgeId];
                const startVertex = firstEdge.a;
                const loopVertices = [startVertex];
                const orderedEdgeIds = new Set();
                let currentVertex = startVertex;
                let previousEdgeId = -1;
                let closed = false;

                // Follow connected boundary edges until the traversal
                // returns to its starting vertex or cannot continue.
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

                // Reject incomplete traversals and retain their edges
                // as secondary boundaries.
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

                // Validate coordinates and calculate the signed polygon area
                // using the shoelace formula.
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

                // Invalid coordinate data prevents this component
                // from being accepted as a valid closed loop.
                if (!validCoordinates) {
                    for (const edgeId of componentEdges) {
                        secondaryBoundaryEdgeIds.add(edgeId);
                    }
                    continue;
                }

                // Store the ordered loop and its absolute horizontal area.
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

            // Count how many times each boundary edge appears in valid loops
            // and secondary boundary components.
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

            // Include edges belonging to components that were not valid loops.
            for (const edgeId of secondaryBoundaryEdgeIds) {
                boundaryEdgeMembership.set(
                    edgeId,
                    (boundaryEdgeMembership.get(edgeId) || 0) + 1
                );
            }

            // Identify boundary edges that were omitted or counted more than once.
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

            // Calculate the number of edges in valid loops and secondary components.
            const closedLoopEdgeCount = boundaryLoops.reduce(
                (sum, loop) => sum + loop.edgeIds.size,
                0
            );

            const unclosedOrInvalidEdgeCount =
                secondaryBoundaryEdgeIds.size;

            // Expose the complete boundary-accounting result.
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

            // Log the boundary-edge completeness result.
            console.info(
                "[Survey Terrain] Boundary completeness:",
                window.__boundaryCompletenessDiagnostic
            );

            // TEMPORARY READ-ONLY DIAGNOSTIC:
            // Summarize every accepted-mesh boundary loop and its
            // containment relationship. Does not alter the design.

            // Determine whether a survey coordinate lies inside a polygon
            // using the ray-casting point-in-polygon method.
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

            // Build a summary for each closed boundary loop.
            // Evaluate its coordinate validity and possible containment
            // by other loops with larger enclosed areas.
            const boundaryLoopSummary = boundaryLoops.map(
                (loop, index) => {
                    const uniqueVertices = new Set(loop.vertices);
                    const coordinatesValid = loop.vertices.every(vertex => {
                        const p = terrainPoints[vertex];
                        return p &&
                            Number.isFinite(p.easting) &&
                            Number.isFinite(p.northing);
                    });

                    // Test larger loops as possible containers.
                    const possibleContainers = boundaryLoops
                        .map((candidate, candidateIndex) => {
                            if (
                                candidateIndex === index ||
                                candidate.area <= loop.area ||
                                !coordinatesValid
                            ) {
                                return null;
                            }

                            // A candidate is considered a possible container
                            // when all vertices of the current loop lie inside it.
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
                        // The smallest containing loop is the nearest possible container.
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

            // Expose and log the loop containment report.
            window.__boundaryLoopSummary = boundaryLoopSummary;

            console.table(boundaryLoopSummary);

            console.info(
                "[Survey Terrain] Boundary-loop summary:",
                boundaryLoopSummary
            );

            // Sort closed loops by enclosed area, largest first.
            // The largest loop becomes the primary visual perimeter.
            boundaryLoops.sort((a, b) => b.area - a.area);
            const primaryPerimeterEdgeIds = boundaryLoops.length
                ? boundaryLoops[0].edgeIds
                : new Set();

            // Expose primary-loop details and inspect a selected vertex sequence.
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

            // Classify every boundary edge not belonging to the primary
            // perimeter as a secondary coverage edge.
            for (let i = 0; i < boundaryEdges.length; i++) {
                if (!primaryPerimeterEdgeIds.has(i)) {
                    secondaryBoundaryEdgeIds.add(i);
                }
            }

            // Create separate coordinate buffers for the primary perimeter
            // and all remaining terrain coverage edges.
            const primaryPerimeterPositions = [];
            const secondaryCoveragePositions = [];

            // Convert every accepted boundary edge into world coordinates
            // and place it in the appropriate visual boundary buffer.
            for (let i = 0; i < boundaryEdges.length; i++) {
                const edge = boundaryEdges[i];
                const a = terrainPoints[edge.a];
                const b = terrainPoints[edge.b];
                const va = toWorld(a.easting, a.northing, a.rl);
                const vb = toWorld(b.easting, b.northing, b.rl);

                // Route primary-loop edges and secondary edges separately.
                const target = primaryPerimeterEdgeIds.has(i)
                    ? primaryPerimeterPositions
                    : secondaryCoveragePositions;
                target.push(va.x, va.y, va.z, vb.x, vb.y, vb.z);
            }

            // Reusable helper for creating visual boundary line segments.
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

            // Create the red primary perimeter guide.
            const primaryPerimeterGuide = makeBoundaryLine(
                primaryPerimeterPositions,
                0xff3333, // Red outer boundary; alignment centreline remains orange.
                1.0,
                "Primary terrain coverage perimeter (visual estimate)",
                11
            );

            // Create the yellow secondary coverage guide.
            const secondaryCoverageGuide = makeBoundaryLine(
                secondaryCoveragePositions,
                0xf4d35e,
                0.9,
                "Secondary terrain coverage edges and open boundary chains",
                10
            );

            // Section 16.42: Point-in-polygon test for boundary containment.
            // Uses the ray-casting method in survey Easting/Northing coordinates.
            // This determines whether a boundary vertex lies inside another loop.
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

            // Section 16.43: Determine the parent boundary of each loop.
            // A loop is enclosed only when all its vertices lie inside a larger loop.
            // When multiple enclosing loops exist, select the smallest enclosing parent.
            // This establishes the nesting relationship between terrain boundaries.
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

            // Section 16.44: Classify nested boundaries using containment depth.
            // Even nesting depth represents an outer boundary or enclosed terrain island.
            // Odd nesting depth represents a candidate interior coverage gap.
            // Invalid parent cycles are excluded from the classification.
            // These candidates are diagnostic only; they do not establish missing terrain elevations.
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

            // Section 16.45: Build visual markers for candidate interior gaps.
            // Each candidate receives a flat pink fill positioned near its mean terrain elevation.
            // Cyan outline segments trace the candidate boundary.
            // These are visual indicators only, not reconstructed terrain surfaces.
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
                    transparent: false,
                    opacity: 0.88,
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

            // Section 16.46: Publish candidate-gap evidence and coverage summary.
            // Records each candidate's area and boundary vertex coordinates.
            // Exposes the results through window.__candidateGapVertexDiagnostics
            // and window.__terrainCoverageGaps for inspection.
            // The diagnostic explicitly avoids inferring terrain elevations inside gaps.
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
                    depthTest: true,
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

            // Section 16.47: Assemble terrain coverage and diagnostic layers.
            // Adds the primary perimeter, secondary boundaries, cyan terrain,
            // candidate-gap fills and outlines to the terrain group.
            // The group is then added to the main Three.js scene.
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


            // Section 16.48: Log the candidate interior-gap assessment
            // and terrain coverage summary for browser-console inspection.
            // These summaries report visual topology diagnostics, not
            // an authoritative engineering boundary or terrain reconstruction.
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

            // Section 16.49: Terrain visibility control.
            // Toggles the complete terrain group, including its coverage guides
            // and diagnostic overlays, without removing the underlying objects.
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

        // Section 16.50: Add the surveyed-point layer independently.
        // Survey points remain a separate scene object, with their own visibility
        // control, so they can be viewed independently of the terrain layer.
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

        // =========================================================
        // Ultra-HD Milestone Plate Generator (Near-View Sharpness)
        // =========================================================
        function createChainageSprite(chKm, chM) {
            const canvas = document.createElement("canvas");
            // 2048 x 1024 ultra-HD internal canvas to eliminate pixel blur
            canvas.width = 2048;
            canvas.height = 1024;
            const ctx = canvas.getContext("2d");

            const w = canvas.width;
            const h = canvas.height;
            const r = 96; // Scaled corner radius

            // Outer Plate Background
            ctx.fillStyle = "#090d13";
            ctx.beginPath();
            ctx.roundRect(64, 64, w - 128, h - 128, r);
            ctx.fill();

            // Outer Plate Neon Border
            ctx.strokeStyle = "#388bfd";
            ctx.lineWidth = 24;
            ctx.stroke();

            // Top Header Pill: "CHAINAGE"
            ctx.fillStyle = "#1f6feb";
            ctx.beginPath();
            ctx.roundRect(64, 64, w - 128, 256, [r, r, 0, 0]);
            ctx.fill();

            // Top Header Text
            ctx.fillStyle = "#ffffff";
            ctx.font = "900 110px 'Segoe UI', -apple-system, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("CHAINAGE", w / 2, 192);

            // Main Value: Crisp Big Numbers (e.g., "4 + 434")
            ctx.fillStyle = "#58a6ff";
            ctx.font = "bold 260px 'Consolas', 'Courier New', monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(`${chKm} + ${chM}`, w / 2, 570);

            // Bottom Subtitle (Thick and fully legible from distance)
            ctx.fillStyle = "#8b949e";
            ctx.font = "bold 90px 'Segoe UI', sans-serif";
            ctx.fillText("KM  +  METERS", w / 2, 830);

            const texture = new THREE.CanvasTexture(canvas);

            // Enable high-definition Mipmaps & Anisotropic Filtering
            texture.generateMipmaps = true;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.magFilter = THREE.LinearFilter;

            // Maximizes crispness at oblique camera angles
            if (renderer && renderer.capabilities) {
                texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
            }

            const spriteMat = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                alphaTest: 0.05,       // Discards fully transparent canvas pixels immediately
                depthTest: true,
                depthWrite: true       // Plate writes depth so it stays crisp in front of the post/sky
            });

            const sprite = new THREE.Sprite(spriteMat);
            // 8m wide x 4m tall world scale (compact, balanced proportions)
            sprite.scale.set(8.0, 4.0, 1.0);
            sprite.renderOrder = 1000;
            return sprite;
        }

        let cleanRoadCenterPoints = null;

        // Section 17.1: Road centreline projection helper.
        // Finds the closest position on the imported alignment to a supplied
        // Easting/Northing coordinate. Also interpolates RL and calculates heading.
        // Used later to position culvert markers relative to the road.
        function getRoadCenterlineProjection(easting, northing) {
            const alignList = (cleanRoadCenterPoints && cleanRoadCenterPoints.length > 1)
                ? cleanRoadCenterPoints
                : (validAlignment && validAlignment.length > 1)
                    ? validAlignment.map(p => ({ e: Number(p.Easting), n: Number(p.Northing), rl: Number(p.RL ?? p.ExistingRL ?? baseRL) }))
                    : null;

            if (!alignList || alignList.length < 2) {
                return {
                    e: Number(easting),
                    n: Number(northing),
                    rl: baseRL,
                    heading: 0
                };
            }

            let bestDistSq = Infinity;
            let bestE = Number(easting);
            let bestN = Number(northing);
            let bestRL = baseRL;
            let bestHeading = 0;

            for (let i = 0; i < alignList.length - 1; i++) {
                const p1 = alignList[i];
                const p2 = alignList[i + 1];

                const dx = p2.e - p1.e;
                const dz = p2.n - p1.n;
                const lenSq = dx * dx + dz * dz;

                if (lenSq < 1e-8) continue;

                const t = Math.max(0, Math.min(1, ((easting - p1.e) * dx + (northing - p1.n) * dz) / lenSq));

                const projE = p1.e + t * dx;
                const projN = p1.n + t * dz;
                const distSq = (easting - projE) * (easting - projE) + (northing - projN) * (northing - projN);

                if (distSq < bestDistSq) {
                    bestDistSq = distSq;
                    bestE = projE;
                    bestN = projN;
                    bestRL = p1.rl + t * (p2.rl - p1.rl);
                    bestHeading = Math.atan2(dx, dz);
                }
            }

            return {
                e: bestE,
                n: bestN,
                rl: bestRL,
                heading: bestHeading
            };
        }

        // Section 17.2: Generate the visual road from imported alignment data.
        // Orders alignment points by chainage and prepares road geometry,
        // outer boundaries and centreline using the surveyed coordinates.
        // This is display geometry, not a modification of engineering inputs.
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


            // Section 17.3: Determine the elevation used for each alignment point.
            // Prefer the alignment's ExistingRL when valid.
            // Otherwise, use the RL of the nearest valid survey point.
            // Fall back to baseRL when no survey point is available.
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

            // Section 17.4: Densify the road centreline.
            // Insert interpolated Easting, Northing and RL points between
            // original alignment points to reduce visible gaps in the road surface.
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

            // Section 17.5: Compare alignment elevations against the datum RL.
            // Count points above, below and within the datum tolerance.
            // Calculate minimum and maximum elevation differences and update
            // the corresponding UI values and diagnostic log.
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

            // Section 17.6: Remove consecutive duplicate centreline positions.
            // Calculate local direction and perpendicular offsets to construct
            // the left and right road edges, centreline and triangle indices.
            const cleanCenters = roadCenters.filter((p, i, arr) => {
                if (i === 0) return true;

                const previous = arr[i - 1];
                return Math.hypot(p.e - previous.e, p.n - previous.n) > 0.001;
            });
            cleanRoadCenterPoints = cleanCenters;

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

            // Section 17.7: Build the 3D road surface and its supporting geometry.
            // Create indexed triangles, assign elevation-relative colours,
            // generate side skirts for visual thickness, and assemble the
            // road surface, alignment line and red outer-boundary guides.
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
                    color = new THREE.Color(0x1976D2); // Solid deep cobalt road surface
                } else if (rlDifference < -DATUM_ELEVATION_TOLERANCE_M) {
                    color = new THREE.Color(0xD32F2F); // Solid deep crimson road surface
                } else {
                    color = new THREE.Color(0x2d3440); // Solid dark asphalt pavement
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
                roughness: 1.0,
                metalness: 0.12,
                side: THREE.DoubleSide,
                transparent: false,
                depthWrite: true,
                depthTest: true
            });

            const roadSurface = new THREE.Mesh(roadGeometry, roadMaterial);
            roadSurface.renderOrder = 1;

            // 3D Physical Road Embankment / Side Skirts (Gives the road solid thickness)
            const skirtPositions = [];
            const skirtIndices = [];
            let skirtVertCount = 0;
            const skirtDropM = 0.45; // Physical vertical thickness of the pavement prism

            for (let i = 0; i < cleanCenters.length - 1; i++) {
                const a = i * 2;
                const b = a + 1;
                const c = (i + 1) * 2;
                const d = c + 1;

                // Left Edge Skirt Face
                const l1_top = [roadPositions[a * 3], roadPositions[a * 3 + 1], roadPositions[a * 3 + 2]];
                const l2_top = [roadPositions[c * 3], roadPositions[c * 3 + 1], roadPositions[c * 3 + 2]];
                const l1_bot = [l1_top[0], l1_top[1] - skirtDropM, l1_top[2]];
                const l2_bot = [l2_top[0], l2_top[1] - skirtDropM, l2_top[2]];

                const idx = skirtVertCount;
                skirtPositions.push(...l1_top, ...l2_top, ...l1_bot, ...l2_bot);
                skirtIndices.push(idx, idx + 1, idx + 2, idx + 1, idx + 3, idx + 2);
                skirtVertCount += 4;

                // Right Edge Skirt Face
                const r1_top = [roadPositions[b * 3], roadPositions[b * 3 + 1], roadPositions[b * 3 + 2]];
                const r2_top = [roadPositions[d * 3], roadPositions[d * 3 + 1], roadPositions[d * 3 + 2]];
                const r1_bot = [r1_top[0], r1_top[1] - skirtDropM, r1_top[2]];
                const r2_bot = [r2_top[0], r2_top[1] - skirtDropM, r2_top[2]];

                const rIdx = skirtVertCount;
                skirtPositions.push(...r1_top, ...r2_top, ...r1_bot, ...r2_bot);
                skirtIndices.push(rIdx, rIdx + 2, rIdx + 1, rIdx + 1, rIdx + 2, rIdx + 3);
                skirtVertCount += 4;
            }

            const skirtGeo = new THREE.BufferGeometry();
            skirtGeo.setAttribute("position", new THREE.Float32BufferAttribute(skirtPositions, 3));
            skirtGeo.setIndex(skirtIndices);
            skirtGeo.computeVertexNormals();

            // Road Skirt / Side Embankment Material
            const skirtMat = new THREE.MeshStandardMaterial({
                color: 0x242a33,
                roughness: 0.85,
                metalness: 0.1,
                side: THREE.DoubleSide,
                transparent: false,
                depthWrite: true,
                depthTest: true
            });

            const roadSkirtMesh = new THREE.Mesh(skirtGeo, skirtMat);
            roadSkirtMesh.renderOrder = 1;

            const alignmentLayer = new THREE.Group();
            alignmentLayer.add(roadSurface);
            alignmentLayer.add(roadSkirtMesh);
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

            // Section 17.8: Place chainage milestones along the alignment.
            // Select milestone positions using the configured interval,
            // then create a 3D post and chainage label at each selected position.

            // =========================================================
            // Place 3D Milestones Every 500m along the Alignment
            // =========================================================
            const chainageGroup = new THREE.Group();
            chainageGroup.name = "Alignment Chainage Milestones";

            let lastMilestoneCh = -Infinity;
            const milestoneIntervalM = 500; // Place every 500m

            orderedAlignment.forEach(p => {
                const ch = Number(p.Chainage);
                if (!Number.isFinite(ch)) return;

                if (ch - lastMilestoneCh >= milestoneIntervalM || lastMilestoneCh === -Infinity) {
                    lastMilestoneCh = ch;

                    const pos = toWorld(p.Easting, p.Northing, getAlignmentRL(p));
                    const chKm = Math.floor(ch / 1000);
                    const chM = Math.floor(ch % 1000).toString().padStart(3, '0');

                    // Milestone Post: wider foundation post
                    const postGeo = new THREE.CylinderGeometry(0.25, 0.35, 4.0, 12);
                    const postMat = new THREE.MeshStandardMaterial({
                        color: 0x30363d,
                        roughness: 0.6,
                        metalness: 0.2
                    });
                    const postMesh = new THREE.Mesh(postGeo, postMat);
                    postMesh.position.set(pos.x, pos.y + 2.0, pos.z);
                    chainageGroup.add(postMesh);

                    // Large 3D Signboard Plate mounted at eye level above the post
                    const sprite = createChainageSprite(chKm, chM);
                    sprite.position.set(pos.x, pos.y + 6.2, pos.z);
                    chainageGroup.add(sprite);
                }
            });

            alignmentLayer.add(chainageGroup);

            // Section 17.9: Road alignment visibility control.
            // Toggles the road surface, side skirts, centreline, boundaries
            // and chainage milestones together.
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

        // Section 17.10: Resolve culvert locations from surveyed point numbers.
        // Match each culvert's SurveyPointNos against valid survey records.
        // Calculate the average Easting, Northing and RL of its matched points.
        // Store the resulting position and source information for visualization.
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

            // Section 17.11: Create visual markers for detected culverts.
            // Project each culvert position onto the road centreline.
            // Build a vertical pole and diamond beacon at the projected location.
            // Confirmation status determines the marker colour.
            // =========================================================
            // 3D Glowing Culvert Beacons & Location Badges
            // =========================================================
            const culvertPinGroup = new THREE.Group();
            culvertPinGroup.name = "Culvert 3D Pins";
            const roadSurfaceLift = (typeof visualLift !== "undefined") ? visualLift : 0.15;

            culvertMarkerData.forEach((marker, idx) => {
                // Project surveyed point onto road centerline to align with road center
                const roadProj = getRoadCenterlineProjection(marker.easting, marker.northing);
                const roadWorldPos = toWorld(roadProj.e, roadProj.n, roadProj.rl);
                const isConfirmed = marker.data && marker.data.IsConfirmed;
                const pinColor = isConfirmed ? 0x3fb950 : 0xf0883e; // Green if Confirmed, Orange if Pending

                // Vertical pole (4m tall) placed directly on the road centerline above the culvert deck
                const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 4.0, 8);
                const poleMat = new THREE.MeshBasicMaterial({ color: 0x238636, transparent: false, opacity: 0.85 });
                const pole = new THREE.Mesh(poleGeo, poleMat);
                pole.position.set(roadWorldPos.x, roadWorldPos.y + roadSurfaceLift + 2.0, roadWorldPos.z);
                pole.userData = { culvertIndex: idx };
                culvertPinGroup.add(pole);

                // Diamond beacon on top
                const diamondGeo = new THREE.OctahedronGeometry(0.9, 0);
                const diamondMat = new THREE.MeshStandardMaterial({
                    color: 0x0f5132,
                    emissive: 0x0a3622,
                    emissiveIntensity: 0.4,
                    roughness: 0.25,
                    metalness: 0.2
                });
                const diamond = new THREE.Mesh(diamondGeo, diamondMat);
                diamond.position.set(roadWorldPos.x, roadWorldPos.y + roadSurfaceLift + 4.5, roadWorldPos.z);
                diamond.userData = { culvertIndex: idx };
                culvertPinGroup.add(diamond);

                // Safely extract Chainage
                const ch = Number(marker.data && marker.data.Chainage ? marker.data.Chainage : 0);
                const chText = `CULV #${marker.data?.LocationIndex ?? idx + 1} • Ch. ${(ch / 1000).toFixed(3)}`;
            });

            scene.add(culvertPinGroup);

            // Section 17.12: Identify the active project and obtain culvert solid data.
            // Read the project ID from the page or URL.
            // Check sessionStorage first, then use the temporary test-data fallback
            // when no cached solid model is available.
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

            //  * REMOVE WHEN TRIAL CULVERT TO BE REMOVED *  //
            if (!currentSolidData && window.CULVERT_TEST_SOLID_DATA) {
                currentSolidData = window.CULVERT_TEST_SOLID_DATA;
            }

            // Section 17.13: Create the parent group for all culvert solid models.
            // This group provides a common scene object for rendering,
            // visibility control and replacement of existing models.
            const culvertSolidsGroup = new THREE.Group();
            culvertSolidsGroup.name = "All_Culvert_3D_Solids";
            scene.add(culvertSolidsGroup);

            // Section 17.14: Determine road direction at a specified chainage.
            // Uses consecutive alignment points to calculate the road heading angle.
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

            // Section 17.15: Convert imported culvert solid definitions into Three.js geometry.
            // Establish a local origin using road and culvert reference geometry.
            // Convert solid faces into triangle geometry, including special
            // triangulation handling for PipeBaseArea polygons.
            // Assign layer-specific materials and dark edge outlines.
            // Preserve the source layer information in mesh.userData.
            function buildCulvertSolidMeshGroup(sourceData) {
                const data = sourceData || currentSolidData || window.CULVERT_TEST_SOLID_DATA;
                const group = new THREE.Group();
                group.name = "Culvert_3D_Solid_Assembly";
                if (!data || !data.solids) return group;

                // Center the culvert assembly so that local (0, 0, 0) corresponds exactly to:
                // X = 0: Centerline of the road carriageway
                // Y = 0: Top surface of the road deck
                // Z = 0: Center of the culvert barrel along the road
                let roadCenterX = 0;
                let roadCenterZ = 0;
                let roadTopY = 0;

                const bcSolid = data.solids.find(s => s.layer === 'BC' || s.layer === 'DBM');
                if (bcSolid && bcSolid.parts && bcSolid.parts.length > 0) {
                    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxY = -Infinity;
                    bcSolid.parts.forEach(p => {
                        (p.vertices || []).forEach(v => {
                            if (v[0] < minX) minX = v[0];
                            if (v[0] > maxX) maxX = v[0];
                            if (v[1] > maxY) maxY = v[1];
                            if (v[2] < minZ) minZ = v[2];
                            if (v[2] > maxZ) maxZ = v[2];
                        });
                    });
                    if (isFinite(minX) && isFinite(maxX)) roadCenterX = (minX + maxX) / 2;
                    if (isFinite(minZ) && isFinite(maxZ)) roadCenterZ = (minZ + maxZ) / 2;
                    if (isFinite(maxY)) roadTopY = maxY;
                } else {
                    const leftWall = data.solids.find(s => s.layer === 'LeftWall');
                    const rightWall = data.solids.find(s => s.layer === 'RightWall');
                    if (leftWall && rightWall && leftWall.parts && rightWall.parts) {
                        let leftMaxX = -Infinity, rightMinX = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
                        leftWall.parts.forEach(p => (p.vertices || []).forEach(v => {
                            if (v[0] > leftMaxX) leftMaxX = v[0];
                            if (v[1] > maxY) maxY = v[1];
                            if (v[2] < minZ) minZ = v[2];
                            if (v[2] > maxZ) maxZ = v[2];
                        }));
                        rightWall.parts.forEach(p => (p.vertices || []).forEach(v => {
                            if (v[0] < rightMinX) rightMinX = v[0];
                            if (v[1] > maxY) maxY = v[1];
                            if (v[2] < minZ) minZ = v[2];
                            if (v[2] > maxZ) maxZ = v[2];
                        }));
                        if (isFinite(leftMaxX) && isFinite(rightMinX)) roadCenterX = (leftMaxX + rightMinX) / 2;
                        if (isFinite(minZ) && isFinite(maxZ)) roadCenterZ = (minZ + maxZ) / 2;
                        if (isFinite(maxY)) roadTopY = maxY;
                    } else if (data.bounds && data.bounds.min && data.bounds.max) {
                        roadCenterX = (data.bounds.min[0] + data.bounds.max[0]) / 2;
                        roadCenterZ = (data.bounds.min[2] + data.bounds.max[2]) / 2;
                        roadTopY = data.bounds.max[1];
                    }
                }

                function buildPartMesh(part, color, layer) {
                    const geom = new THREE.BufferGeometry();
                    const positions = [];

                    for (const f of part.faces) {
                        if (layer === 'PipeBaseArea' && f.length > 3) {
                            const pts = f.map(ix => {
                                const raw = part.vertices[ix];
                                return [raw[0] - roadCenterX, raw[1] - roadTopY, raw[2] - roadCenterZ];
                            });
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
                                    for (const ix of [0, i, i + 1]) positions.push(...pts[ix]);
                                }
                            }
                        } else {
                            for (let i = 1; i < f.length - 1; i++) {
                                for (const ix of [f[0], f[i], f[i + 1]]) {
                                    const raw = part.vertices[ix];
                                    positions.push(raw[0] - roadCenterX, raw[1] - roadTopY, raw[2] - roadCenterZ);
                                }
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

            // Section 17.16: Place or replace 3D culvert models.
            // Dispose of previously rendered geometry and materials.
            // Build one model for each detected culvert, maintain unit scale,
            // position it at the road projection and orient it along the road heading.
            // Refresh the CAD layers drawer after rendering.
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

                const roadSurfaceLift = (typeof visualLift !== 'undefined') ? visualLift : 0.15;

                culvertMarkerData.forEach(marker => {
                    const culvertModel = buildCulvertSolidMeshGroup(solidData);

                    // 1. Maintain 1:1 true physical engineering geometry
                    culvertModel.scale.set(1, 1, 1);

                    // 2. Project surveyed culvert point onto road centerline to align with road curve & center
                    const roadProj = getRoadCenterlineProjection(marker.easting, marker.northing);
                    const roadWorldPos = toWorld(roadProj.e, roadProj.n, roadProj.rl);

                    // 3. Align culvert deck flush with the road pavement surface (local Y=0 is road deck)
                    culvertModel.position.set(
                        roadWorldPos.x,
                        roadWorldPos.y + roadSurfaceLift,
                        roadWorldPos.z
                    );

                    // 4. Orient along the exact road curve tangent at this projection point
                    culvertModel.rotation.y = roadProj.heading;

                    culvertModel.renderOrder = 25;

                    culvertSolidsGroup.add(culvertModel);
                });

                // Update Culvert Parts in unified CAD Layers Drawer
                updateCulvertLayersDrawer(solidData);
            }

            // Section 17.17: Build the culvert-parts layer controls.
            // Count parts by source layer, display their colours and counts,
            // and provide individual visibility checkboxes.
            // All and None controls toggle visibility across the culvert models.
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

            // Section 17.18: Load and render the available culvert solid model.
            // Render cached or test data first when valid.
            // Then request the project's saved solid model from MongoDB.
            // A successfully retrieved model replaces the current rendered model.
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
                            } catch (e) { }
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
                    const isVisible = !culvertSolidsGroup.visible;
                    culvertSolidsGroup.visible = isVisible;
                    if (typeof culvertPinGroup !== "undefined") culvertPinGroup.visible = isVisible;
                    if (typeof markers !== "undefined") markers.visible = isVisible;
                    if (!isVisible && typeof infoBox !== "undefined") {
                        infoBox.style.display = "none";
                    }
                    toggleSolidsBtn.setAttribute("aria-pressed", String(isVisible));
                    toggleSolidsBtn.innerHTML = isVisible
                        ? '<i class="bi bi-box"></i> 3D Culvert: On'
                        : '<i class="bi bi-box"></i> 3D Culvert: Off';
                });
            }

            // Section 17.19: Import a culvert HTML model.
            // Parse the selected file through CulvertHtmlReader,
            // update the active model, save it in sessionStorage
            // and persist it to MongoDB when a valid project ID exists.
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
                    } catch (e) { }
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

            // Section 17.20: Support drag-and-drop import of culvert HTML files.
            // Accept HTML files dropped onto the map container
            // and process them through the same import handler.
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

            // Section 17.21: Prepare temporary culvert identification labels
            // and the specification information panel used by the map interface.
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
                width: 320px;
                max-width: calc(100% - 24px);
                max-height: 80%;
                overflow-y: auto;
                box-sizing: border-box;
                padding: 16px 18px;
                background: rgba(22, 27, 34, 0.95);
                color: #e6edf3;
                border: 1px solid #30363d;
                border-radius: 12px;
                box-shadow: 0 16px 36px rgba(0, 0, 0, 0.65);
                font-family: inherit;
                font-size: 13px;
                line-height: 1.6;
                pointer-events: auto;
                backdrop-filter: blur(8px);
            `;

            const mapWorkspace = document.getElementById("survey-map-container");
            mapWorkspace.style.position = "relative";
            mapWorkspace.appendChild(infoBox);

            const culvertRaycaster = new THREE.Raycaster();
            culvertRaycaster.params.Points.threshold = 3;

            let selectedCulvertIndex = -1;

            // Section 17.22: Display the selected culvert's information.
            // Build specification rows covering identification, review status,
            // survey location, chainage, ground level and associated elevations.
            // Generate the information panel dynamically and provide a close control.
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

                // 1. Header with Close Button
                const header = document.createElement("div");
                header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 10px;
        margin-bottom: 10px;
        border-bottom: 1px solid #30363d;
    `;
                header.innerHTML = `
        <span style="font-weight: 600; color: #f0883e; font-size: 14px;">
            Culvert Location #${data.LocationIndex} (Ch. ${(Number(data.Chainage) / 1000).toFixed(3)})
        </span>
        <button type="button" id="btnCloseCulvertInfo" style="
            background: transparent;
            border: none;
            color: #8b949e;
            font-size: 18px;
            cursor: pointer;
            padding: 2px 6px;
            line-height: 1;
        ">&times;</button>
    `;
                infoBox.appendChild(header);
                // Wire up close button
                header.querySelector("#btnCloseCulvertInfo").addEventListener("click", () => {
                    infoBox.style.display = "none";
                });

                // Specification rows

                // Specification rows and section headings.
                rows.forEach((item, index) => {
                    if (item.section) {
                        const section = document.createElement("div");
                        section.textContent = item.section;
                        section.style.cssText = `
                            font-size: 13px;
                            font-weight: 600;
                            color: #f0883e;
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
                        border-bottom: 1px solid #21262d;
                    `;

                    const labelElement = document.createElement("span");
                    labelElement.textContent = label;
                    labelElement.style.cssText = `
                        color: #8b949e;
                        flex: 1;
                        min-width: 0;
                        overflow-wrap: anywhere;
                    `;

                    const valueElement = document.createElement("span");
                    valueElement.textContent = String(value);
                    valueElement.style.cssText = `
                        color: #f0883e;
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

                // Dock card neatly to the top-left corner of the map so it NEVER covers the culvert or right layers panel
                infoBox.style.position = "absolute";
                infoBox.style.left = "16px";
                infoBox.style.top = "70px";
                infoBox.style.right = "auto";
                infoBox.style.display = "block";
            };

            // Section 17.23: Detect which culvert the user points to.
            // Convert pointer coordinates into normalized device coordinates.
            // Use Three.js raycasting to test the 3D pins first,
            // then check the culvert point markers.
            // Return the corresponding culvert index or -1 when none is hit.
            const findCulvertAtPointer = (event) => {
                if (typeof culvertSolidsGroup !== "undefined" && !culvertSolidsGroup.visible) {
                    return -1;
                }
                const rect = renderer.domElement.getBoundingClientRect();

                const pointer = new THREE.Vector2(
                    ((event.clientX - rect.left) / rect.width) * 2 - 1,
                    -((event.clientY - rect.top) / rect.height) * 2 + 1
                );

                culvertRaycaster.setFromCamera(pointer, camera);

                // Check 3D diamond pins & poles
                if (typeof culvertPinGroup !== "undefined" && culvertPinGroup.children.length > 0) {
                    const pinHits = culvertRaycaster.intersectObjects(culvertPinGroup.children, false);
                    if (pinHits.length > 0 && typeof pinHits[0].object.userData.culvertIndex === "number") {
                        return pinHits[0].object.userData.culvertIndex;
                    }
                }

                const hits = culvertRaycaster.intersectObject(markers);

                return hits.length ? hits[0].index : -1;
            };

            // Section 17.24: Handle pointer interaction with culvert markers.
            // Change the cursor on hover and distinguish a deliberate click
            // from camera movement using the pointer-down and click positions.
            // Select the culvert only when the pointer movement stays within
            // the existing 5-pixel threshold.
            renderer.domElement.addEventListener("pointermove", (event) => {
                const index = findCulvertAtPointer(event);
                renderer.domElement.style.cursor = (index !== -1) ? "pointer" : "default";
            });

            let pointerDownPos = { x: 0, y: 0 };
            renderer.domElement.addEventListener("pointerdown", (e) => {
                pointerDownPos = { x: e.clientX, y: e.clientY };
            });

            renderer.domElement.addEventListener("click", (event) => {
                // If mouse moved more than 5px between down and up, it was a camera rotate/pan, NOT a click!
                const dist = Math.hypot(event.clientX - pointerDownPos.x, event.clientY - pointerDownPos.y);
                if (dist > 5) return;
                const index = findCulvertAtPointer(event);
                if (index !== -1) {
                    selectCulvertByIndex(index);
                }
            });

            // Section 17.25: Animate the camera towards a selected culvert.
            // Interpolate both the camera position and OrbitControls target
            // using a cubic ease-in-out transition.
            // Cancel any previous glide before starting another.
            let cameraGlideAnimation = null;
            function glideCameraTo(targetPos, viewDistance = 20) {
                if (!controls) return;

                const startTarget = controls.target.clone();
                const endTarget = targetPos.clone();

                const startCameraPos = camera.position.clone();
                // Position camera offset at a natural 3D view angle
                const endCameraPos = new THREE.Vector3(
                    endTarget.x + viewDistance * 0.7,
                    endTarget.y + viewDistance * 0.65,
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

            // Section 17.26: Provide sequential and direct culvert navigation.
            // Populate the dropdown with culvert numbers and chainages.
            // Allow previous, next and direct selection, update the information
            // panel, and optionally move the camera to the selected location.

            // =========================================================
            // Sequential Culvert Stepper & Direct Jump Dropdown
            // =========================================================
            const culvertStepperEl = document.getElementById("survey-culvert-stepper");
            const culvertSelectEl = document.getElementById("stepper-culvert-select");
            const btnPrevCulvert = document.getElementById("btn-prev-culvert");
            const btnNextCulvert = document.getElementById("btn-next-culvert");

            function populateCulvertDropdown() {
                if (!culvertSelectEl || !culvertMarkerData.length) return;
                culvertSelectEl.innerHTML = "";
                culvertMarkerData.forEach((marker, idx) => {
                    const opt = document.createElement("option");
                    opt.value = idx;
                    const ch = marker.data && marker.data.Chainage ? Number(marker.data.Chainage) : 0;
                    const chKm = Math.floor(ch / 1000);
                    const chM = Math.floor(ch % 1000).toString().padStart(3, '0');
                    opt.textContent = `Culvert No.${marker.data.LocationIndex} (Ch. ${chKm}+${chM})`;
                    culvertSelectEl.appendChild(opt);
                });
            }

            function selectCulvertByIndex(index, glideCamera = true) {
                if (!culvertMarkerData.length) return;
                if (index < 0) index = culvertMarkerData.length - 1;
                if (index >= culvertMarkerData.length) index = 0;

                selectedCulvertIndex = index;
                showCulvertInfo(index);

                if (culvertSelectEl) {
                    culvertSelectEl.value = String(index);
                }

                const marker = culvertMarkerData[index];
                if (marker && glideCamera) {
                    const roadProj = getRoadCenterlineProjection(marker.easting, marker.northing);
                    const targetPos = toWorld(roadProj.e, roadProj.n, roadProj.rl);
                    const roadLift = (typeof visualLift !== 'undefined') ? visualLift : 0.15;
                    targetPos.y += roadLift;
                    glideCameraTo(targetPos, 18);
                }
            }

            if (culvertMarkerData.length > 0) {
                if (culvertStepperEl) culvertStepperEl.style.display = "inline-flex";
                populateCulvertDropdown();

                culvertSelectEl?.addEventListener("change", (e) => {
                    const idx = parseInt(e.target.value, 10);
                    if (!isNaN(idx)) {
                        selectCulvertByIndex(idx, true);
                    }
                });

                btnPrevCulvert?.addEventListener("click", () => {
                    const nextIdx = (selectedCulvertIndex <= 0) ? culvertMarkerData.length - 1 : selectedCulvertIndex - 1;
                    selectCulvertByIndex(nextIdx, true);
                });

                btnNextCulvert?.addEventListener("click", () => {
                    const nextIdx = (selectedCulvertIndex >= culvertMarkerData.length - 1) ? 0 : selectedCulvertIndex + 1;
                    selectCulvertByIndex(nextIdx, true);
                });
            }
        }

        // Section 17.27: Calculate the initial camera target and viewing distance.
        // Use the survey coordinate and elevation ranges to establish
        // a suitable centre point and initial viewing scale.

        const span = Math.max(maxE - minE, maxN - minN, 10);
        const target = new THREE.Vector3(
            0,
            ((maxRL - minRL) * verticalExaggeration) / 2,
            0
        );

        const initialDistance = span * 0.50;


        // Section 17.28: Configure predefined camera views.
        // Calculate viewing distance from the survey's horizontal and vertical
        // extents and camera field of view.
        // Support top, north-oriented and 3D perspective views.

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
            ) * 0.70;

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
                    target.x + distance * 0.45,
                    target.y + distance * 0.35,
                    target.z + distance * 0.45
                );
            }

            camera.lookAt(target);

            if (controls) {
                controls.target.copy(target);
                controls.update();
            }
        };

        camera.position.set(
            target.x + initialDistance * 0.45,
            target.y + initialDistance * 0.35,
            target.z + initialDistance * 0.45
        );
        camera.lookAt(target);

        // Section 17.29: Initialize interactive map camera controls.
        // Configure damping, zoom, panning and rotation.
        // Set mouse-button assignments and camera distance limits.

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
            controls.minDistance = 0.0005;

            // Prevent zooming so far out that the model becomes difficult to find.
            controls.maxDistance = Math.max(500, span * 10);

            // Prevent camera from orbiting below ground level (clamp to ~84°, just above horizon)
            controls.maxPolarAngle = Math.PI;

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

        // Section 17.30: Keep the renderer and camera projection synchronized
        // with the available canvas dimensions.
        // Ignore resize operations when the canvas has no usable dimensions.

        const resize = () => {
            const width = canvas.clientWidth;
            const height = canvas.clientHeight;

            if (!width || !height) return;

            renderer.setSize(width, height, false);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        };

        // Section 17.31: Handle full-screen map operation.
        // Enter or exit browser full-screen mode and update the button label.
        // Recalculate the Three.js renderer dimensions and refresh the
        // Leaflet map when the full-screen state changes.

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

        // Section 17.32: Connect map navigation and layer-panel controls.
        // Provide recenter, top, 3D and north-up views.
        // Maintain active-button states and support opening, closing
        // and collapsing the CAD layers drawer and its individual groups.
        const topViewBtn = document.getElementById("survey-map-top-view");
        const threeDViewBtn = document.getElementById("survey-map-3d-view");
        const northUpBtn = document.getElementById("survey-map-north-up");
        const layersToggleBtn = document.getElementById("survey-cad-layers-toggle");

        function setActiveViewButton(activeBtn) {
            [topViewBtn, threeDViewBtn, northUpBtn].forEach(btn => {
                if (!btn) return;
                const isActive = (btn === activeBtn);
                btn.classList.toggle("active", isActive);
                btn.setAttribute("aria-pressed", String(isActive));
            });
        }

        document.getElementById("survey-map-recenter")?.addEventListener("click", () => {
            window.setSurveyMapMode?.("3d");
            setCameraView("3d");
            setActiveViewButton(threeDViewBtn);
        });

        topViewBtn?.addEventListener("click", () => {
            window.setSurveyMapMode?.("top");
            setCameraView("top");
            setActiveViewButton(topViewBtn);
        });

        threeDViewBtn?.addEventListener("click", () => {
            window.setSurveyMapMode?.("3d");
            setCameraView("3d");
            setActiveViewButton(threeDViewBtn);
        });

        northUpBtn?.addEventListener("click", () => {
            setCameraView("north");
            setActiveViewButton(northUpBtn);
        });

        // Toggle & Close Floating CAD Layers Drawer
        const cadLayersDrawer = document.getElementById("survey-cad-layers-drawer");
        layersToggleBtn?.addEventListener("click", () => {
            if (cadLayersDrawer) {
                const isCollapsed = cadLayersDrawer.classList.toggle("collapsed");
                layersToggleBtn.classList.toggle("active", !isCollapsed);
                layersToggleBtn.setAttribute("aria-pressed", String(!isCollapsed));
            }
        });
        document.getElementById("survey-cad-layers-close")?.addEventListener("click", () => {
            if (cadLayersDrawer) {
                cadLayersDrawer.classList.add("collapsed");
                layersToggleBtn?.classList.remove("active");
                layersToggleBtn?.setAttribute("aria-pressed", "false");
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

        // Section 17.33: Start the rendering lifecycle.
        // Register window resizing, perform the initial resize,
        // continuously update camera controls and render the scene.
        // Update the displayed survey, alignment and culvert counts
        // after initialization.

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