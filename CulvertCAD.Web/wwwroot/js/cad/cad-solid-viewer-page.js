
(() => {
    "use strict";

    /* =========================================================
       1. Page Elements
       ========================================================= */

    const page = document.querySelector(".cad-solid-page");

    if (!page) {
        console.warn("CAD Solid Viewer page was not found.");
        return;
    }

    const tabButtons = Array.from(
        page.querySelectorAll("[data-viewer-tab]")
    );

    const panels = Array.from(
        page.querySelectorAll(".cad-viewer-panel")
    );

    /* =========================================================
       2. Tab Navigation
       ========================================================= */

    function activateTab(panelId, moveFocus = false) {
        const targetPanel = panels.find(
            panel => panel.id === panelId
        );

        const targetButton = tabButtons.find(
            button => button.dataset.viewerTab === panelId
        );

        if (!targetPanel || !targetButton) {
            console.warn(`CAD Viewer tab not found: ${panelId}`);
            return;
        }

        // Update tab appearance and accessibility.
        tabButtons.forEach(button => {
            const selected = button === targetButton;

            button.classList.toggle("is-active", selected);
            button.setAttribute("aria-selected", String(selected));
            button.tabIndex = selected ? 0 : -1;
        });

        // Display only the selected panel.
        panels.forEach(panel => {
            panel.hidden = panel !== targetPanel;
        });

        if (moveFocus) {
            targetButton.focus();
        }

        // Notify the STL renderer that its viewport may need resizing.
        if (panelId === "stlPanel") {
            requestAnimationFrame(() => {
                window.dispatchEvent(new Event("resize"));
            });
        }
    }

    /* =========================================================
       3. Tab Click and Keyboard Events
       ========================================================= */

    tabButtons.forEach((button, index) => {

        button.addEventListener("click", () => {
            activateTab(button.dataset.viewerTab);
        });

        button.addEventListener("keydown", event => {

            const supportedKeys = [
                "ArrowLeft",
                "ArrowRight",
                "Home",
                "End"
            ];

            if (!supportedKeys.includes(event.key)) {
                return;
            }

            event.preventDefault();

            let nextIndex = index;

            switch (event.key) {

                case "ArrowRight":
                    nextIndex = (index + 1) % tabButtons.length;
                    break;

                case "ArrowLeft":
                    nextIndex =
                        (index - 1 + tabButtons.length) %
                        tabButtons.length;
                    break;

                case "Home":
                    nextIndex = 0;
                    break;

                case "End":
                    nextIndex = tabButtons.length - 1;
                    break;
            }

            activateTab(
                tabButtons[nextIndex].dataset.viewerTab,
                true
            );
        });
    });

    // Initialize the active tab.
    const initiallySelectedTab = tabButtons.find(
        button => button.getAttribute("aria-selected") === "true"
    );

    activateTab(
        initiallySelectedTab?.dataset.viewerTab ||
        tabButtons[0]?.dataset.viewerTab ||
        "stlPanel"
    );

    /* =========================================================
       4. HTML Preview Elements
       ========================================================= */

    const fileInput = page.querySelector("#htmlViewerFile");
    const frame = page.querySelector("#htmlViewerFrame");
    const frameContainer = page.querySelector(
        "#htmlViewerFrameContainer"
    );
    const emptyState = page.querySelector("#htmlViewerEmptyState");
    const status = page.querySelector("#htmlViewerStatus");
    const clearButton = page.querySelector("#clearHtmlViewer");
    const fullscreenButton = page.querySelector(
        "#fullscreenHtmlViewer"
    );

    if (
        !fileInput ||
        !frame ||
        !frameContainer ||
        !status ||
        !clearButton ||
        !fullscreenButton

    ) {
        console.error(
            "HTML preview initialization failed. " +
            "One or more required HTML viewer elements are missing."
        );

        return;
    }

    /* =========================================================
       5. HTML Preview Configuration
       ========================================================= */

    const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

    let currentObjectUrl = null;

    /* =========================================================
       6. Empty State Management
       ========================================================= */

    function showEmptyState() {

        if (emptyState) {
            emptyState.hidden = false;
        }

        frameContainer.hidden = true;
    }

    function showPreview() {

        if (emptyState) {
            emptyState.hidden = true;
        }

        frameContainer.hidden = false;
    }

    /* =========================================================
       7. Object URL Management
       ========================================================= */

    function revokeCurrentObjectUrl() {

        if (!currentObjectUrl) {
            return;
        }

        URL.revokeObjectURL(currentObjectUrl);

        currentObjectUrl = null;
    }

    /* =========================================================
   8. HTML Preview Full Screen
   ========================================================= */

    function updateFullscreenButton() {

        const isFullscreen =
            document.fullscreenElement === frameContainer;

        const icon = fullscreenButton.querySelector("i");

        fullscreenButton.disabled = !currentObjectUrl;

        fullscreenButton.setAttribute(
            "aria-label",
            isFullscreen ? "Exit full screen" : "Enter full screen"
        );

        fullscreenButton.title =
            isFullscreen ? "Exit full screen" : "View HTML preview in full screen";

        fullscreenButton.replaceChildren();

        const buttonIcon = document.createElement("i");

        buttonIcon.className = isFullscreen
            ? "bi bi-fullscreen-exit"
            : "bi bi-arrows-fullscreen";

        buttonIcon.setAttribute("aria-hidden", "true");

        fullscreenButton.append(
            buttonIcon,
            document.createTextNode(
                isFullscreen ? " Exit Full Screen" : " Full Screen"
            )
        );
    }

    async function toggleFullscreen() {

        if (!currentObjectUrl) {
            return;
        }

        try {

            if (document.fullscreenElement === frameContainer) {

                await document.exitFullscreen();

            } else {

                await frameContainer.requestFullscreen();

            }

        } catch (error) {

            console.error("HTML preview full screen failed:", error);

            status.textContent =
                "Could not enter full screen. Your browser may have blocked the request.";
        }
    }

    fullscreenButton.addEventListener(
        "click",
        toggleFullscreen
    );

    document.addEventListener(
        "fullscreenchange",
        updateFullscreenButton
    );

    /* =========================================================
       8. Clear HTML Preview
       ========================================================= */

    async function clearPreview(
        message = "No HTML viewer selected."
    ) {

        frame.removeAttribute("src");

        revokeCurrentObjectUrl();

        showEmptyState();

        clearButton.disabled = true;

        status.textContent = message;

        // Permit selecting the same file again.
        fileInput.value = "";

        if (document.fullscreenElement === frameContainer) {
            await document.exitFullscreen();
        }
    }

    /* =========================================================
       9. HTML File Validation
       ========================================================= */

    function validateHtmlFile(file) {

        if (!file) {
            return "Please select an HTML file.";
        }

        const fileName = file.name.toLowerCase();

        const isHtml =
            fileName.endsWith(".html") ||
            fileName.endsWith(".htm");

        if (!isHtml) {
            return "Invalid file. Please select an .html or .htm file.";
        }

        if (file.size === 0) {
            return "The selected HTML file is empty.";
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
            return "The HTML file exceeds the 25 MB preview limit.";
        }

        return null;
    }

    /* =========================================================
       10. Load HTML Preview
       ========================================================= */

    fileInput.addEventListener("change", async () => {
        const file = fileInput.files?.[0];

        if (!file) {
            return;
        }

        const validationError = validateHtmlFile(file);

        if (validationError) {
            clearPreview(validationError);
            return;
        }

        try {
            // Release the previous preview.
            frame.removeAttribute("src");
            revokeCurrentObjectUrl();

            // Create a temporary URL for the iframe preview
            currentObjectUrl = URL.createObjectURL(file);
            frame.setAttribute("src", currentObjectUrl);
            showPreview();

            clearButton.disabled = false;
            updateFullscreenButton();

            status.textContent = `Loading & verifying 3D CAD geometry from ${file.name}...`;

            // AUTO-SAVE HTML FILE DIRECTLY TO MONGODB
            try {
                const fileText = await file.text();
                window.saveSolidModelToMongo(file, fileText, "3D_SOLID");
            } catch (saveErr) {
                console.warn("[CulvertCAD] Could not read text for MongoDB save:", saveErr);
            }

            // Parse solid geometry with CulvertHtmlReader
            if (window.CulvertHtmlReader) {
                try {
                    const solidModel = await window.CulvertHtmlReader.parse(file);
                    window.ACTIVE_CULVERT_SOLID_MODEL = solidModel;

                    // Cache in session storage for the Survey Map
                    try {
                        sessionStorage.setItem("culvert_cad_active_solid", JSON.stringify(solidModel));
                    } catch (e) { }

                    status.innerHTML = `
                        <strong style="color:#58a6ff;">✓ 3D Culvert Verified:</strong> 
                        ${solidModel.solidCount} Solids · ${solidModel.partCount} Parts · ${solidModel.solids.length} Layers 
                        <span style="color:#8b949e;margin-left:8px;">(${file.name})</span>
                    `;
                    console.info("[CulvertCAD] Generic HTML Reader parsed solid model:", solidModel);
                } catch (parseErr) {
                    console.warn("[CulvertCAD] HTML preview loaded in iframe, but solid extraction had a note:", parseErr);
                    status.textContent = `Previewing: ${file.name} (Standalone Viewer)`;
                }
            } else {
                status.textContent = `Previewing: ${file.name}`;
            }

        } catch (error) {
            console.error("HTML preview failed:", error);
            clearPreview(`Could not open HTML preview: ${error.message}`);
        }
    });

    /* =========================================================
       11. Close HTML Preview
       ========================================================= */

    clearButton.addEventListener("click", () => {
        clearPreview();
    });

    /* =========================================================
       12. Initial HTML Preview State
       ========================================================= */

    showEmptyState();

    clearButton.disabled = true;

    status.textContent = "No HTML viewer selected.";

    fullscreenButton.disabled = true;
    updateFullscreenButton();

    /* =========================================================
       13. Resource Cleanup
       ========================================================= */

    window.addEventListener("pagehide", () => {

        frame.removeAttribute("src");

        revokeCurrentObjectUrl();
    });

    console.info("CAD Solid Viewer page initialized successfully.");

    // Drag-and-Drop support on HTML Preview Workspace
    const htmlDropZone = document.getElementById("htmlViewerEmptyState") || document.getElementById("htmlPanel");
    if (htmlDropZone) {
        ["dragenter", "dragover"].forEach((eventName) => {
            htmlDropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                htmlDropZone.classList.add("dragover");
            });
        });

        ["dragleave", "drop"].forEach((eventName) => {
            htmlDropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                htmlDropZone.classList.remove("dragover");
            });
        });

        htmlDropZone.addEventListener("drop", (e) => {
            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                fileInput.files = files;
                fileInput.dispatchEvent(new Event("change"));
            }
        });
    }

})();

/* =========================================================
14. Recent CAD Models & History Integration
========================================================= */

const btnOpenHistory = document.getElementById("btnOpenHistory");
const btnCloseHistory = document.getElementById("btnCloseHistory");
const historyDrawer = document.getElementById("cadHistoryDrawer");
const historyList = document.getElementById("cadHistoryList");
const historySearch = document.getElementById("cadHistorySearch");

let loadedHistoryItems = [];

/* =========================================================
   Auto-Save Imported Solid Model to MongoDB
   ========================================================= */
window.saveSolidModelToMongo = async function (file, content, modelType = "3D_SOLID") {
    const projSelect = document.getElementById("cadActiveProjectId");
    const projId = projSelect ? parseInt(projSelect.value, 10) : 0;
    if (!projId || projId <= 0) {
        console.warn("[CulvertCAD] No active project selected, skipping Mongo auto-save.");
        return;
    }

    try {
        const payload = {
            projectId: projId,
            fileName: file.name || (modelType === "3D_SOLID" ? "culvert_model.html" : "culvert_model.stl"),
            modelType: modelType,
            solidDataJson: content
        };

        const resp = await fetch("/Survey/SaveCulvertSolid", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (resp.ok) {
            console.info(`[CulvertCAD] Model saved to MongoDB for Project #${projId}`);
            const statusEl = document.getElementById(modelType === "3D_SOLID" ? "htmlViewerStatus" : "stlStatus");
            if (statusEl) {
                const saveBadge = document.createElement("span");
                saveBadge.style.color = "#3fb950";
                saveBadge.style.marginLeft = "10px";
                saveBadge.innerHTML = `<i class="bi bi-cloud-check"></i> Saved to Database`;
                statusEl.appendChild(saveBadge);
            }
        } else {
            const errData = await resp.json().catch(() => null);
            const errMsg = errData?.message || `Server returned status ${resp.status}`;
            console.warn("[CulvertCAD] Auto-save failed:", errMsg);
            const statusEl = document.getElementById(modelType === "3D_SOLID" ? "htmlViewerStatus" : "stlStatus");
            if (statusEl) {
                const errBadge = document.createElement("span");
                errBadge.style.color = "#f85149";
                errBadge.style.marginLeft = "10px";
                errBadge.innerHTML = `<i class="bi bi-exclamation-triangle"></i> Save failed: ${errMsg}`;
                statusEl.appendChild(errBadge);
            }
        }
    } catch (e) {
        console.warn("[CulvertCAD] Auto-save network error:", e);
    }
};

async function fetchRecentModels() {
    if (!historyList) return;
    historyList.innerHTML = `
            <div class="cad-history-loading">
                <i class="bi bi-arrow-repeat spin"></i>
                <span>Loading saved models from database...</span>
            </div>
        `;

    try {
        // Change from 3D_SOLID to 3D:
        const resp = await fetch("/api/cad/recent-models?modelType=3D");
        if (!resp.ok) throw new Error("Failed to query recent models");
        const data = await resp.json();

        loadedHistoryItems = data.items || [];
        renderHistoryItems(loadedHistoryItems);
    } catch (err) {
        console.error("Error loading recent models:", err);
        historyList.innerHTML = `
                <div class="cad-history-empty">
                    <i class="bi bi-exclamation-triangle" style="font-size:24px;color:#f85149;"></i>
                    <span>Could not load saved models: ${err.message}</span>
                </div>
            `;
    }
}

function renderHistoryItems(items) {
    if (!historyList) return;
    if (!items || items.length === 0) {
        historyList.innerHTML = `
                <div class="cad-history-empty">
                    <i class="bi bi-box" style="font-size:24px;"></i>
                    <span>No saved 3D solid models found yet.</span>
                </div>
            `;
        return;
    }

    historyList.innerHTML = items.map(item => `
            <div class="cad-history-item" data-code="${(item.projectCode || '').toLowerCase()}" data-name="${(item.projectName || '').toLowerCase()}" data-file="${(item.fileName || '').toLowerCase()}">
                <div class="cad-item-top">
                    <span class="cad-item-badge">${escapeHtml(item.projectCode)}</span>
                    <span class="cad-item-date">${new Date(item.uploadedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <h4 class="cad-item-name">${escapeHtml(item.projectName)}</h4>
                <p class="cad-item-sub"><i class="bi bi-file-earmark-code"></i> ${escapeHtml(item.fileName || 'Culvert Solid Mesh')}</p>
                <div class="cad-item-footer">
                    <button type="button" class="cad-btn-load" data-project-id="${item.projectId}" data-model-type="${item.modelType || '3D_SOLID'}">
                        <i class="bi bi-box-arrow-in-down-right"></i> Load in Viewer
                    </button>
                </div>
            </div>
        `).join("");

    // Attach Load buttons
    historyList.querySelectorAll(".cad-btn-load").forEach(btn => {
        btn.addEventListener("click", () => {
            const projId = btn.dataset.projectId;
            const modelType = btn.dataset.modelType || "3D_SOLID";
            loadSolidFromDatabase(projId, modelType);
        });
    });
}

async function loadSolidFromDatabase(projectId, modelType = "3D_SOLID") {
    if (historyDrawer) {
        historyDrawer.setAttribute("hidden", "");
        historyDrawer.style.display = "none";
    }
    const htmlStatus = document.getElementById("htmlViewerStatus");
    const stlStatus = document.getElementById("stlStatus");

    if (modelType === "3D_STL") {
        if (stlStatus) {
            stlStatus.innerHTML = `<span style="color:#f0883e;"><i class="bi bi-arrow-repeat spin"></i> Loading STL mesh from Project #${projectId}...</span>`;
        }
    } else {
        if (htmlStatus) {
            htmlStatus.innerHTML = `<span style="color:#f0883e;"><i class="bi bi-arrow-repeat spin"></i> Loading solid model from Project #${projectId}...</span>`;
        }
    }

    try {
        const resp = await fetch(`/Survey/GetCulvertSolid?projectId=${encodeURIComponent(projectId)}&modelType=${encodeURIComponent(modelType)}`);
        if (!resp.ok) throw new Error("Could not fetch solid geometry");

        const rawContent = await resp.text();
        if (!rawContent || rawContent.trim().length === 0) {
            throw new Error("Empty model content received from server");
        }

        // Handle 3D STL Model
        if (modelType === "3D_STL") {
            document.getElementById("stlTab")?.click();
            if (window.loadStlFromDatabaseContent) {
                window.loadStlFromDatabaseContent(rawContent, `Project #${projectId} Mesh`);
            }
            return;
        }

        // Handle HTML 3D Solid Model
        document.getElementById("htmlTab")?.click();

        let solidModel = null;

        if (rawContent.trim().startsWith("<")) {
            const frame = document.getElementById("htmlViewerFrame");
            const emptyState = document.getElementById("htmlViewerEmptyState");
            const frameContainer = document.getElementById("htmlViewerFrameContainer");
            const clearBtn = document.getElementById("clearHtmlViewer");
            const fsBtn = document.getElementById("fullscreenHtmlViewer");

            const blob = new Blob([rawContent], { type: "text/html" });
            const blobUrl = URL.createObjectURL(blob);
            if (frame) frame.src = blobUrl;

            if (emptyState) {
                emptyState.hidden = true;
                emptyState.style.display = "none";
            }
            if (frameContainer) {
                frameContainer.hidden = false;
                frameContainer.removeAttribute("hidden");
                frameContainer.style.display = "block";
            }
            clearBtn?.removeAttribute("disabled");
            fsBtn?.removeAttribute("disabled");

            if (window.CulvertHtmlReader) {
                try {
                    solidModel = await window.CulvertHtmlReader.parse(rawContent);
                    window.ACTIVE_CULVERT_SOLID_MODEL = solidModel;
                    sessionStorage.setItem("culvert_cad_active_solid", JSON.stringify(solidModel));
                } catch (pe) {
                    console.warn("Could not extract geometry array:", pe);
                }
            }
        } else {
            solidModel = JSON.parse(rawContent);
            window.ACTIVE_CULVERT_SOLID_MODEL = solidModel;
            sessionStorage.setItem("culvert_cad_active_solid", JSON.stringify(solidModel));
        }

        if (htmlStatus) {
            const solidCount = solidModel?.solidCount || solidModel?.solids?.length || "3D";
            htmlStatus.innerHTML = `
                <strong style="color:#3fb950;">✓ Loaded from Database:</strong> 
                ${solidCount} Solids · Project #${projectId}
                <span style="color:#8b949e;margin-left:8px;">(${solidModel?.name || 'Culvert Model'})</span>
            `;
        }
    } catch (err) {
        console.error("Load failed:", err);
        if (modelType === "3D_STL") {
            if (stlStatus) stlStatus.innerHTML = `<span style="color:#f85149;">✕ Load failed: ${err.message}</span>`;
        } else {
            if (htmlStatus) htmlStatus.innerHTML = `<span style="color:#f85149;">✕ Load failed: ${err.message}</span>`;
        }
    }
}

function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

if (btnOpenHistory && historyDrawer) {
    btnOpenHistory.addEventListener("click", (e) => {
        e.preventDefault();
        console.log("Opening history drawer...");
        historyDrawer.removeAttribute("hidden");
        historyDrawer.style.display = "flex";
        fetchRecentModels();
    });
}

if (btnCloseHistory && historyDrawer) {
    btnCloseHistory.addEventListener("click", (e) => {
        e.preventDefault();
        historyDrawer.setAttribute("hidden", "");
        historyDrawer.style.display = "none";
    });
}

if (historyDrawer) {
    historyDrawer.addEventListener("click", (e) => {
        if (e.target === historyDrawer) {
            historyDrawer.setAttribute("hidden", "");
            historyDrawer.style.display = "none";
        }
    });
}

if (historySearch) {
    historySearch.addEventListener("input", (e) => {
        const q = e.target.value.trim().toLowerCase();
        const items = historyList.querySelectorAll(".cad-history-item");
        items.forEach(el => {
            const code = el.dataset.code || "";
            const name = el.dataset.name || "";
            const file = el.dataset.file || "";
            el.style.display = (!q || code.includes(q) || name.includes(q) || file.includes(q)) ? "" : "none";
        });
    });
}

// Auto-load if ?projectId= is in URL query
const urlParams = new URLSearchParams(window.location.search);
const autoProjId = urlParams.get("projectId");
if (autoProjId) {
    loadSolidFromDatabase(autoProjId);
}

/* =========================================================
15. STL Viewport Full Screen Toggle
========================================================= */
const fullscreenStlBtn = document.getElementById("fullscreenStlViewer");
const stlViewport = document.getElementById("stlViewport");

if (fullscreenStlBtn && stlViewport) {
    fullscreenStlBtn.addEventListener("click", async () => {
        try {
            if (document.fullscreenElement === stlViewport) {
                await document.exitFullscreen();
            } else {
                await stlViewport.requestFullscreen();
            }
        } catch (err) {
            console.warn("Fullscreen request failed:", err);
        }
    });

    document.addEventListener("fullscreenchange", () => {
        const isFs = document.fullscreenElement === stlViewport;
        fullscreenStlBtn.innerHTML = isFs
            ? '<i class="bi bi-fullscreen-exit" aria-hidden="true"></i> Exit Full Screen'
            : '<i class="bi bi-arrows-fullscreen" aria-hidden="true"></i> Full Screen';

        // Trigger window resize so Three.js camera aspect ratio updates immediately
        setTimeout(() => {
            window.dispatchEvent(new Event("resize"));
        }, 60);
    });
}