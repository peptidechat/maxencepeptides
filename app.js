/* Maxence Peptides — couche données de la boutique (vanilla, sans build).
   Grille boutique depuis catalog.json + panier localStorage + tunnel de commande
   (livraison France / Oise, paiement crypto, virement SEPA, PayPal optionnel). */
const CART_KEY = "mxp_cart";
const $ = (s, r = document) => r.querySelector(s);
const NBSP = " ";
const fmt = (n) => Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + NBSP + "€";
const fmtMinor = (n) => (Number(n) / 100).toLocaleString("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}) + NBSP + "€";

async function loadCatalog() {
  const res = await fetch("catalog-public.json", { cache: "no-store" });
  if (!res.ok) throw new Error("catalogue public indisponible");
  return (await res.json()).products;
}
let _supplierCatalogPromise = null;
async function loadSupplierCatalog() {
  const endpoint = CFG.SUPPLIER_CATALOG_ENDPOINT;
  if (!endpoint) return null;
  if (!_supplierCatalogPromise) {
    _supplierCatalogPromise = fetch(endpoint, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    }).then(async response => {
      if (!response.ok) throw new Error("projection fournisseur indisponible");
      const payload = await response.json();
      const expires = Date.parse(payload.expires_at || "");
      if (payload.commerce_state !== "price_preview" || payload.currency !== "EUR" ||
          !Array.isArray(payload.products) || !Number.isFinite(expires) || expires <= Date.now()) {
        throw new Error("projection fournisseur invalide");
      }
      return payload;
    }).catch(() => null);
  }
  return _supplierCatalogPromise;
}
function supplierProduct(catalog, slug) {
  return catalog && catalog.products.find(product => product.slug === slug);
}
function pricedOffers(product) {
  return product ? product.offers.filter(offer =>
    offer.availability === "supplier_offer_available" &&
    Number.isInteger(offer.price_minor) && offer.price_minor > 0
  ) : [];
}
function offerCanEnterCart(offer) {
  if (!offer || offer.availability !== "supplier_offer_available" ||
      !Number.isInteger(offer.price_minor) || offer.price_minor <= 0) return false;
  return DEMO_MODE || offer.purchasable === true;
}
function getCart() { try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; } }
function setCart(c) { localStorage.setItem(CART_KEY, JSON.stringify(c)); updateCartCount(); }
function getAccount() { try { return JSON.parse(localStorage.getItem("mxp_account") || "null"); } catch (e) { return null; } }
function updateCartCount() {
  const n = getCart().reduce((a, i) => a + i.qty, 0);
  document.querySelectorAll("[data-cart-count]").forEach(e => { e.textContent = n; e.style.display = n ? "inline-flex" : "none"; });
}

/* ---------- grille boutique ---------- */
const CAT_ORDER = ["Métabolisme", "Récupération", "Longévité", "Beauté"];
async function renderShop() {
  const grid = $("#shop-grid"); if (!grid) return;
  let products = [], supplier = null;
  try {
    [products, supplier] = await Promise.all([loadCatalog(), loadSupplierCatalog()]);
  } catch (e) {
    grid.innerHTML = `<p class="loading">Le catalogue est momentanément indisponible. Écrivez-nous ou appelez-nous, nous vous répondons rapidement.</p>`; return;
  }
  const cats = CAT_ORDER.filter(c => products.some(p => p.category === c))
    .concat([...new Set(products.map(p => p.category))].filter(c => !CAT_ORDER.includes(c)));
  grid.innerHTML = cats.map(cat => `
    <div class="shop-cat" id="cat-${catKey(cat, products)}">
      <div class="shop-cat-head"><h2 class="section-title">${cat}</h2>
        <span class="shop-cat-count">${products.filter(p => p.category === cat).length} références en validation</span></div>
      <div class="prod-grid">
        ${products.filter(p => p.category === cat).map(p => card(p, supplier)).join("")}
      </div>
    </div>`).join("");
  if (location.hash) {
    const target = document.getElementById(location.hash.slice(1));
    if (target) requestAnimationFrame(() => target.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
}
function catKey(cat, products) { const p = products.find(x => x.category === cat); return (p && p.category_key) || cat; }
function card(p, supplier) {
  const offers = pricedOffers(supplierProduct(supplier, p.slug));
  const commerce = offers.length
    ? `<span class="pc-from">kit dès ${fmtMinor(Math.min(...offers.map(o => o.price_minor)))}<span class="pc-single">${DEMO_MODE ? "prix fournisseur · démo disponible" : "prix indicatif"}</span></span>`
    : `<span class="pc-from">Prix et disponibilité en validation</span>`;
  const coa = `<span class="card-coa pending">Données de lot Maxence non publiées</span>`;
  return `<a class="prod-card" href="/${p.slug}">
    <div class="pc-thumb"><img src="assets/vial.jpg?v=4" alt="" loading="lazy"/></div>
    <div class="pc-body">
      <span class="pc-cat2">${p.category}</span>
      <h3>${p.name}</h3>
      <p class="pc-blurb">${p.blurb || ""}</p>
      <div class="pc-foot">${commerce}${coa}</div>
    </div></a>`;
}

/* ---------- panier + commande ---------- */
const ORDERS_KEY = "mxp_orders";
const CFG = (typeof window !== "undefined" && window.MXP_CONFIG) || {};
const STORE_ENABLED = CFG.STORE_ENABLED === true;
const DEMO_MODE = CFG.DEMO_MODE === true;
let BTC_EUR = CFG.BTC_EUR || 88000;

function hasOrderReceiver() {
  return Boolean(CFG.ORDER_ENDPOINT || (typeof window !== "undefined" && window.MXP_ORDER_ENDPOINT));
}

let _ppLoading = null;
function loadPaypalSdk() {
  if (typeof window !== "undefined" && window.paypal) return Promise.resolve();
  if (_ppLoading) return _ppLoading;
  _ppLoading = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://www.paypal.com/sdk/js?client-id=" + encodeURIComponent(CFG.PAYPAL_CLIENT_ID) +
            "&currency=" + (CFG.PAYPAL_CURRENCY || "EUR") + "&components=buttons&intent=capture";
    s.onload = res; s.onerror = rej; document.head.appendChild(s);
  });
  return _ppLoading;
}

/* A checkout is successful only after the authoritative order API accepts it. */
async function submitOrder(order) {
  const ep = CFG.ORDER_ENDPOINT || (typeof window !== "undefined" && window.MXP_ORDER_ENDPOINT);
  if (!ep) return false;
  try {
    const response = await fetch(ep, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(order),
    });
    if (!response.ok) return null;
    const receipt = await response.json();
    return receipt && receipt.data ? receipt.data : null;
  } catch (e) {
    return false;
  }
}

const DELIVERY = {
  standard: { label: "Colissimo suivi", note: "48 à 72 h · discret · France métropolitaine", fee: 6.9, min: 0 },
  express:  { label: "Chronopost 24 h", note: "commande avant 14 h · livré le lendemain", fee: 12.9, min: 0 },
  local:    { label: "Livraison locale le jour même", note: "Oise, à 30 km de Pont-Sainte-Maxence · avant 14 h", fee: 19.9, min: 400 },
  pickup:   { label: "Retrait en main propre", note: "Pont-Sainte-Maxence · sur rendez-vous", fee: 0, min: 0 },
};
const FREE_SHIP_MIN = 60; // Colissimo offert à partir de ce montant

function lineLabel(i) {
  if (i.format === "managed" || i.format === "nasal-managed")
    return "Formule accompagnée · facturée chaque mois · sans engagement";
  if (i.format === "single") return `${i.dose} · flacon unitaire`;
  const fmtName = i.format === "nasal" ? "Spray intranasal" : "Kit de 10 flacons";
  return `${i.dose} · ${fmtName}${i.sub ? " · Abonnement" : ""}`;
}
function lineThumb(i) {
  if (i.format === "managed") return "assets/pen.jpg";
  if (i.format === "nasal" || i.format === "nasal-managed") return "assets/nasal.jpg";
  return "assets/vial.jpg?v=4";
}

async function renderCart() {
  const root = document.getElementById("cart-root");
  if (!root) return;
  if (!STORE_ENABLED || !hasOrderReceiver()) {
    root.innerHTML = `<div class="co-empty">
      <h2 class="section-title">Commandes temporairement indisponibles.</h2>
      <p class="lede">Nous validons les prix, les lots et le stock avant d’ouvrir la commande en ligne. Aucun paiement ni aucune réservation ne peut être effectué sur ce site pour le moment.</p>
      <a href="/boutique" class="btn-ghost">Consulter le catalogue</a></div>`;
    return;
  }
  if (!DEMO_MODE) {
    root.innerHTML = `<div class="co-empty">
      <h2 class="section-title">Commandes temporairement indisponibles.</h2>
      <p class="lede">Le paiement réel reste fermé tant que les offres ne sont pas publiées comme achetables.</p>
      <a href="/boutique" class="btn-ghost">Consulter le catalogue</a></div>`;
    return;
  }
  const currentSupplier = await loadSupplierCatalog();
  if (!currentSupplier) {
    root.innerHTML = `<div class="co-empty"><h2 class="section-title">Démo momentanément indisponible.</h2>
      <p class="lede">La source tarifaire TitrateLab n’a pas pu être revalidée. Aucun prix mémorisé n’est utilisé.</p></div>`;
    return;
  }
  const before = getCart();
  const validated = before.flatMap(item => {
    const product = supplierProduct(currentSupplier, item.slug);
    const offer = product && product.offers.find(candidate =>
      candidate.dose === item.dose && candidate.package === item.package);
    if (!offerCanEnterCart(offer)) return [];
    return [{ ...item, name: product.name, price: offer.price_minor / 100,
      priceMinor: offer.price_minor, containedUnits: offer.contained_units }];
  });
  const cartWasUpdated = JSON.stringify(before) !== JSON.stringify(validated);
  if (cartWasUpdated) setCart(validated);
  let state = { step: "cart", delivery: "standard", method: "btc", details: {}, order: null };

  try {
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur")
      .then(r => r.json()).then(d => { if (d && d.bitcoin && d.bitcoin.eur) { BTC_EUR = d.bitcoin.eur; if (state.step === "pay" && state.method === "btc") paint(); } }).catch(() => {});
  } catch (e) {}

  function renderPaypalButtons(eur) {
    if (!CFG.PAYPAL_CLIENT_ID || !document.getElementById("paypal-buttons")) return;
    loadPaypalSdk().then(() => {
      const mount = document.getElementById("paypal-buttons");
      if (!window.paypal || !mount) return;
      mount.innerHTML = "";
      window.paypal.Buttons({
        style: { shape: "pill", color: "gold", label: "pay", height: 48 },
        createOrder: (data, actions) => actions.order.create({
          purchase_units: [{ amount: { value: eur.toFixed(2), currency_code: CFG.PAYPAL_CURRENCY || "EUR" }, description: "Commande Maxence Peptides" }],
        }),
        onApprove: (data, actions) => actions.order.capture().then(det => reserve({ captureId: det.id, payer: (det.payer && det.payer.email_address) || "" })),
        onError: () => { const n = document.getElementById("pp-err"); if (n) n.textContent = "Le paiement n’a pas abouti. Réessayez ou choisissez un autre moyen de paiement."; },
      }).render("#paypal-buttons").catch(() => {});
    }).catch(() => { const n = document.getElementById("pp-err"); if (n) n.textContent = "Impossible de charger PayPal. Vérifiez votre connexion ou choisissez un autre moyen de paiement."; });
  }

  function subtotal() { return getCart().reduce((a, i) => a + i.price * i.qty, 0); }
  function ensureDelivery() { if (!DELIVERY[state.delivery] || subtotal() < DELIVERY[state.delivery].min) state.delivery = "standard"; }
  function fee() {
    ensureDelivery();
    if (state.delivery === "standard") return subtotal() >= FREE_SHIP_MIN ? 0 : DELIVERY.standard.fee;
    return DELIVERY[state.delivery].fee;
  }
  function discount() { return state.method === "btc" && CFG.CRYPTO_DISCOUNT_PCT ? Math.round(subtotal() * CFG.CRYPTO_DISCOUNT_PCT) / 100 : 0; }
  function total() { return getCart().length ? Math.round((subtotal() + fee() - (state.step === "pay" ? discount() : 0)) * 100) / 100 : 0; }

  function setStepUI() {
    const order = ["cart", "details", "pay", "done"];
    document.querySelectorAll("#co-steps li").forEach(li => {
      const idx = order.indexOf(li.dataset.step), cur = order.indexOf(state.step);
      li.classList.toggle("on", idx === cur);
      li.classList.toggle("done", idx < cur);
    });
  }

  function paint() {
    setStepUI();
    const cart = getCart();
    if (state.step === "cart") {
      if (!cart.length) {
        root.innerHTML = `<div class="co-empty">
          <h2 class="section-title">Votre panier est vide.</h2>
          <p class="lede">Trouvez de quoi travailler, vérifié lot par lot.</p>
          <a href="/boutique" class="btn-solid">Parcourir la boutique</a></div>`;
        return;
      }
      root.innerHTML = `
        <p class="co-preview"><b>Démo uniquement.</b> Les prix sont revalidés auprès de TitrateLab. Aucun paiement, stock ou envoi réel ne sera déclenché.${cartWasUpdated ? " Le panier a été actualisé avec les prix courants." : ""}</p>
        <div class="co-grid">
          <div class="co-lines">
            ${cart.map(i => `
              <div class="co-line" data-id="${i.id}">
                <div class="co-thumb"><img src="${lineThumb(i)}" alt=""/></div>
                <div class="co-meta"><h3>${i.name}</h3><span>${lineLabel(i)}</span></div>
                <div class="co-qty">
                  <button data-act="dec" aria-label="Moins">−</button><b>${i.qty}</b><button data-act="inc" aria-label="Plus">+</button>
                </div>
                <div class="co-price">${fmt(i.price * i.qty)}</div>
                <button class="co-rm" data-act="rm" title="Retirer">×</button>
              </div>`).join("")}
          </div>
          ${summaryCard("Continuer vers la livraison", "go-details")}
        </div>`;
    } else if (state.step === "details") {
      const d = state.details; const acct = getAccount() || {};
      root.innerHTML = `
        <div class="co-grid">
          <form class="co-form" id="co-form">
            <h2 class="co-h">Adresse fictive pour la démo</h2>
            <div class="co-2"><label>Prénom<input name="first" value="${d.first||acct.name||""}" required></label>
              <label>Nom<input name="last" value="${d.last||""}" required></label></div>
            <label>E-mail<input name="email" type="email" value="${d.email||acct.email||""}" required></label>
            <label>Téléphone<input name="phone" type="tel" value="${d.phone||""}" required></label>
            <label>Adresse<input name="addr" value="${d.addr||""}" required></label>
            <div class="co-2"><label>Code postal<input name="zip" value="${d.zip||""}" inputmode="numeric" pattern="[0-9]{5}" required></label>
              <label>Ville<input name="city" value="${d.city||"Pont-Sainte-Maxence"}" required></label></div>
            <p class="co-trust">Démo sans persistance serveur : utilisez des coordonnées fictives. Aucun colis ne sera envoyé.</p>
            <div class="co-actions"><button type="button" class="btn-ghost" data-act="back-cart">← Retour au panier</button>
              <button type="submit" class="btn-solid">Continuer vers le paiement</button></div>
          </form>
          ${summaryCard(null, null)}
        </div>`;
    } else if (state.step === "pay") {
      const eur = total();
      const COINS = {
        btc:  { label: "Bitcoin", sym: "BTC", addr: CFG.BTC_ADDRESS || "", net: "Bitcoin",
                live: !!CFG.BTC_ADDRESS, amt: (eur / BTC_EUR).toFixed(6),
                uri: a => `bitcoin:${a}?amount=${(eur / BTC_EUR).toFixed(6)}` },
        usdc: { label: "USDC", sym: "USDC", addr: CFG.EVM_ADDRESS || "", net: "Ethereum (ERC-20)",
                live: !!CFG.EVM_ADDRESS, amt: (eur * 1.08).toFixed(2), uri: a => a },
        usdt: { label: "USDT", sym: "USDT", addr: CFG.EVM_ADDRESS || "", net: "Ethereum (ERC-20)",
                live: !!CFG.EVM_ADDRESS, amt: (eur * 1.08).toFixed(2), uri: a => a },
        sepa: { label: "Virement SEPA", sym: "EUR", addr: CFG.SEPA_IBAN || "", net: "SEPA",
                live: !!CFG.SEPA_IBAN, amt: eur.toFixed(2), uri: a => a },
      };
      const methods = DEMO_MODE ? ["btc"] : ["btc", "usdc", "usdt", "sepa"].concat(CFG.PAYPAL_CLIENT_ID ? ["paypal"] : []);
      if (!methods.includes(state.method)) state.method = "btc";
      const coin = COINS[state.method] || { label: "PayPal", sym: "EUR", addr: "", net: "PayPal", live: true, amt: eur.toFixed(2), uri: a => a };
      state._pay = { eur, method: state.method, coin: coin.sym, amt: coin.amt, addr: coin.addr, net: coin.net };
      const labels = { btc: `Bitcoin${CFG.CRYPTO_DISCOUNT_PCT ? ` <small>−${CFG.CRYPTO_DISCOUNT_PCT}${NBSP}%</small>` : ""}`, usdc: "USDC", usdt: "USDT", sepa: "Virement", paypal: "PayPal / CB" };
      const tabs = `<div class="pay-tabs">` +
        methods.map(k => `<button type="button" class="pay-tab ${state.method===k?"on":""}" data-method="${k}">${labels[k]}</button>`).join("") + `</div>`;
      let panel;
      if (DEMO_MODE) {
        panel = `<div class="pay-panel">
          <p class="co-paysub"><b>Simulation Bitcoin.</b> Le montant indicatif est <b>${coin.amt} BTC</b> (${fmt(eur)}). Aucune adresse, aucun QR code et aucune transaction réelle ne sont fournis.</p>
          <div class="co-iban">
            <div class="co-payrow"><span>Mode</span><b>Bitcoin · démonstration</b></div>
            <div class="co-payrow"><span>Montant simulé</span><b class="co-btc">${coin.amt} BTC</b></div>
            <div class="co-payrow"><span>Paiement réel</span><b>Désactivé</b></div>
          </div>
          <button type="button" class="btn-solid" data-act="reserve">Simuler la validation de la commande</button>
        </div>`;
      } else if (state.method === "paypal") {
        panel = `<div class="pay-panel">
          <p class="co-paysub">Payez <b>${fmt(eur)}</b> par PayPal ou par carte bancaire. Votre commande est confirmée dès validation du paiement.</p>
          <div id="paypal-buttons"></div><p id="pp-err" class="co-paynote"></p>
        </div>`;
      } else if (state.method === "sepa") {
        panel = `<div class="pay-panel">
          <p class="co-paysub">Réglez <b>${fmt(eur)}</b> par virement SEPA depuis votre banque. Votre commande est réservée 48${NBSP}h ; nous expédions dès réception des fonds (un jour ouvré en général, instantané si votre banque le propose).</p>
          <div class="co-iban">
            <div class="co-payrow"><span>Titulaire</span><b>${coin.live ? (CFG.SEPA_HOLDER || CFG.BRAND) : "—"}</b></div>
            <div class="co-payrow"><span>IBAN</span><code>${coin.live ? CFG.SEPA_IBAN : "—"}</code></div>
            <div class="co-payrow"><span>BIC</span><b>${coin.live ? (CFG.SEPA_BIC || "—") : "—"}</b></div>
            <div class="co-payrow"><span>Montant</span><b class="co-btc">${fmt(eur)}</b></div>
            <div class="co-payrow"><span>Référence à indiquer</span><b id="sepa-ref">votre numéro de commande (affiché à l’étape suivante)</b></div>
            ${coin.live ? "" : `<p class="co-preview"><b>Mode aperçu.</b> Renseignez SEPA_IBAN dans config.js pour activer le virement.</p>`}
          </div>
          <button type="button" class="btn-solid" data-act="reserve">Réserver ma commande, je fais le virement</button>
        </div>`;
      } else {
        const qr = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=0&data=${encodeURIComponent(coin.uri(coin.addr))}`;
        panel = `<div class="pay-panel">
          <p class="co-paysub">Payez en <b>${coin.label}</b>${state.method === "btc" && discount() ? ` (remise de ${fmt(discount())} appliquée)` : ""}, soit ${fmt(eur)}. Votre commande est réservée dès que la transaction apparaît sur la chaîne. Discret, sans intermédiaire.</p>
          <div class="co-paygrid">
            <div class="co-qr"><img src="${qr}" alt="QR code de paiement ${coin.label}" width="180" height="180"/></div>
            <div class="co-paydet">
              <div class="co-payrow"><span>Envoyez exactement</span><b class="co-btc">${coin.amt} ${coin.sym}</b></div>
              <div class="co-payrow"><span>Réseau</span><b>${coin.net}</b></div>
              <div class="co-payaddr"><span>À l’adresse</span><code>${coin.addr || "—"}</code></div>
              ${ coin.live
                ? `<p class="co-paynote">Envoyez du <b>${coin.sym}</b> sur le réseau <b>${coin.net}</b> uniquement : un transfert sur le mauvais réseau ne peut pas être récupéré. Puis réservez ci-dessous.</p>`
                : `<p class="co-preview"><b>Mode aperçu.</b> Renseignez ${state.method==="btc" ? "BTC_ADDRESS" : "EVM_ADDRESS"} dans config.js pour activer ce paiement.</p>` }
            </div>
          </div>
          <button type="button" class="btn-solid" data-act="reserve">J’ai envoyé le paiement, réserver ma commande</button>
        </div>`;
      }
      root.innerHTML = `
        <div class="co-grid">
          <div class="co-pay">
            <h2 class="co-h">Paiement</h2>
            ${tabs}${panel}
            <div class="co-actions"><button type="button" class="btn-ghost" data-act="back-details">← Retour à la livraison</button></div>
          </div>
          ${summaryCard(null, null)}
        </div>`;
    } else if (state.step === "done") {
      const o = state.order;
      const how = o.demo
        ? `Aucun paiement, aucune réservation de stock et aucun envoi n’ont été effectués.`
        : o.method === "sepa"
        ? `Indiquez la référence <b>${o.id}</b> dans le libellé de votre virement de <b>${fmt(o.total)}</b>. Nous expédions dès réception.`
        : o.method === "paypal" ? `Paiement reçu. Merci${NBSP}!`
        : `Envoyez <b>${o.cryptoAmount} ${o.coin}</b> sur le réseau ${o.network} si ce n’est pas déjà fait ; nous confirmons sur la chaîne.`;
      root.innerHTML = `
        <div class="co-done">
          <div class="co-check">✓</div>
          <h2 class="section-title">Démo validée.</h2>
          <p class="lede">Le serveur a revalidé les articles et les prix de la simulation <b>${o.id}</b>. ${how}</p>
          <div class="co-donecard">
            ${o.items.map(i => `<div class="co-doneline"><span>${i.name} · ${lineLabel(i)} ×${i.qty}</span><b>${fmt(i.price*i.qty)}</b></div>`).join("")}
            <div class="co-doneline"><span>${DELIVERY[o.delivery].label}</span><b>${o.fee ? fmt(o.fee) : "Offert"}</b></div>
            ${o.discount ? `<div class="co-doneline"><span>Remise Bitcoin</span><b>−${fmt(o.discount)}</b></div>` : ""}
            <div class="co-doneline total"><span>${o.demo ? "Total simulé en " + o.coin : "Total " + (o.method === "sepa" ? "par virement" : o.method === "paypal" ? "PayPal" : "en " + o.coin)}</span><b>${fmt(o.total)}${o.cryptoAmount && o.method !== "sepa" && o.method !== "paypal" ? " · " + o.cryptoAmount + " " + o.coin : ""}</b></div>
          </div>
          <a href="/boutique" class="btn-ghost">Continuer mes achats</a>
        </div>`;
    }
    wire();
    if (state.step === "pay" && state.method === "paypal" && CFG.PAYPAL_CLIENT_ID) renderPaypalButtons(state._pay.eur);
  }

  function summaryCard(ctaLabel, ctaAct) {
    ensureDelivery();
    const sub = subtotal();
    const d = DELIVERY[state.delivery];
    const feeOf = (k) => k === "standard" ? (sub >= FREE_SHIP_MIN ? "Offert" : fmt(DELIVERY.standard.fee)) : (DELIVERY[k].fee ? fmt(DELIVERY[k].fee) : "Gratuit");
    const opts = Object.entries(DELIVERY).map(([k, v]) => {
      const elig = sub >= v.min;
      if (!elig) {
        return `<label class="co-delv locked">
          <span class="co-delv-main"><b>${v.label}</b><em>Ajoutez ${fmt(v.min - sub)} pour débloquer</em></span>
          <span class="co-delv-fee">${feeOf(k)}</span></label>`;
      }
      return `<label class="co-delv ${state.delivery === k ? "on" : ""}">
        <input type="radio" name="delv" value="${k}" ${state.delivery === k ? "checked" : ""}>
        <span class="co-delv-main"><b>${v.label}</b><em>${v.note}</em></span>
        <span class="co-delv-fee">${feeOf(k)}</span></label>`;
    }).join("");
    const disc = state.step === "pay" ? discount() : 0;
    return `<aside class="co-summary">
      <h3>Récapitulatif</h3>
      <div class="co-sumrow"><span>Sous-total</span><b>${fmt(sub)}</b></div>
      ${state.step !== "cart" ? `<div class="co-sumrow"><span>${d.label}</span><b>${fee() ? fmt(fee()) : "Offert"}</b></div>` : ""}
      ${disc ? `<div class="co-sumrow"><span>Remise Bitcoin</span><b>−${fmt(disc)}</b></div>` : ""}
      ${state.step === "cart" ? `<div class="co-delv-wrap">${opts}</div>` : ""}
      <div class="co-sumrow total"><span>Total</span><b>${fmt(total())}</b></div>
      <p class="co-est">${DEMO_MODE ? "Bitcoin sélectionné par défaut · simulation sans paiement" : `Bitcoin · USDC · USDT · virement SEPA${CFG.PAYPAL_CLIENT_ID ? " · PayPal" : ""}`}</p>
      ${ctaLabel ? `<button class="btn-solid full" data-act="${ctaAct}">${ctaLabel}</button>` : ""}
      <p class="co-deliverhint">Colissimo offert dès ${fmt(FREE_SHIP_MIN)} · livraison locale le jour même dans l’Oise dès ${fmt(DELIVERY.local.min)}.</p>
    </aside>`;
  }

  function wire() {
    root.querySelectorAll("[data-act]").forEach(el => {
      el.onclick = (e) => {
        const act = el.dataset.act;
        const line = el.closest(".co-line");
        if (act === "inc" || act === "dec" || act === "rm") {
          const cart = getCart(); const it = cart.find(i => i.id === line.dataset.id);
          if (!it) return;
          if (act === "inc") it.qty++;
          if (act === "dec") it.qty = Math.max(1, it.qty - 1);
          let next = act === "rm" ? cart.filter(i => i.id !== line.dataset.id) : cart;
          setCart(next); paint();
        }
        if (act === "go-details") {
          if (!getCart().length) return;
          if (!getAccount()) { if (window.mxpShowGate) window.mxpShowGate(); return; }
          state.step = "details"; paint();
        }
        if (act === "back-cart") { state.step = "cart"; paint(); }
        if (act === "back-details") { state.step = "details"; paint(); }
        if (act === "reserve") reserve();
      };
    });
    root.querySelectorAll('input[name="delv"]').forEach(r => r.onchange = () => { state.delivery = r.value; paint(); });
    root.querySelectorAll(".pay-tab").forEach(t => t.onclick = () => { state.method = t.dataset.method; paint(); });
    const form = document.getElementById("co-form");
    if (form) form.onsubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      state.details = Object.fromEntries(fd.entries());
      state.step = "pay"; paint();
    };
  }

  async function reserve(payinfo) {
    payinfo = payinfo || {};
    if (!STORE_ENABLED || !hasOrderReceiver()) return;
    if (!getAccount()) { if (window.mxpShowGate) window.mxpShowGate(); return; }
    const cart = getCart();
    const id = "MXP-" + Math.abs(hash(JSON.stringify(cart) + Object.values(state.details).join("") + state._pay.method + (payinfo.captureId || ""))).toString(36).toUpperCase().slice(0, 6);
    let placedAt = ""; try { placedAt = new Date().toISOString(); } catch (e) {}
    const order = {
      mode: DEMO_MODE ? "demo" : "live",
      id, status: payinfo.captureId ? "paid" : "awaiting_payment", items: cart, details: state.details,
      delivery: state.delivery, fee: fee(), discount: discount(), total: state._pay.eur, method: state._pay.method,
      coin: state._pay.coin, cryptoAmount: state._pay.amt, address: state._pay.addr, network: state._pay.net,
      account: getAccount(), placedAt, captureId: payinfo.captureId || "",
    };
    const accepted = await submitOrder(order);
    if (!accepted) {
      const panel = root.querySelector(".co-pay");
      if (panel) {
        let notice = document.getElementById("co-order-error");
        if (!notice) {
          notice = document.createElement("p");
          notice.id = "co-order-error";
          notice.className = "co-preview";
          panel.prepend(notice);
        }
        notice.textContent = "La commande n’a pas été enregistrée. Aucun succès n’est affiché et votre panier est conservé. Réessayez plus tard.";
      }
      return;
    }
    if (accepted.order_ref) order.id = accepted.order_ref;
    order.demo = DEMO_MODE;
    if (!DEMO_MODE) {
      const orders = JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]");
      orders.push(order); localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    }
    localStorage.removeItem(CART_KEY); updateCartCount();
    state.order = order; state.step = "done"; paint();
  }

  paint();
}

function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; } return h; }

async function renderProductPricing() {
  const root = document.getElementById("product");
  if (!root || !root.dataset.productSlug) return;
  const supplier = await loadSupplierCatalog();
  const product = supplierProduct(supplier, root.dataset.productSlug);
  if (!product || !Array.isArray(product.offers)) return;

  const offers = new Map(product.offers.map(offer => [offer.dose, offer]));
  const price = document.getElementById("pd-price");
  const format = document.getElementById("pd-format");
  const commercialNote = document.getElementById("pd-commercial-note");
  const trust = root.querySelector(".pd-trust");
  const kitFormat = root.querySelector("[data-supplier-format]");
  const add = document.getElementById("pd-add");
  let selected = null;
  if (kitFormat) kitFormat.disabled = false;

  function select(offer, button) {
    selected = offer;
    root.querySelectorAll(".dose-pill").forEach(item => item.classList.remove("on"));
    button.classList.add("on");
    price.textContent = fmtMinor(offer.price_minor);
    const observed = new Date(offer.observed_at).toLocaleDateString("fr-FR");
    format.textContent = `Kit de ${offer.contained_units} flacons · offre fournisseur observée le ${observed}`;
    if (add) {
      const enabled = STORE_ENABLED && offerCanEnterCart(offer);
      add.disabled = !enabled;
      add.textContent = enabled ? (DEMO_MODE ? "Ajouter à la démo" : "Ajouter au panier") : "Commande indisponible";
    }
  }

  let first = null;
  root.querySelectorAll(".dose-pill[data-dose]").forEach(button => {
    const offer = offers.get(button.dataset.dose);
    if (!offerCanEnterCart(offer)) {
      button.disabled = true;
      button.classList.add("unavailable");
      button.title = "Non proposé par le fournisseur";
      if (offer && offer.availability === "unavailable") {
        button.setAttribute("aria-label", `${button.dataset.dose}, indisponible`);
      }
      return;
    }
    button.disabled = false;
    button.onclick = () => select(offer, button);
    if (!first) first = [offer, button];
  });
  if (first) {
    select(first[0], first[1]);
    if (commercialNote) commercialNote.textContent =
      DEMO_MODE
        ? "Prix calculé depuis le tarif fournisseur courant avec la marge Maxence. Démonstration sans paiement réel."
        : "Prix calculé depuis le tarif fournisseur courant. Le prix final est confirmé au devis.";
    if (trust) trust.textContent =
      DEMO_MODE
        ? "Démo uniquement · aucun stock réservé · aucun paiement collecté."
        : "Prix indicatif · disponibilité fournisseur observée · stock exact confirmé avant commande.";
    if (add) add.onclick = () => {
      if (!selected || !offerCanEnterCart(selected)) return;
      const item = {
        id: `supplier:${product.slug}:${selected.dose}:${selected.package}`,
        slug: product.slug,
        name: product.name,
        dose: selected.dose,
        package: selected.package,
        containedUnits: selected.contained_units,
        format: "kit",
        price: selected.price_minor / 100,
        priceMinor: selected.price_minor,
        qty: 1,
      };
      const cart = getCart();
      const existing = cart.find(candidate => candidate.id === item.id);
      if (existing) existing.qty = Math.min(5, existing.qty + 1);
      else cart.push(item);
      setCart(cart);
      add.textContent = "Ajouté à la démo ✓";
      window.setTimeout(() => { add.textContent = "Ajouter à la démo"; }, 1200);
    };
  }
}

document.addEventListener("DOMContentLoaded", () => {
  updateCartCount();
  renderShop();
  renderProductPricing();
  renderCart();
});
