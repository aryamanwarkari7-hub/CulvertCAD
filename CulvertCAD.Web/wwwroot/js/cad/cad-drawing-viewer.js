(() => {
    "use strict";

    const canvas = document.getElementById("cadCanvas");
    const fileInput = document.getElementById("cadFile");

    // This script is shared only by the CAD Drawing Viewer page.
    if (!canvas || !fileInput) return;

    const ctx = canvas.getContext("2d");
    const status = document.getElementById("cadStatus");
    const layersPanel = document.getElementById("cadLayers");
    const infoPanel = document.getElementById("cadInfo");

    const state = {
        drawing: null,
        visibleLayers: new Set(),
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        fitScale: 1,
        fitOffsetX: 0,
        fitOffsetY: 0,
        dragging: false,
        lastX: 0,
        lastY: 0,
        bounds: null
    };

    const COLORS = [
        "#2563eb", "#dc2626", "#059669", "#9333ea",
        "#d97706", "#0891b2", "#db2777", "#4f46e5",
        "#65a30d", "#475569"
    ];

    const layerColors = new Map();

    function layerColor(name) {
        if (!layerColors.has(name)) {
            layerColors.set(name, COLORS[layerColors.size % COLORS.length]);
        }
        return layerColors.get(name);
    }

    function setStatus(message, kind = "secondary") {
        status.className = `alert alert-${kind}`;
        status.textContent = message;
    }

    function getAntiforgeryToken() {
        return document.querySelector(
            '#cadAntiforgeryForm input[name="__RequestVerificationToken"]'
        )?.value ?? "";
    }

    function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        canvas.width = Math.max(1, Math.round(rect.width * dpr));
        canvas.height = Math.max(1, Math.round(rect.height * dpr));

        // Draw in CSS pixels, independently of the display pixel density.
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        render();
    }

    function dimensions() {
        const rect = canvas.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
    }

    function worldToScreen(x, y) {
        return {
            x: x * state.scale + state.offsetX,
            y: -y * state.scale + state.offsetY
        };
    }

    function fitDrawing() {
        if (!state.drawing || !state.bounds) return;

        const { width, height } = dimensions();
        const b = state.bounds;

        const rangeX = Math.max(b.maxX - b.minX, 1e-9);
        const rangeY = Math.max(b.maxY - b.minY, 1e-9);
        const padding = 32;

        state.fitScale = Math.max(
            1e-12,
            Math.min(
                (width - 2 * padding) / rangeX,
                (height - 2 * padding) / rangeY
            )
        );

        state.fitOffsetX =
            width / 2 - ((b.minX + b.maxX) / 2) * state.fitScale;

        state.fitOffsetY =
            height / 2 + ((b.minY + b.maxY) / 2) * state.fitScale;

        state.scale = state.fitScale;
        state.offsetX = state.fitOffsetX;
        state.offsetY = state.fitOffsetY;

        render();
    }

    function render() {
        const { width, height } = dimensions();

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);

        if (!state.drawing) {
            ctx.fillStyle = "#64748b";
            ctx.font = "15px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(
                "Import a DXF drawing to begin",
                width / 2,
                height / 2
            );
            return;
        }

        const drawing = state.drawing;

        // Keep source coordinates unchanged. Transform only for display.
        ctx.save();
        ctx.lineWidth = 1;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        for (const path of drawing.paths ?? []) {
            if (!state.visibleLayers.has(path.layer)) continue;
            if (!Array.isArray(path.points) || path.points.length < 2) continue;

            ctx.beginPath();

            path.points.forEach((point, index) => {
                const p = worldToScreen(point.x, point.y);

                if (index === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            });

            if (path.closed) ctx.closePath();

            ctx.strokeStyle = layerColor(path.layer);
            ctx.stroke();
        }

        for (const circle of drawing.circles ?? []) {
            if (!state.visibleLayers.has(circle.layer)) continue;

            const center = worldToScreen(circle.x, circle.y);
            const radius = circle.radius * state.scale;

            if (!Number.isFinite(radius) || radius <= 0) continue;

            ctx.beginPath();
            ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
            ctx.strokeStyle = layerColor(circle.layer);
            ctx.stroke();
        }


        for (const label of drawing.texts ?? []) {
            if (!state.visibleLayers.has(label.layer)) continue;
            if (!label.value) continue;

            const p = worldToScreen(label.x, label.y);

            // Calculate text size in screen pixels.
            const scaledFontSize = Math.abs(label.height * state.scale);

            // Hide text that becomes too small to read.
            // This prevents labels from dominating a zoomed-out drawing.
            if (!Number.isFinite(scaledFontSize) || scaledFontSize < 3) {
                continue;
            }

            // Limit excessive text growth when zooming in.
            const fontSize = Math.min(48, scaledFontSize);

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(-(label.rotation || 0) * Math.PI / 180);

            ctx.fillStyle = layerColor(label.layer);
            ctx.font = `${fontSize}px sans-serif`;
            ctx.textAlign = "left";
            ctx.textBaseline = "alphabetic";

            ctx.fillText(String(label.value), 0, 0);

            ctx.restore();
        }


        ctx.restore();

        // Small status marker in the viewer.
        ctx.fillStyle = "#64748b";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`Zoom ${state.scale.toExponential(2)}`, 12, height - 12);
    }

    function showLayers(layers) {
        layersPanel.replaceChildren();

        if (!layers.length) {
            layersPanel.textContent = "No drawable layers found.";
            return;
        }

        for (const layer of layers) {
            const label = document.createElement("label");
            label.className = "d-flex align-items-center gap-2 mb-2";
            label.style.overflowWrap = "anywhere";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = true;
            checkbox.addEventListener("change", () => {
                if (checkbox.checked) state.visibleLayers.add(layer);
                else state.visibleLayers.delete(layer);
                render();
            });

            const swatch = document.createElement("span");
            swatch.style.cssText =
                `display:inline-block;width:12px;height:12px;flex:none;` +
                `background:${layerColor(layer)};border-radius:2px`;

            const name = document.createElement("span");
            name.textContent = layer;

            label.append(checkbox, swatch, name);
            layersPanel.appendChild(label);
        }
    }

    function showInfo(drawing) {
        infoPanel.replaceChildren();

        const rows = [
            ["File", drawing.fileName],
            ["Entities read", drawing.entityCount],
            ["Paths", drawing.paths?.length ?? 0],
            ["Circles", drawing.circles?.length ?? 0],
            ["Text labels", drawing.texts?.length ?? 0],
            ["Layers", drawing.layers?.length ?? 0],
            ["Minimum X", drawing.bounds.minX],
            ["Minimum Y", drawing.bounds.minY],
            ["Maximum X", drawing.bounds.maxX],
            ["Maximum Y", drawing.bounds.maxY]
        ];

        for (const [key, value] of rows) {
            const row = document.createElement("div");
            row.className = "mb-2";

            const heading = document.createElement("strong");
            heading.textContent = `${key}: `;

            const content = document.createElement("span");
            content.textContent = String(value ?? "");

            row.append(heading, content);
            infoPanel.appendChild(row);
        }

        const skipped = drawing.skippedEntityTypes ?? {};
        const skippedEntries = Object.entries(skipped);

        if (skippedEntries.length) {
            const warning = document.createElement("div");
            warning.className = "alert alert-warning mt-3 mb-0";
            const warningIcon = document.createElement("i");
            warningIcon.className = "bi bi-exclamation-triangle-fill";
            warningIcon.setAttribute("aria-hidden", "true");

            const warningText = document.createElement("span");
            warningText.textContent =
                "Some entity types were skipped: " +
                skippedEntries.map(([name, count]) =>
                    `${name} (${count})`
                ).join(", ");

            warning.append(warningIcon, warningText);

            infoPanel.appendChild(warning);
        }
    }

    async function importDrawing() {
        const file = fileInput.files?.[0];

        if (!file) {
            setStatus("Select a DXF file first.", "warning");
            return;
        }

        if (!file.name.toLowerCase().endsWith(".dxf")) {
            setStatus("Phase 1 supports DXF files only.", "warning");
            return;
        }

        const button = document.getElementById("loadCad");
        button.disabled = true;

        setStatus("Reading DXF file…", "info");

        try {
            const body = new FormData();
            body.append("cadFile", file, file.name);

            const token = getAntiforgeryToken();

            const response = await fetch(
                canvas.dataset.parseUrl,
                {
                    method: "POST",
                    body,
                    credentials: "same-origin",
                    headers: {
                        RequestVerificationToken: token
                    }
                }
            );

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    result.error || `Import failed (HTTP ${response.status}).`
                );
            }

            if (!result.bounds || !Array.isArray(result.paths)) {
                throw new Error("The server returned an unexpected drawing format.");
            }

            state.drawing = result;
            state.bounds = result.bounds;
            state.visibleLayers = new Set(result.layers ?? []);
            layerColors.clear();

            showLayers(result.layers ?? []);
            showInfo(result);
            fitDrawing();

            const emptyOverlay = document.getElementById("cadEmptyState");
            if (emptyOverlay) emptyOverlay.classList.add("is-hidden");

            const skippedCount = Object.values(
                result.skippedEntityTypes ?? {}
            ).reduce((sum, value) => sum + value, 0);

            setStatus(
                `Imported ${result.fileName}: ${result.entityCount} entities.` +
                (skippedCount ? ` ${skippedCount} entities were skipped.` : ""),
                skippedCount ? "warning" : "success"
            );

            // AUTO-SAVE 2D DXF DRAWING TO MONGODB
            saveDxfDrawingToMongo(result);
        } catch (error) {
            setStatus(
                error instanceof Error ? error.message : "DXF import failed.",
                "danger"
            );
        } finally {
            button.disabled = false;
        }
    }

    function zoomAt(factor, clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        const nextScale = Math.max(
            1e-12,
            Math.min(1e12, state.scale * factor)
        );

        const ratio = nextScale / state.scale;

        state.offsetX = x - (x - state.offsetX) * ratio;
        state.offsetY = y - (y - state.offsetY) * ratio;
        state.scale = nextScale;

        render();
    }

    document.getElementById("loadCad")
        .addEventListener("click", importDrawing);

    // Auto-import immediately when a file is chosen from the file picker
    fileInput.addEventListener("change", () => {
        if (fileInput.files?.length) {
            importDrawing();
        }
    });

    // Drag-and-Drop support on the Drawing Workspace
    const dropZone = document.getElementById("cadDropZone");
    if (dropZone) {
        ["dragenter", "dragover"].forEach((eventName) => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add("dragover");
            });
        });

        ["dragleave", "drop"].forEach((eventName) => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove("dragover");
            });
        });

        dropZone.addEventListener("drop", (e) => {
            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                fileInput.files = files;
                importDrawing();
            }
        });
    }

    document.getElementById("fitCad")
        .addEventListener("click", fitDrawing);

    document.getElementById("zoomInCad")
        .addEventListener("click", () => {
            const rect = canvas.getBoundingClientRect();
            zoomAt(1.25, rect.left + rect.width / 2, rect.top + rect.height / 2);
        });

    document.getElementById("zoomOutCad")
        .addEventListener("click", () => {
            const rect = canvas.getBoundingClientRect();
            zoomAt(0.8, rect.left + rect.width / 2, rect.top + rect.height / 2);
        });

    document.getElementById("resetCad")
        .addEventListener("click", fitDrawing);

    canvas.addEventListener("wheel", event => {
        event.preventDefault();
        zoomAt(event.deltaY < 0 ? 1.15 : 1 / 1.15, event.clientX, event.clientY);
    }, { passive: false });

    canvas.addEventListener("pointerdown", event => {
        state.dragging = true;
        state.lastX = event.clientX;
        state.lastY = event.clientY;
        canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener("pointermove", event => {
        if (!state.dragging) return;

        state.offsetX += event.clientX - state.lastX;
        state.offsetY += event.clientY - state.lastY;
        state.lastX = event.clientX;
        state.lastY = event.clientY;

        render();
    });

    function stopDragging() {
        state.dragging = false;
    }

    canvas.addEventListener("pointerup", stopDragging);
    canvas.addEventListener("pointercancel", stopDragging);
    canvas.addEventListener("lostpointercapture", stopDragging);

    canvas.style.touchAction = "none";

    if ("ResizeObserver" in window) {
        new ResizeObserver(resizeCanvas).observe(canvas);
    } else {
        window.addEventListener("resize", resizeCanvas);
    }

    resizeCanvas();

    function escapeHtml(str) {
        if (!str) return "";
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    /* =========================================================
       Auto-Save 2D DXF Drawing to MongoDB
       ========================================================= */
    async function saveDxfDrawingToMongo(drawingResult) {
        const projSelect = document.getElementById("cadActiveProjectId");
        const projId = projSelect ? parseInt(projSelect.value, 10) : 0;
        if (!projId || projId <= 0) return;

        try {
            const payload = {
                projectId: projId,
                fileName: drawingResult.fileName || "drawing.dxf",
                modelType: "2D_DXF",
                solidDataJson: JSON.stringify(drawingResult)
            };

            const resp = await fetch("/Survey/SaveCulvertSolid", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            // AFTER
            if (resp.ok) {
                console.info(`[CulvertCAD] 2D Drawing saved to MongoDB for Project #${projId}`);
                const statusEl = document.getElementById("cadStatus");
                if (statusEl) {
                    statusEl.innerHTML = `<span>Imported <strong>${escapeHtml(drawingResult.fileName || 'Drawing')}</strong> (${drawingResult.entityCount || 0} entities)</span> <span style="color: #3fb950; font-weight: 600; margin-left: 12px;"><i class="bi bi-cloud-check"></i> Saved to Database (Project #${projId})</span>`;
                }
            } else {
                const errData = await resp.json().catch(() => null);
                const errMsg = errData?.message || `Save failed (${resp.status})`;
                console.warn("[CulvertCAD] 2D Drawing auto-save failed:", errMsg);
                const statusEl = document.getElementById("cadStatus");
                if (statusEl) {
                    const errBadge = document.createElement("span");
                    errBadge.style.color = "#f85149";
                    errBadge.style.marginLeft = "12px";
                    errBadge.innerHTML = `<i class="bi bi-exclamation-triangle"></i> ${escapeHtml(errMsg)}`;
                    statusEl.appendChild(errBadge);
                }
            }
        } catch (err) {
            console.warn("[CulvertCAD] 2D Auto-save to MongoDB error:", err);
        }
    }

    /* =========================================================
       Recent Drawings Drawer Integration
       ========================================================= */
    const btnOpenHistory = document.getElementById("btnOpenHistory");
    const btnCloseHistory = document.getElementById("btnCloseHistory");
    const historyDrawer = document.getElementById("cadHistoryDrawer");
    const historyList = document.getElementById("cadHistoryList");
    const historySearch = document.getElementById("cadHistorySearch");

    async function fetchRecentDrawings() {
        if (!historyList) return;
        historyList.innerHTML = `
            <div class="cad-history-loading">
                <i class="bi bi-arrow-repeat spin"></i>
                <span>Loading saved drawings...</span>
            </div>
        `;

        try {
            const resp = await fetch("/api/cad/recent-models?modelType=2D_DXF");
            if (!resp.ok) throw new Error("Failed to load drawings");
            const data = await resp.json();
            const items = data.items || [];

            if (items.length === 0) {
                historyList.innerHTML = `
                    <div class="cad-history-empty">
                        <i class="bi bi-file-earmark-ruled" style="font-size:24px;"></i>
                        <span>No saved 2D drawings found yet.</span>
                    </div>
                `;
                return;
            }

            historyList.innerHTML = items.map(item => `
                <div class="cad-history-item" data-code="${(item.projectCode || '').toLowerCase()}" data-name="${(item.projectName || '').toLowerCase()}" data-file="${(item.fileName || '').toLowerCase()}">
                    <div class="cad-item-top">
                        <span class="cad-item-badge">${item.projectCode}</span>
                        <span class="cad-item-date">${new Date(item.uploadedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <h4 class="cad-item-name">${item.projectName}</h4>
                    <p class="cad-item-sub"><i class="bi bi-file-earmark-ruled"></i> ${item.fileName || '2D Drawing'}</p>
                    <div class="cad-item-footer">
                        <button type="button" class="cad-btn-load" data-project-id="${item.projectId}">
                            <i class="bi bi-box-arrow-in-down-right"></i> Load in Viewer
                        </button>
                    </div>
                </div>
            `).join("");

            historyList.querySelectorAll(".cad-btn-load").forEach(btn => {
                btn.addEventListener("click", () => loadDrawingFromDatabase(btn.dataset.projectId));
            });

        } catch (err) {
            historyList.innerHTML = `<div class="cad-history-empty"><span style="color:#f85149;">Error: ${err.message}</span></div>`;
        }
    }

    async function loadDrawingFromDatabase(projectId) {
        if (historyDrawer) {
            historyDrawer.setAttribute("hidden", "");
            historyDrawer.style.display = "none";
        }
        setStatus(`Loading 2D drawing from Project #${projectId}...`, "secondary");

        try {
            const resp = await fetch(`/Survey/GetCulvertSolid?projectId=${encodeURIComponent(projectId)}&modelType=2D_DXF`);
            if (!resp.ok) throw new Error("Could not fetch drawing data");
            const raw = await resp.text();
            const result = JSON.parse(raw);

            if (!result.bounds || !Array.isArray(result.paths)) {
                throw new Error("Invalid drawing format received.");
            }

            state.drawing = result;
            state.bounds = result.bounds;
            state.visibleLayers = new Set(result.layers ?? []);
            layerColors.clear();

            showLayers(result.layers ?? []);
            showInfo(result);
            fitDrawing();

            const emptyOverlay = document.getElementById("cadEmptyState");
            if (emptyOverlay) emptyOverlay.classList.add("is-hidden");

            setStatus(`✓ Loaded from Database: ${result.fileName || 'Drawing'} (Project #${projectId})`, "success");
        } catch (err) {
            setStatus(`Load failed: ${err.message}`, "danger");
        }
    }

    if (btnOpenHistory && historyDrawer) {
        btnOpenHistory.addEventListener("click", (e) => {
            e.preventDefault();
            historyDrawer.removeAttribute("hidden");
            historyDrawer.style.display = "flex";
            fetchRecentDrawings();
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
})();