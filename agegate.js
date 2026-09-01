/* Maxence Peptides — vérification de majorité + création de compte (côté client).
   S'exécute depuis <head>. Un nouveau visiteur doit confirmer être majeur (18 ans,
   majorité légale en France) ET créer un compte local (prénom + e-mail) avant
   d'entrer ; le compte est mémorisé dans localStorage ("mxp_account") et joint à
   chaque commande. Un visiteur déjà inscrit sur cet appareil ne revoit pas l'écran.

   NOTE : filtre côté client (capture de contact + friction), pas une authentification
   forte. Il n'y a pas de serveur : contournable, non partagé entre appareils. C'est
   volontairement une surcouche (le contenu reste dans le DOM), donc l'indexation par
   les moteurs de recherche n'est pas bloquée. Aucun cookie n'est déposé. */
(function () {
  function getAccount() {
    try { return JSON.parse(localStorage.getItem('mxp_account') || 'null'); } catch (e) { return null; }
  }

  function mount() {
    if (getAccount()) return;
    if (document.getElementById('mxp-agegate')) return;
    var wrap = document.createElement('div');
    wrap.id = 'mxp-agegate';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-label', 'Vérification de majorité et compte');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(20,28,36,.88);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);font-family:Inter,system-ui,-apple-system,sans-serif;overflow:auto';
    var fld = 'width:100%;padding:13px 14px;border:1px solid #DCD6C9;border-radius:10px;font:inherit;font-size:15px;color:#1F2A33;background:#fff;box-sizing:border-box;margin-bottom:10px';
    wrap.innerHTML =
      '<div style="max-width:440px;width:100%;background:#F6F3EC;border-radius:20px;padding:34px 32px;text-align:center;box-shadow:0 40px 90px -30px rgba(0,0,0,.6);border:1px solid #DCD6C9">' +
        '<img src="assets/logo_mark.png" alt="Maxence Peptides" style="height:56px;width:56px;margin:0 auto 14px;display:block"/>' +
        '<p style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#3B5661;margin:0 0 8px;font-weight:600">Majorité &amp; compte</p>' +
        '<h2 style="font-family:\'Cormorant Garamond\',Georgia,serif;font-weight:600;font-size:27px;line-height:1.2;color:#1F2A33;margin:0 0 10px">Bienvenue, faisons les présentations</h2>' +
        '<p style="font-size:14px;line-height:1.55;color:#55606A;margin:0 0 20px">Ce site est réservé aux personnes majeures. Créez votre compte local pour parcourir la boutique et tester la démo de commande. Produits destinés à la recherche in vitro, non à la consommation humaine.</p>' +
        '<form id="mxp-ag-form" style="text-align:left" novalidate>' +
          '<input id="mxp-ag-name" type="text" autocomplete="given-name" placeholder="Prénom" style="' + fld + '"/>' +
          '<input id="mxp-ag-email" type="email" autocomplete="email" placeholder="Adresse e-mail" style="' + fld + '"/>' +
          '<label style="display:flex;gap:9px;align-items:flex-start;font-size:13px;color:#55606A;line-height:1.4;margin:4px 0 14px;cursor:pointer">' +
            '<input id="mxp-ag-18" type="checkbox" style="margin-top:2px;width:16px;height:16px;flex:none;accent-color:#1F2A33"/>' +
            '<span>Je confirme avoir <b>18 ans ou plus</b> et j’accepte les <a href="/cgv" style="color:#9C6248">CGV</a> et l’<a href="/avertissement" style="color:#9C6248">avertissement</a>.</span>' +
          '</label>' +
          '<p id="mxp-ag-err" role="alert" style="display:none;color:#B23A3A;font-size:12.5px;margin:0 0 12px;text-align:center"></p>' +
          '<button type="submit" style="width:100%;padding:15px;border:none;border-radius:100px;background:#1F2A33;color:#F6F3EC;font:inherit;font-size:15px;font-weight:600;cursor:pointer;margin-bottom:10px">Créer mon compte et entrer</button>' +
        '</form>' +
        '<button id="mxp-ag-no" type="button" style="width:100%;padding:11px;border:none;background:transparent;color:#7A858E;font:inherit;font-size:13.5px;cursor:pointer">Non, je préfère quitter</button>' +
        '<p style="font-size:11px;color:#7A858E;margin:14px 0 0;line-height:1.5">En mode démo, votre e-mail reste dans ce navigateur et aucune commande n’est enregistrée. Aucun cookie, aucune publicité.</p>' +
      '</div>';
    var root = document.documentElement;
    root.appendChild(wrap);
    root.style.overflow = 'hidden';

    function showErr(msg, focusId) {
      var el = document.getElementById('mxp-ag-err');
      if (el) { el.textContent = msg; el.style.display = 'block'; }
      var f = document.getElementById(focusId); if (f) { try { f.focus(); } catch (e) {} }
    }
    document.getElementById('mxp-ag-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = (document.getElementById('mxp-ag-name').value || '').trim();
      var email = (document.getElementById('mxp-ag-email').value || '').trim();
      var ok = document.getElementById('mxp-ag-18').checked;
      if (!name) return showErr('Merci d’indiquer votre prénom.', 'mxp-ag-name');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return showErr('Merci d’indiquer une adresse e-mail valide.', 'mxp-ag-email');
      if (!ok) return showErr('Vous devez confirmer être majeur pour continuer.', 'mxp-ag-18');
      var stamp = ''; try { stamp = new Date().toISOString(); } catch (e2) {}
      try {
        localStorage.setItem('mxp_account', JSON.stringify({ name: name, email: email, age_ok: true, createdAt: stamp }));
        localStorage.setItem('mxp_age_ok', '1');
      } catch (e3) {}
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      root.style.overflow = '';
      if (typeof window.mxpOnSignIn === 'function') { try { window.mxpOnSignIn(); } catch (e4) {} }
    });
    document.getElementById('mxp-ag-no').onclick = function () { window.location.href = 'https://www.google.fr'; };
  }

  window.mxpShowGate = mount;
  window.mxpAccount = getAccount;

  if (document.documentElement) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
