// wwwroot/js/drawing/culvert-3d-viewer.js

// ============================================================
// CulvertCAD — Three.js 3D Drawing Viewer
// Renders: Cross-Section, Longitudinal Section, Full 3D Model,
//          Alignment Map
// ============================================================

(function () {
    'use strict';

    const D = window.CULVERT_DATA;
    const canvas = document.getElementById('threejs-canvas');

    let scene;
    let camera;
    let renderer;
    let controls;
    let currentGroup;

    let wireframeMode = false;
    let currentView = 'cross-section';


    // ============================================================
    // COLOUR PALETTE
    // Engineering drawing colours
    // ============================================================

    const COLORS = {
        pipe: 0x6b7280,          // Grey concrete pipe
        pipeBore: 0x1c2128,      // Dark bore (hollow)
        bedding: 0xd4a574,       // Sandy bedding material
        backfill: 0x8b6f47,      // Earth backfill
        roadSurface: 0x4a4a4a,   // Asphalt
        wingwall: 0xc8c8c8,      // RCC wingwall
        ground: 0x6b8e4e,        // Grass / ground
        water: 0x3b82f6,         // Water flow indicator
        grid: 0x30363d,
        accent: 0xf0883e
    };


    // ============================================================
    // INITIALISE THREE.JS SCENE
    // ============================================================

    function init() {
        const wrap = document.getElementById('threejs-canvas-wrap');

        const width = wrap.clientWidth;
        const height = wrap.clientHeight || 600;

        scene = new THREE.Scene();

        scene.background = new THREE.Color(0x0d1117);

        scene.fog = new THREE.Fog(
            0x0d1117,
            8000,
            25000
        );


        // --------------------------------------------------------
        // Camera
        // --------------------------------------------------------

        camera = new THREE.PerspectiveCamera(
            45,
            width / height,
            1,
            50000
        );

        camera.position.set(
            3000,
            2000,
            3000
        );


        // --------------------------------------------------------
        // Renderer
        // --------------------------------------------------------

        renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true
        });

        renderer.setSize(width, height);
        renderer.shadowMap.enabled = true;


        // --------------------------------------------------------
        // Orbit Controls
        // --------------------------------------------------------

        controls = new THREE.OrbitControls(
            camera,
            renderer.domElement
        );

        controls.enableDamping = true;
        controls.dampingFactor = 0.08;


        // --------------------------------------------------------
        // Lighting
        // --------------------------------------------------------

        const ambient = new THREE.AmbientLight(
            0xffffff,
            0.55
        );

        scene.add(ambient);


        const dirLight = new THREE.DirectionalLight(
            0xffffff,
            0.85
        );

        dirLight.position.set(
            2000,
            3000,
            1500
        );

        dirLight.castShadow = true;

        scene.add(dirLight);


        const fillLight = new THREE.DirectionalLight(
            0x88aaff,
            0.25
        );

        fillLight.position.set(
            -2000,
            1000,
            -1500
        );

        scene.add(fillLight);


        // --------------------------------------------------------
        // Grid Helper
        // --------------------------------------------------------

        const grid = new THREE.GridHelper(
            10000,
            20,
            COLORS.grid,
            COLORS.grid
        );

        grid.position.y = -2000;

        scene.add(grid);


        // --------------------------------------------------------
        // Events / Animation
        // --------------------------------------------------------

        window.addEventListener(
            'resize',
            onResize
        );

        animate();
    }


    // ============================================================
    // RESIZE
    // ============================================================

    function onResize() {
        const wrap = document.getElementById(
            'threejs-canvas-wrap'
        );

        const width = wrap.clientWidth;
        const height = wrap.clientHeight || 600;

        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        renderer.setSize(
            width,
            height
        );
    }


    // ============================================================
    // ANIMATION LOOP
    // ============================================================

    function animate() {
        requestAnimationFrame(animate);

        controls.update();

        renderer.render(
            scene,
            camera
        );
    }


    // ============================================================
    // CLEAR CURRENT VIEW
    // ============================================================

    function clearScene() {
        if (currentGroup) {
            scene.remove(currentGroup);
        }

        currentGroup = new THREE.Group();

        scene.add(currentGroup);
    }


    // ============================================================
    // VIEW 1 — CROSS SECTION
    // Pipe in trench with bedding
    // ============================================================

    function buildCrossSection() {
        clearScene();

        const c = D.crossSection;

        const Dr = c.diameterMm / 2;
        const wallT = c.wallThicknessMm;
        const Bd = c.trenchWidthMm;
        const td = c.trenchDepthMm;
        const bd = c.beddingDepthMm;
        const fillH = c.fillHeightMm;

        const pipeLen = 2500;

        const nPipes = c.numberOfPipes;
        const spacing = c.pipeSpacingMm;

        const totalWidth =
            nPipes * (Dr * 2) +
            (nPipes - 1) * spacing;

        const startX = -totalWidth / 2;


        // --------------------------------------------------------
        // Trench
        // --------------------------------------------------------

        const trenchGeo = new THREE.BoxGeometry(
            Bd,
            td,
            pipeLen
        );

        const trenchMat =
            new THREE.MeshStandardMaterial({
                color: COLORS.backfill,
                transparent: true,
                opacity: 0.35
            });

        const trenchMesh =
            new THREE.Mesh(
                trenchGeo,
                trenchMat
            );

        trenchMesh.position.set(
            0,
            -td / 2 + bd,
            0
        );

        currentGroup.add(trenchMesh);


        // --------------------------------------------------------
        // Bedding Layer
        // --------------------------------------------------------

        const beddingGeo = new THREE.BoxGeometry(
            Bd,
            bd,
            pipeLen
        );

        const beddingMat =
            new THREE.MeshStandardMaterial({
                color: COLORS.bedding
            });

        const beddingMesh =
            new THREE.Mesh(
                beddingGeo,
                beddingMat
            );

        beddingMesh.position.set(
            0,
            -bd / 2,
            0
        );

        currentGroup.add(beddingMesh);


        // --------------------------------------------------------
        // Road Fill
        // --------------------------------------------------------

        const roadFillGeo = new THREE.BoxGeometry(
            Bd + 1000,
            fillH,
            pipeLen
        );

        const roadFillMat =
            new THREE.MeshStandardMaterial({
                color: COLORS.backfill,
                transparent: true,
                opacity: 0.5
            });

        const roadFillMesh =
            new THREE.Mesh(
                roadFillGeo,
                roadFillMat
            );

        roadFillMesh.position.set(
            0,
            td - bd + fillH / 2,
            0
        );

        currentGroup.add(roadFillMesh);


        // --------------------------------------------------------
        // Road Surface
        // --------------------------------------------------------

        const roadGeo = new THREE.BoxGeometry(
            Bd + 1500,
            50,
            pipeLen
        );

        const roadMat =
            new THREE.MeshStandardMaterial({
                color: COLORS.roadSurface
            });

        const roadMesh =
            new THREE.Mesh(
                roadGeo,
                roadMat
            );

        roadMesh.position.set(
            0,
            td - bd + fillH + 25,
            0
        );

        currentGroup.add(roadMesh);


        // --------------------------------------------------------
        // Pipes
        // --------------------------------------------------------

        for (let i = 0; i < nPipes; i++) {
            const cx =
                startX +
                i * (Dr * 2 + spacing) +
                Dr;


            // Outer pipe
            const outerGeo =
                new THREE.CylinderGeometry(
                    Dr + wallT,
                    Dr + wallT,
                    pipeLen,
                    48
                );

            const outerMat =
                new THREE.MeshStandardMaterial({
                    color: COLORS.pipe
                });

            const outerMesh =
                new THREE.Mesh(
                    outerGeo,
                    outerMat
                );

            outerMesh.rotation.x =
                Math.PI / 2;

            outerMesh.position.set(
                cx,
                0,
                0
            );

            currentGroup.add(outerMesh);


            // Inner bore
            const innerGeo =
                new THREE.CylinderGeometry(
                    Dr,
                    Dr,
                    pipeLen + 10,
                    48
                );

            const innerMat =
                new THREE.MeshStandardMaterial({
                    color: COLORS.pipeBore
                });

            const innerMesh =
                new THREE.Mesh(
                    innerGeo,
                    innerMat
                );

            innerMesh.rotation.x =
                Math.PI / 2;

            innerMesh.position.set(
                cx,
                0,
                0
            );

            currentGroup.add(innerMesh);
        }


        // --------------------------------------------------------
        // Dimension Labels
        // --------------------------------------------------------

        addLabel(
            `Ø${c.diameterMm}mm`,
            0,
            Dr + wallT + 200,
            pipeLen / 2 + 100
        );

        addLabel(
            `Bd=${Bd}mm`,
            0,
            -td + bd - 200,
            pipeLen / 2 + 100
        );

        addLabel(
            `H=${(fillH / 1000).toFixed(2)}m`,
            Bd / 2 + 700,
            td - bd + fillH / 2,
            pipeLen / 2 + 100
        );

        addLabel(
            `IS 783 ${c.beddingClass} Bedding`,
            0,
            -td / 2,
            pipeLen / 2 + 300
        );


        // --------------------------------------------------------
        // Camera
        // --------------------------------------------------------

        camera.position.set(
            0,
            800,
            3500
        );

        controls.target.set(
            0,
            0,
            0
        );
    }


    // ============================================================
    // VIEW 2 — LONGITUDINAL SECTION
    // ============================================================

    function buildLongitudinal() {
        clearScene();

        const l = D.longitudinal;

        const lenMm =
            l.totalLengthM * 1000;

        const Dr =
            l.pipeDiameterMm / 2;

        const invStart =
            l.invertRLStart * 1000;

        const invEnd =
            l.invertRLEnd * 1000;

        const roadStart =
            l.roadRLStart * 1000;

        const roadEnd =
            l.roadRLEnd * 1000;


        // Use invert start as datum.
        const datum = invStart;


        // --------------------------------------------------------
        // Pipe Barrel
        // --------------------------------------------------------

        const pipeGeo =
            new THREE.CylinderGeometry(
                Dr,
                Dr,
                lenMm,
                32,
                1,
                true
            );

        const pipeMat =
            new THREE.MeshStandardMaterial({
                color: COLORS.pipe,
                side: THREE.DoubleSide
            });

        const pipeMesh =
            new THREE.Mesh(
                pipeGeo,
                pipeMat
            );

        pipeMesh.rotation.z =
            Math.PI / 2;

        pipeMesh.position.set(
            0,
            (invStart - datum) +
            (invEnd - invStart) / 2 +
            Dr,
            0
        );


        // Tilt pipe to follow slope.
        const slopeAngle =
            Math.atan2(
                invEnd - invStart,
                lenMm
            );

        pipeMesh.rotation.x =
            slopeAngle;

        currentGroup.add(pipeMesh);


        // --------------------------------------------------------
        // Road Formation
        // --------------------------------------------------------

        const roadShape =
            new THREE.Shape();

        roadShape.moveTo(
            0,
            roadStart - datum
        );

        roadShape.lineTo(
            lenMm,
            roadEnd - datum
        );

        roadShape.lineTo(
            lenMm,
            roadEnd - datum + 300
        );

        roadShape.lineTo(
            0,
            roadStart - datum + 300
        );

        roadShape.closePath();


        const roadGeo =
            new THREE.ShapeGeometry(
                roadShape
            );

        const roadMat =
            new THREE.MeshStandardMaterial({
                color: COLORS.roadSurface,
                side: THREE.DoubleSide
            });

        const roadMesh =
            new THREE.Mesh(
                roadGeo,
                roadMat
            );

        currentGroup.add(roadMesh);


        // --------------------------------------------------------
        // End Walls
        // --------------------------------------------------------

        addBox(
            0,
            (invStart - datum) + Dr,
            0,
            200,
            Dr * 2 + 400,
            l.roadwayWidthM * 1000,
            COLORS.wingwall
        );

        addBox(
            lenMm,
            (invEnd - datum) + Dr,
            0,
            200,
            Dr * 2 + 400,
            l.roadwayWidthM * 1000,
            COLORS.wingwall
        );


        // --------------------------------------------------------
        // Labels
        // --------------------------------------------------------

        addLabel(
            `L = ${l.totalLengthM.toFixed(1)}m`,
            lenMm / 2,
            roadStart - datum + 600,
            0
        );

        addLabel(
            `Inv. RL = ${l.invertRLStart.toFixed(3)}m`,
            -800,
            invStart - datum,
            0
        );

        addLabel(
            `Inv. RL = ${l.invertRLEnd.toFixed(3)}m`,
            lenMm + 800,
            invEnd - datum,
            0
        );

        const slopePct =
            Math.abs(invEnd - invStart) /
            lenMm *
            100;

        addLabel(
            `S = ${slopePct.toFixed(3)}%`,
            lenMm / 2,
            (
                (invStart - datum) +
                (invEnd - datum)
            ) / 2 +
            Dr +
            300,
            0
        );


        // --------------------------------------------------------
        // Camera
        // --------------------------------------------------------

        camera.position.set(
            lenMm / 2,
            1500,
            4000
        );

        controls.target.set(
            lenMm / 2,
            0,
            0
        );
    }


    // ============================================================
    // VIEW 3 — FULL 3D MODEL
    // Pipe + wingwalls + embankment
    // ============================================================

    function buildFull3D() {
        clearScene();

        const c = D.crossSection;
        const l = D.longitudinal;

        const Dr =
            c.diameterMm / 2;

        const wallT =
            c.wallThicknessMm;

        const pipeLen =
            l.roadwayWidthM * 1000 + 1000;

        const fillH =
            c.fillHeightMm;

        const Bd =
            c.trenchWidthMm;


        // --------------------------------------------------------
        // Embankment
        // --------------------------------------------------------

        const embankShape =
            new THREE.Shape();

        const halfRoadW =
            l.roadwayWidthM * 1000 / 2 +
            500;

        const slopeRun =
            fillH * 1.5;


        embankShape.moveTo(
            -halfRoadW - slopeRun,
            0
        );

        embankShape.lineTo(
            -halfRoadW,
            fillH
        );

        embankShape.lineTo(
            halfRoadW,
            fillH
        );

        embankShape.lineTo(
            halfRoadW + slopeRun,
            0
        );

        embankShape.closePath();


        const extrudeSettings = {
            depth: pipeLen,
            bevelEnabled: false
        };

        const embankGeo =
            new THREE.ExtrudeGeometry(
                embankShape,
                extrudeSettings
            );

        const embankMat =
            new THREE.MeshStandardMaterial({
                color: COLORS.ground,
                transparent: true,
                opacity: 0.55
            });

        const embankMesh =
            new THREE.Mesh(
                embankGeo,
                embankMat
            );

        embankMesh.rotation.x =
            -Math.PI / 2;

        embankMesh.position.set(
            0,
            0,
            pipeLen / 2
        );

        currentGroup.add(embankMesh);


        // --------------------------------------------------------
        // Road Surface
        // --------------------------------------------------------

        const roadGeo =
            new THREE.BoxGeometry(
                l.roadwayWidthM * 1000,
                60,
                pipeLen + 1000
            );

        const roadMat =
            new THREE.MeshStandardMaterial({
                color: COLORS.roadSurface
            });

        const roadMesh =
            new THREE.Mesh(
                roadGeo,
                roadMat
            );

        roadMesh.position.set(
            0,
            fillH + 30,
            0
        );

        currentGroup.add(roadMesh);


        // --------------------------------------------------------
        // Pipe Configuration
        // --------------------------------------------------------

        const nPipes =
            c.numberOfPipes;

        const spacing =
            c.pipeSpacingMm;

        const totalWidth =
            nPipes * (Dr * 2) +
            (nPipes - 1) * spacing;

        const startX =
            -totalWidth / 2;


        // --------------------------------------------------------
        // Pipes
        // --------------------------------------------------------

        for (let i = 0; i < nPipes; i++) {

            const cx =
                startX +
                i * (Dr * 2 + spacing) +
                Dr;


            // Outer pipe
            const pipeGeo =
                new THREE.CylinderGeometry(
                    Dr + wallT,
                    Dr + wallT,
                    pipeLen,
                    40
                );

            const pipeMat =
                new THREE.MeshStandardMaterial({
                    color: COLORS.pipe
                });

            const pipeMesh =
                new THREE.Mesh(
                    pipeGeo,
                    pipeMat
                );

            pipeMesh.rotation.x =
                Math.PI / 2;

            pipeMesh.position.set(
                cx,
                0,
                0
            );

            currentGroup.add(pipeMesh);


            // Bore
            const boreGeo =
                new THREE.CylinderGeometry(
                    Dr,
                    Dr,
                    pipeLen + 20,
                    40
                );

            const boreMat =
                new THREE.MeshStandardMaterial({
                    color: COLORS.pipeBore
                });

            const boreMesh =
                new THREE.Mesh(
                    boreGeo,
                    boreMat
                );

            boreMesh.rotation.x =
                Math.PI / 2;

            boreMesh.position.set(
                cx,
                0,
                0
            );

            currentGroup.add(boreMesh);
        }


        // --------------------------------------------------------
        // Wingwalls
        // --------------------------------------------------------

        const wwAngleRad =
            (l.wingwallAngle || 30) *
            Math.PI /
            180;

        addWingwall(
            -pipeLen / 2,
            totalWidth / 2,
            wwAngleRad,
            true
        );

        addWingwall(
            -pipeLen / 2,
            -totalWidth / 2,
            wwAngleRad,
            false
        );

        addWingwall(
            pipeLen / 2,
            totalWidth / 2,
            wwAngleRad,
            true,
            true
        );

        addWingwall(
            pipeLen / 2,
            -totalWidth / 2,
            wwAngleRad,
            false,
            true
        );


        // --------------------------------------------------------
        // Labels
        // --------------------------------------------------------

        addLabel(
            `${nPipes} × Ø${c.diameterMm}mm IS 458 ${c.beddingClass === 'ClassB' ? 'NP2' : 'NP3'}`,
            0,
            fillH + 400,
            0
        );

        addLabel(
            `Fill Height: ${(fillH / 1000).toFixed(2)}m`,
            0,
            fillH / 2,
            totalWidth / 2 + 600
        );


        // --------------------------------------------------------
        // Camera
        // --------------------------------------------------------

        camera.position.set(
            4000,
            2500,
            5000
        );

        controls.target.set(
            0,
            fillH / 2,
            0
        );
    }


    // ============================================================
    // WINGWALL
    // ============================================================

    function addWingwall(
        zPos,
        xPos,
        angleRad,
        isPositive,
        isOutlet
    ) {
        const wwLen = 1500;
        const wwHeight = 1200;
        const wwThick = 250;

        const geo =
            new THREE.BoxGeometry(
                wwThick,
                wwHeight,
                wwLen
            );

        const mat =
            new THREE.MeshStandardMaterial({
                color: COLORS.wingwall
            });

        const mesh =
            new THREE.Mesh(
                geo,
                mat
            );

        mesh.position.set(
            xPos + (isPositive ? 300 : -300),
            wwHeight / 2 - 200,
            zPos + (isOutlet ? wwLen / 2 : -wwLen / 2)
        );

        mesh.rotation.y =
            isPositive
                ? angleRad
                : -angleRad;

        currentGroup.add(mesh);
    }


    // ============================================================
    // ADD BOX
    // ============================================================

    function addBox(
        x,
        y,
        z,
        width,
        height,
        depth,
        color
    ) {
        const geo =
            new THREE.BoxGeometry(
                width,
                height,
                depth
            );

        const mat =
            new THREE.MeshStandardMaterial({
                color
            });

        const mesh =
            new THREE.Mesh(
                geo,
                mat
            );

        mesh.position.set(
            x,
            y,
            z
        );

        currentGroup.add(mesh);
    }


    // ============================================================
    // VIEW 4 — ALIGNMENT MAP
    // Road + culvert pins on terrain
    // ============================================================

    function buildAlignmentMap() {
        clearScene();

        // Demo alignment data.
        // Would come from server in production.
        const points =
            window.ALIGNMENT_MAP_DATA?.centrelinePoints ||
            generateDemoAlignment();

        const culverts =
            window.ALIGNMENT_MAP_DATA?.culvertPins ||
            generateDemoCulverts();


        // --------------------------------------------------------
        // Terrain
        // --------------------------------------------------------

        const terrainGeo =
            new THREE.PlaneGeometry(
                12000,
                4000,
                50,
                20
            );

        const terrainMat =
            new THREE.MeshStandardMaterial({
                color: COLORS.ground,
                wireframe: false,
                flatShading: true
            });

        const terrainMesh =
            new THREE.Mesh(
                terrainGeo,
                terrainMat
            );

        terrainMesh.rotation.x =
            -Math.PI / 2;

        terrainMesh.position.y = -50;

        currentGroup.add(terrainMesh);


        // --------------------------------------------------------
        // Alignment Polyline
        // --------------------------------------------------------

        const alignPoints =
            points.map(
                p => new THREE.Vector3(
                    p.x,
                    10,
                    p.z
                )
            );

        const alignGeo =
            new THREE.BufferGeometry()
                .setFromPoints(alignPoints);

        const alignMat =
            new THREE.LineBasicMaterial({
                color: COLORS.roadSurface,
                linewidth: 3
            });

        const alignLine =
            new THREE.Line(
                alignGeo,
                alignMat
            );

        currentGroup.add(alignLine);


        // --------------------------------------------------------
        // Culvert Pins
        // --------------------------------------------------------

        culverts.forEach(c => {

            const pinColor =
                c.isOK
                    ? 0x3fb950
                    : 0xf85149;

            const pinGeo =
                new THREE.ConeGeometry(
                    60,
                    200,
                    8
                );

            const pinMat =
                new THREE.MeshStandardMaterial({
                    color: pinColor
                });

            const pinMesh =
                new THREE.Mesh(
                    pinGeo,
                    pinMat
                );

            pinMesh.position.set(
                c.x,
                150,
                c.z
            );

            pinMesh.rotation.x =
                Math.PI;

            currentGroup.add(pinMesh);

            addLabel(
                `Ch.${c.chainage} Ø${c.diameterMm}mm`,
                c.x,
                350,
                c.z
            );
        });


        // --------------------------------------------------------
        // Camera
        // --------------------------------------------------------

        camera.position.set(
            0,
            3000,
            5000
        );

        controls.target.set(
            0,
            0,
            0
        );
    }


    // ============================================================
    // DEMO ALIGNMENT DATA
    // ============================================================

    function generateDemoAlignment() {
        const points = [];

        for (let i = 0; i <= 50; i++) {
            points.push({
                x: (i - 25) * 200,
                z: Math.sin(i / 8) * 400
            });
        }

        return points;
    }


    // ============================================================
    // DEMO CULVERT DATA
    // ============================================================

    function generateDemoCulverts() {
        return [
            {
                x: -3000,
                z: 100,
                chainage: '0+263',
                diameterMm: 500,
                isOK: true
            },
            {
                x: -1500,
                z: -200,
                chainage: '2+154',
                diameterMm: 300,
                isOK: false
            },
            {
                x: 500,
                z: 300,
                chainage: '6+030',
                diameterMm: 300,
                isOK: false
            },
            {
                x: 2500,
                z: -100,
                chainage: '7+253',
                diameterMm: 800,
                isOK: true
            }
        ];
    }


    // ============================================================
    // TEXT LABEL SPRITES
    // ============================================================

    function addLabel(
        text,
        x,
        y,
        z
    ) {
        const canvas2d =
            document.createElement('canvas');

        canvas2d.width = 512;
        canvas2d.height = 96;

        const ctx =
            canvas2d.getContext('2d');


        // Background
        ctx.fillStyle =
            'rgba(13,17,23,0.85)';

        ctx.fillRect(
            0,
            0,
            512,
            96
        );


        // Border
        ctx.strokeStyle =
            '#f0883e';

        ctx.lineWidth = 3;

        ctx.strokeRect(
            2,
            2,
            508,
            92
        );


        // Text
        ctx.fillStyle =
            '#e6edf3';

        ctx.font =
            'bold 38px Calibri, sans-serif';

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillText(
            text,
            256,
            48
        );


        // Three.js texture
        const texture =
            new THREE.CanvasTexture(
                canvas2d
            );

        const spriteMat =
            new THREE.SpriteMaterial({
                map: texture,
                depthTest: false
            });

        const sprite =
            new THREE.Sprite(
                spriteMat
            );

        sprite.position.set(
            x,
            y,
            z
        );

        sprite.scale.set(
            800,
            150,
            1
        );

        currentGroup.add(sprite);
    }


    // ============================================================
    // VIEW SWITCHING
    // ============================================================

    function switchView(view) {
        currentView = view;

        document
            .querySelectorAll('.viewer-tab')
            .forEach(tab =>
                tab.classList.remove('active')
            );

        document
            .querySelector(
                `[data-view="${view}"]`
            )
            .classList.add('active');


        switch (view) {

            case 'cross-section':
                buildCrossSection();
                break;

            case 'longitudinal':
                buildLongitudinal();
                break;

            case 'full-3d':
                buildFull3D();
                break;

            case 'alignment-map':
                buildAlignmentMap();
                break;
        }
    }


    // ============================================================
    // VIEWER CONTROLS
    // ============================================================

    function setupControls() {

        // View tabs
        document
            .querySelectorAll('.viewer-tab')
            .forEach(button => {

                button.addEventListener(
                    'click',
                    () => switchView(button.dataset.view)
                );

            });


        // Reset view
        document
            .getElementById('btn-reset-view')
            .addEventListener(
                'click',
                () => switchView(currentView)
            );


        // Wireframe
        document
            .getElementById('btn-wireframe')
            .addEventListener(
                'click',
                () => {

                    wireframeMode =
                        !wireframeMode;

                    currentGroup.traverse(
                        object => {

                            if (object.material) {
                                object.material.wireframe =
                                    wireframeMode;
                            }

                        }
                    );
                }
            );


        // Zoom in
        document
            .getElementById('btn-zoom-in')
            .addEventListener(
                'click',
                () => {
                    camera.position.multiplyScalar(
                        0.85
                    );
                }
            );


        // Zoom out
        document
            .getElementById('btn-zoom-out')
            .addEventListener(
                'click',
                () => {
                    camera.position.multiplyScalar(
                        1.18
                    );
                }
            );
    }


    // ============================================================
    // BOOTSTRAP
    // ============================================================

    document.addEventListener(
        'DOMContentLoaded',
        () => {
            init();
            setupControls();
            buildCrossSection();
        }
    );

})();