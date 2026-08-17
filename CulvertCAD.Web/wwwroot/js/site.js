// wwwroot/js/site.js
// CulvertCAD — site-wide JS helpers

document.addEventListener('DOMContentLoaded', function () {
    // Auto-dismiss alerts after 5s
    document.querySelectorAll('.alert').forEach(function (el) {
        setTimeout(function () { el.style.transition = 'opacity .4s'; el.style.opacity = '0';
            setTimeout(function(){ el.remove(); }, 400); }, 5000);
    });
});
