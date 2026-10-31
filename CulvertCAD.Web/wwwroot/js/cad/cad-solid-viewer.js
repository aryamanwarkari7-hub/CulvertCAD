
import * as THREE from "three";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/* =========================================================
   1. DOM Elements
   ========================================================= */

const viewport = document.getElementById("stlViewport");
const fileInput = document.getElementById("stlFile");
const status = document.getElementById("stlStatus");
const fitButton = document.getElementById("fitModel");
const resetButton = document.getElementById("resetModel");

if (!viewport || !fileInput || !status) {
    throw new Error("STL viewer elements were not found.");
}

/* =========================================================
   2. Three.js Scene
   ========================================================= */

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b2029);

const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 1e12);
camera.position.set(10, 10, 10);

let renderer;

try {
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false
    });
} catch (error) {
    status.textContent =
        "Unable to initialize the 3D viewer. Please check WebGL support.";
    console.error("WebGL initialization failed:", error);
    throw error;
}

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x1b2029);

viewport.appendChild(renderer.domElement);

/* =========================================================
   3. Camera Controls
   ========================================================= */

const controls = new OrbitControls(camera, renderer.domElement);

controls.enableDamping = false;
controls.enablePan = true;
controls.enableZoom = true;
controls.enableRotate = true;

/* =========================================================
   4. Lighting
   ========================================================= */

scene.add(
    new THREE.HemisphereLight(0xe8eef7, 0x454b56, 1.5)
);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
directionalLight.position.set(1, 2, 3);
scene.add(directionalLight);

/* =========================================================
   5. Reference Grid and Axes
   ========================================================= */

const grid = new THREE.GridHelper(
    10,
    10,
    0x526174,
    0x303946
);

scene.add(grid);

const axes = new THREE.AxesHelper(2);
scene.add(axes);

/* =========================================================
   6. STL Loader and Viewer State
   ========================================================= */

const loader = new STLLoader();

let model = null;
let initialCameraPosition = null;
let initialTarget = null;
let resizeObserver = null;
let loadSequence = 0;

/* =========================================================
   7. Viewport Resizing
   ========================================================= */

function resizeViewer() {
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;

    if (width <= 0 || height <= 0) return;

    renderer.setSize(width, height, false);

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}

if ("ResizeObserver" in window) {
    resizeObserver = new ResizeObserver(() => {
        resizeViewer();
    });

    resizeObserver.observe(viewport);
}

window.addEventListener("resize", resizeViewer);

requestAnimationFrame(resizeViewer);

/* =========================================================
   8. Resource Disposal
   ========================================================= */

function disposeModel(target) {
    if (!target) return;

    target.traverse((child) => {
        if (child.geometry) {
            child.geometry.dispose();
        }

        if (child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach(material => material.dispose());
            } else {
                child.material.dispose();
            }
        }
    });

    scene.remove(target);
}

/* =========================================================
   9. Fit Model to View
   ========================================================= */

function fitModel() {
    if (!model) {
        status.textContent = "Import an STL model before fitting the view.";
        return;
    }

    // Reset previous viewing translation.
    model.position.set(0, 0, 0);
    model.updateMatrixWorld(true);

    const bounds = new THREE.Box3().setFromObject(model);

    if (bounds.isEmpty()) {
        status.textContent = "The STL contains no usable geometry.";
        return;
    }

    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());

    const maxDimension = Math.max(size.x, size.y, size.z);

    if (!Number.isFinite(maxDimension) || maxDimension <= 0) {
        status.textContent = "The STL contains invalid dimensions.";
        return;
    }

    // Centre horizontally and place the lowest point on the grid.
    model.position.set(
        -center.x,
        -bounds.min.y,
        -center.z
    );

    model.updateMatrixWorld(true);

    const target = new THREE.Vector3(
        0,
        size.y / 2,
        0
    );

    const verticalHalfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const horizontalHalfFov = Math.atan(
        Math.tan(verticalHalfFov) * Math.max(camera.aspect, 0.01)
    );

    const distanceForHeight =
        (size.y / 2) / Math.tan(verticalHalfFov);

    const distanceForWidth =
        (size.x / 2) / Math.tan(horizontalHalfFov);

    const distanceForDepth =
        (size.z / 2) / Math.tan(verticalHalfFov);

    const distance = Math.max(
        distanceForHeight,
        distanceForWidth,
        distanceForDepth,
        maxDimension * 0.5
    ) * 2.0;

    const direction = new THREE.Vector3(1, 0.85, 1).normalize();

    camera.position.copy(
        target.clone().add(direction.multiplyScalar(distance))
    );

    camera.near = Math.max(maxDimension / 10000, 0.000001);
    camera.far = Math.max(maxDimension * 100, camera.near * 100);

    camera.updateProjectionMatrix();

    controls.target.copy(target);
    controls.minDistance = Math.max(maxDimension / 10000, 0.000001);
    controls.maxDistance = maxDimension * 100;
    controls.update();

    // Adjust reference grid to the imported model.
    grid.position.y = 0;
    grid.scale.setScalar(Math.max(maxDimension / 10, 0.001));

    axes.position.set(0, 0, 0);
    axes.scale.setScalar(Math.max(maxDimension / 4, 0.001));

    initialCameraPosition = camera.position.clone();
    initialTarget = controls.target.clone();
}

/* =========================================================
   10. Reset Camera
   ========================================================= */

function resetView() {
    if (!model || !initialCameraPosition || !initialTarget) {
        status.textContent = "Import an STL model before resetting the view.";
        return;
    }

    camera.position.copy(initialCameraPosition);
    controls.target.copy(initialTarget);
    controls.update();
}

/* =========================================================
   11. STL File Import
   ========================================================= */

fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];

    if (!file) return;

    const currentSequence = ++loadSequence;

    if (!file.name.toLowerCase().endsWith(".stl")) {
        status.textContent = "Invalid file. Please select an STL file.";
        fileInput.value = "";
        return;
    }

    if (file.size === 0) {
        status.textContent = "The selected STL file is empty.";
        fileInput.value = "";
        return;
    }

    status.textContent = `Loading ${file.name}...`;

    let geometry = null;
    let newModel = null;

    try {
        const buffer = await file.arrayBuffer();

        // Ignore an older import if another file was selected meanwhile.
        if (currentSequence !== loadSequence) return;

        geometry = loader.parse(buffer);

        if (
            !geometry.attributes.position ||
            geometry.attributes.position.count === 0
        ) {
            throw new Error("The file contains no triangle geometry.");
        }

        geometry.computeVertexNormals();
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();

        const material = new THREE.MeshStandardMaterial({
            color: 0xb8c4d2,
            metalness: 0.15,
            roughness: 0.65,
            side: THREE.DoubleSide
        });

        newModel = new THREE.Mesh(geometry, material);

        // Preserve the existing STL orientation convention.
        newModel.rotation.x = -Math.PI / 2;
        newModel.updateMatrixWorld(true);

        // Add visible model edges.
        const edgesGeometry = new THREE.EdgesGeometry(geometry, 25);

        const edgesMaterial = new THREE.LineBasicMaterial({
            color: 0x202630,
            transparent: true,
            opacity: 0.85
        });

        const edges = new THREE.LineSegments(
            edgesGeometry,
            edgesMaterial
        );

        newModel.add(edges);

        // Replace the previous model only after successful parsing.
        if (currentSequence !== loadSequence) {
            disposeModel(newModel);
            return;
        }

        disposeModel(model);

        model = newModel;
        scene.add(model);

        fitModel();

        document.getElementById("stlEmptyState")?.classList.add("is-hidden");

        const rawBounds = geometry.boundingBox;
        const rawSize = rawBounds.getSize(new THREE.Vector3());

        const triangleCount = geometry.index
            ? geometry.index.count / 3
            : geometry.attributes.position.count / 3;

        // Build a compact engineering information panel.
        // All displayed values come directly from the existing STL loader.

        status.classList.add("is-model-loaded");

        const statusHeader = document.createElement("div");
        statusHeader.className = "cad-status-header";

        const loadedLabel = document.createElement("span");
        loadedLabel.className = "cad-status-loaded";

        const loadedIcon = document.createElement("i");
        loadedIcon.className = "bi bi-check-circle-fill";
        loadedIcon.setAttribute("aria-hidden", "true");

        loadedLabel.append(loadedIcon, " Model loaded");

        const filePill = document.createElement("span");
        filePill.className = "cad-status-pill cad-status-file";
        filePill.title = file.name;

        const fileIcon = document.createElement("i");
        fileIcon.className = "bi bi-file-earmark";
        fileIcon.setAttribute("aria-hidden", "true");

        const fileName = document.createElement("span");
        fileName.textContent = file.name;

        filePill.append(fileIcon, fileName);
        statusHeader.append(loadedLabel, filePill);

        const metrics = document.createElement("div");
        metrics.className = "cad-status-metrics";

        const createMetric = (label, value) => {
            const pill = document.createElement("span");
            pill.className = "cad-status-pill";

            const labelElement = document.createElement("span");
            labelElement.className = "cad-status-metric-label";
            labelElement.textContent = label;

            const valueElement = document.createElement("strong");
            valueElement.className = "cad-status-metric-value";
            valueElement.textContent = value;

            pill.append(labelElement, valueElement);
            return pill;
        };

        // Engineering information: mesh complexity and bounding dimensions.

        

        // Mesh complexity — approximately 25% of the available width.
        const complexityCard = document.createElement("div");
        complexityCard.className = "cad-status-card cad-status-complexity";

        const complexityLabel = document.createElement("span");
        complexityLabel.className = "cad-status-card-label";
        complexityLabel.textContent = "Mesh complexity";

        const complexityValue = document.createElement("strong");
        complexityValue.className = "cad-status-card-value";
        complexityValue.textContent =
            `${triangleCount.toLocaleString()} triangles`;

        complexityCard.append(complexityLabel, complexityValue);

        // Bounding dimensions — approximately 75% of the available width.
        const dimensionsCard = document.createElement("div");
        dimensionsCard.className = "cad-status-card cad-status-dimensions";

        const dimensionsLabel = document.createElement("span");
        dimensionsLabel.className = "cad-status-card-label";
        dimensionsLabel.textContent = "Bounding dimensions";

        const dimensionsValues = document.createElement("div");
        dimensionsValues.className = "cad-status-dimension-values";

        const createDimension = (axis, value) => {
            const item = document.createElement("div");
            item.className = "cad-status-dimension";

            const axisLabel = document.createElement("span");
            axisLabel.className = "cad-status-axis";
            axisLabel.textContent = axis;

            const dimensionValue = document.createElement("strong");
            dimensionValue.className = "cad-status-card-value";
            dimensionValue.textContent = value.toFixed(3);

            item.append(axisLabel, dimensionValue);
            return item;
        };

        dimensionsValues.append(
            createDimension("X", rawSize.x),
            createDimension("Y", rawSize.y),
            createDimension("Z", rawSize.z)
        );

        const dimensionsNote = document.createElement("span");
        dimensionsNote.className = "cad-status-dimensions-note";
        dimensionsNote.textContent = "Drawing units — not yet verified";

        dimensionsCard.append(
            dimensionsLabel,
            dimensionsValues,
            dimensionsNote
        );

        metrics.append(complexityCard, dimensionsCard);

        const warning = document.createElement("div");
        warning.className = "cad-status-warning";

        const warningIcon = document.createElement("i");
        warningIcon.className = "bi bi-exclamation-triangle";
        warningIcon.setAttribute("aria-hidden", "true");

        const warningText = document.createElement("span");
        warningText.textContent =
            "Drawing units and geographic position are not yet verified.";

        warning.append(warningIcon, warningText);

        status.replaceChildren(
            statusHeader,
            metrics,
            warning
        );

        // AUTO-SAVE STL FILE DIRECTLY TO MONGODB (Base64)
        if (window.saveSolidModelToMongo) {
            try {
                const reader = new FileReader();
                reader.onload = () => {
                    window.saveSolidModelToMongo(file, reader.result, "3D_STL");
                };
                reader.readAsDataURL(file);
            } catch (saveErr) {
                console.warn("[CulvertCAD] Could not read STL for MongoDB save:", saveErr);
            }
        }

    } catch (error) {
        if (newModel && newModel !== model) {
            disposeModel(newModel);
        } else if (geometry && geometry !== model?.geometry) {
            geometry.dispose();
        }

        console.error("STL import failed:", error);

        status.textContent =
            `Could not load STL: ${error.message || "Unknown error"}`;
    }
});

/* =========================================================
   12. Toolbar Actions
   ========================================================= */

fitButton?.addEventListener("click", fitModel);
resetButton?.addEventListener("click", resetView);

/* =========================================================
   13. Rendering Loop
   ========================================================= */

renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
});

/* =========================================================
   14. Cleanup
   ========================================================= */

window.addEventListener("pagehide", () => {
    loadSequence++;

    if (resizeObserver) {
        resizeObserver.disconnect();
    }

    window.removeEventListener("resize", resizeViewer);

    renderer.setAnimationLoop(null);

    disposeModel(model);

    controls.dispose();
    grid.geometry.dispose();
    axes.geometry.dispose();

    renderer.dispose();
});

// Drag-and-Drop support on STL Viewport
const stlDropZone = document.getElementById("stlViewport");
if (stlDropZone) {
    ["dragenter", "dragover"].forEach((eventName) => {
        stlDropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            stlDropZone.classList.add("dragover");
        });
    });

    ["dragleave", "drop"].forEach((eventName) => {
        stlDropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            stlDropZone.classList.remove("dragover");
        });
    });

    stlDropZone.addEventListener("drop", (e) => {
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            fileInput.files = files;
            fileInput.dispatchEvent(new Event("change"));
        }
    });
}

/* =========================================================
   15. Load STL Model from Database String
   ========================================================= */
/* =========================================================
   Shared STL Engineering Status Panel
   ========================================================= */
function renderStlEngineeringStatus(geometry, fileName, isFromDatabase = false) {
    status.classList.add("is-model-loaded");

    const statusHeader = document.createElement("div");
    statusHeader.className = "cad-status-header";

    const loadedLabel = document.createElement("span");
    loadedLabel.className = "cad-status-loaded";

    const loadedIcon = document.createElement("i");
    loadedIcon.className = isFromDatabase ? "bi bi-cloud-check-fill" : "bi bi-check-circle-fill";
    loadedIcon.setAttribute("aria-hidden", "true");

    loadedLabel.append(loadedIcon, isFromDatabase ? " Loaded from Database" : " Model loaded");

    const filePill = document.createElement("span");
    filePill.className = "cad-status-pill cad-status-file";
    filePill.title = fileName;

    const fileIcon = document.createElement("i");
    fileIcon.className = "bi bi-file-earmark";
    fileIcon.setAttribute("aria-hidden", "true");

    const fileNameEl = document.createElement("span");
    fileNameEl.textContent = fileName;

    filePill.append(fileIcon, fileNameEl);
    statusHeader.append(loadedLabel, filePill);

    const metrics = document.createElement("div");
    metrics.className = "cad-status-metrics";

    const rawBounds = geometry.boundingBox || new THREE.Box3().setFromObject(model);
    const rawSize = rawBounds.getSize(new THREE.Vector3());
    const triangleCount = geometry.index
        ? geometry.index.count / 3
        : geometry.attributes.position.count / 3;

    // Mesh complexity card
    const complexityCard = document.createElement("div");
    complexityCard.className = "cad-status-card cad-status-complexity";
    const complexityLabel = document.createElement("span");
    complexityLabel.className = "cad-status-card-label";
    complexityLabel.textContent = "Mesh complexity";
    const complexityValue = document.createElement("strong");
    complexityValue.className = "cad-status-card-value";
    complexityValue.textContent = `${Math.round(triangleCount).toLocaleString()} triangles`;
    complexityCard.append(complexityLabel, complexityValue);

    // Bounding dimensions card
    const dimensionsCard = document.createElement("div");
    dimensionsCard.className = "cad-status-card cad-status-dimensions";
    const dimensionsLabel = document.createElement("span");
    dimensionsLabel.className = "cad-status-card-label";
    dimensionsLabel.textContent = "Bounding dimensions";
    const dimensionsValues = document.createElement("div");
    dimensionsValues.className = "cad-status-dimension-values";

    const createDimension = (axis, value) => {
        const item = document.createElement("div");
        item.className = "cad-status-dimension";
        const axisLabel = document.createElement("span");
        axisLabel.className = "cad-status-axis";
        axisLabel.textContent = axis;
        const dimensionValue = document.createElement("strong");
        dimensionValue.className = "cad-status-card-value";
        dimensionValue.textContent = value.toFixed(3);
        item.append(axisLabel, dimensionValue);
        return item;
    };

    dimensionsValues.append(
        createDimension("X", rawSize.x),
        createDimension("Y", rawSize.y),
        createDimension("Z", rawSize.z)
    );

    const dimensionsNote = document.createElement("span");
    dimensionsNote.className = "cad-status-dimensions-note";
    dimensionsNote.textContent = "Drawing units — not yet verified";

    dimensionsCard.append(dimensionsLabel, dimensionsValues, dimensionsNote);
    metrics.append(complexityCard, dimensionsCard);

    const warning = document.createElement("div");
    warning.className = "cad-status-warning";
    const warningIcon = document.createElement("i");
    warningIcon.className = "bi bi-exclamation-triangle";
    warningIcon.setAttribute("aria-hidden", "true");
    const warningText = document.createElement("span");
    warningText.textContent = "Drawing units and geographic position are not yet verified.";
    warning.append(warningIcon, warningText);

    status.replaceChildren(statusHeader, metrics, warning);
}

/* =========================================================
   15. Load STL Model from Database Content (Base64 or ASCII)
   ========================================================= */
window.loadStlFromDatabaseContent = function (contentString, fileName) {
    try {
        let buffer;
        if (contentString.startsWith("data:") || !contentString.trim().startsWith("solid")) {
            // Decode Base64 Binary STL
            const base64 = contentString.includes(",") ? contentString.split(",")[1] : contentString;
            const binaryString = atob(base64);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            buffer = bytes.buffer;
        } else {
            buffer = new TextEncoder().encode(contentString).buffer;
        }

        const geom = loader.parse(buffer);

        if (!geom.attributes.position || geom.attributes.position.count === 0) {
            throw new Error("No triangle geometry found in STL.");
        }

        geom.computeVertexNormals();
        geom.computeBoundingBox();
        geom.computeBoundingSphere();

        const material = new THREE.MeshStandardMaterial({
            color: 0xb8c4d2,
            metalness: 0.15,
            roughness: 0.65,
            side: THREE.DoubleSide
        });

        const newModel = new THREE.Mesh(geom, material);
        newModel.rotation.x = -Math.PI / 2;
        newModel.updateMatrixWorld(true);

        const edgesGeom = new THREE.EdgesGeometry(geom, 25);
        const edgesMat = new THREE.LineBasicMaterial({
            color: 0x202630,
            transparent: true,
            opacity: 0.85
        });
        newModel.add(new THREE.LineSegments(edgesGeom, edgesMat));

        disposeModel(model);
        model = newModel;
        scene.add(model);
        fitModel();

        document.getElementById("stlEmptyState")?.classList.add("is-hidden");

        // Renders the full engineering cards (complexity, dimensions, units note)
        renderStlEngineeringStatus(geom, fileName, true);

    } catch (err) {
        console.error("Failed to render STL from database:", err);
        const stlStatus = document.getElementById("stlStatus");
        if (stlStatus) stlStatus.textContent = `Could not render STL: ${err.message}`;
    }
};