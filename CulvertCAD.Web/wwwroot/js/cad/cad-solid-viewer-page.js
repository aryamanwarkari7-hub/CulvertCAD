
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

    fileInput.addEventListener("change", () => {

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

            // Create a temporary URL for the selected HTML file.
            currentObjectUrl = URL.createObjectURL(file);

            frame.setAttribute("src", currentObjectUrl);

            showPreview();

            clearButton.disabled = false;
            updateFullscreenButton();


            status.textContent =
                `Previewing: ${file.name}. ` +
                "The preview is sandboxed. Relative local assets " +
                "may not load unless packaged appropriately.";

        } catch (error) {

            console.error("HTML preview failed:", error);

            clearPreview(
                `Could not open HTML preview: ${error.message}`
            );
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
