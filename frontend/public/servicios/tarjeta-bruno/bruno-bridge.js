/* Integración BRUNO: regreso al origen y enlaces internos del mismo sitio (web, móvil y Capacitor). Sin cambios visuales. */
(function () {
  var from = new URLSearchParams(location.search).get('from');
  var back = function () {
    if (from && /^\/[^\/\\]/.test(from)) { location.assign(from); return; }
    if (history.length > 1) { history.back(); return; }
    location.assign('/');
  };
  var local = location.hostname !== 'brunocard.com' && location.hostname !== 'www.brunocard.com';
  var navBrand = document.querySelector('nav a.brand');
  if (navBrand) {
    navBrand.addEventListener('click', function (e) { e.preventDefault(); back(); });
    navBrand.setAttribute('aria-label', 'BRUNO · volver');
    navBrand.setAttribute('data-testid', 'service-nav-back');
  }
  document.querySelectorAll('a[href]').forEach(function (a) {
    var h = a.getAttribute('href') || '';
    if (h === 'https://brunocard.com' || h === 'https://brunocard.com/') {
      a.addEventListener('click', function (e) { e.preventDefault(); back(); });
      a.setAttribute('aria-label', (a.getAttribute('aria-label') || 'BRUNO') + ' · volver');
      return;
    }
    if (h.indexOf('https://brunocard.com/') === 0 && local) {
      a.addEventListener('click', function (e) { e.preventDefault(); location.assign(h.replace('https://brunocard.com', '')); });
    }
  });
})();
