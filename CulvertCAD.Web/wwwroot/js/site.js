// wwwroot/js/site.js
// CulvertCAD — site-wide JS helpers

document.addEventListener('DOMContentLoaded', function () {
    // Auto-dismiss alerts after 5s
    document.querySelectorAll('.alert').forEach(function (el) {
        setTimeout(function () { el.style.transition = 'opacity .4s'; el.style.opacity = '0';
            setTimeout(function(){ el.remove(); }, 400); }, 5000);
    });
});



/* =========================================================
   CulvertCAD — Responsive Sidebar
   ========================================================= */

(() => {
    const shell = document.querySelector(".app-shell");
    const sidebar = document.getElementById("app-sidebar");
    const desktopToggle = document.getElementById("sidebar-menu-toggle");
    const mobileToggle = document.getElementById("mobile-menu-toggle");

    if (!shell || !sidebar) return;

    const mobileQuery = window.matchMedia("(max-width: 767.98px)");

    function updateSidebarState() {
        const isMobile = mobileQuery.matches;
        const isMobileOpen = shell.classList.contains("sidebar-mobile-open");
        const isCollapsed = shell.classList.contains("sidebar-collapsed");

        // Sidebar button: hidden when mobile sidebar is closed.
        if (desktopToggle) {
            desktopToggle.style.display =
                isMobile && !isMobileOpen ? "none" : "inline-flex";

            desktopToggle.setAttribute(
                "aria-expanded",
                String(isMobile ? isMobileOpen : !isCollapsed)
            );

            desktopToggle.setAttribute(
                "aria-label",
                isMobile
                    ? (isMobileOpen ? "Close navigation" : "Open navigation")
                    : (isCollapsed ? "Expand sidebar" : "Collapse sidebar")
            );

            const icon = desktopToggle.querySelector("i");

            if (icon) {
                icon.className =
                    isMobile && isMobileOpen
                        ? "bi bi-x-lg"
                        : "bi bi-list";
            }
        }

        // Floating button: visible only when the mobile sidebar is closed.
        if (mobileToggle) {
            mobileToggle.style.display =
                isMobile && !isMobileOpen ? "inline-flex" : "none";

            mobileToggle.setAttribute(
                "aria-expanded",
                String(isMobileOpen)
            );

            mobileToggle.setAttribute(
                "aria-label",
                isMobileOpen ? "Close navigation" : "Open navigation"
            );

            const icon = mobileToggle.querySelector("i");

            if (icon) {
                icon.className = "bi bi-list";
            }
        }
    }

    function toggleSidebar() {
        if (mobileQuery.matches) {
            shell.classList.toggle("sidebar-mobile-open");
        } else {
            shell.classList.toggle("sidebar-collapsed");
        }

        updateSidebarState();
    }

    function closeMobileSidebar() {
        shell.classList.remove("sidebar-mobile-open");
        updateSidebarState();
    }

    desktopToggle?.addEventListener("click", toggleSidebar);

    mobileToggle?.addEventListener("click", () => {
        if (mobileQuery.matches) {
            toggleSidebar();
        }
    });

    mobileQuery.addEventListener("change", () => {
        shell.classList.remove("sidebar-mobile-open");
        updateSidebarState();
    });

    document.addEventListener("keydown", (event) => {
        if (
            event.key === "Escape" &&
            shell.classList.contains("sidebar-mobile-open")
        ) {
            closeMobileSidebar();
            mobileToggle?.focus();
        }
    });

    sidebar.querySelectorAll(".nav-item").forEach((link) => {
        link.addEventListener("click", () => {
            if (mobileQuery.matches) {
                closeMobileSidebar();
            }
        });
    });

    updateSidebarState();
})();
