/* =====================================================================
   Maxence Peptides — CONFIGURATION DE LANCEMENT
   Les adresses ci-dessous sont des adresses de RÉCEPTION publiques : elles
   peuvent figurer dans le code client. Ne jamais mettre ici une clé privée,
   une phrase de récupération ou un identifiant bancaire de connexion.
   Après modification, incrémentez le ?v= des balises <script src="config.js">
   pour que les navigateurs rechargent le fichier.
   DEMO_MODE = true interdit tout paiement réel : aucune adresse de réception
   n'est affichée et aucune commande commerciale n'est créée.
   ===================================================================== */
window.MXP_CONFIG = {
  // Démo de commande uniquement. Le serveur revalide chaque prix fournisseur,
  // mais ne réserve aucun stock, ne collecte aucun paiement et ne persiste rien.
  STORE_ENABLED: true,
  DEMO_MODE: true,

  // Projection publique assainie : prix final EUR + disponibilité fournisseur
  // seulement. Aucune clé API, coût amont ou marge n'est envoyé au navigateur.
  SUPPLIER_CATALOG_ENDPOINT: "https://titratelab.com/api/storefront/v1/maxence/catalog",

  // --- Identité / contact (affichés sur le site) ---
  BRAND: "Maxence Peptides",
  CONTACT_EMAIL: "aimen60700@hotmail.fr",        // remplacer par contact@maxencepeptides.fr une fois la boîte créée
  CONTACT_PHONE_DISPLAY: "06 07 09 50 14",
  CONTACT_PHONE_E164: "+33607095014",
  WHATSAPP: "33607095014",                       // wa.me/<numéro sans +>
  TELEGRAM: "",                                  // ex. "maxencepeptides" (nom du canal, sans @) — vide = lien masqué
  ADDRESS_LINE: "43D rue Henri Bodchon, 60700 Pont-Sainte-Maxence",

  // --- Paiement crypto (prêt dès qu'une adresse est renseignée) ---
  BTC_ADDRESS: "",          // adresse Bitcoin de réception (bech32 recommandé)
  EVM_ADDRESS: "",          // adresse Ethereum pour USDC / USDT (ERC-20)
  BTC_EUR: 88000,           // taux indicatif de secours ; le taux réel est chargé au moment du paiement
  CRYPTO_DISCOUNT_PCT: 5,   // remise affichée pour un paiement en Bitcoin

  // --- Virement SEPA (très utilisé en France) ---
  SEPA_IBAN: "",            // ex. "FR76 1234 5678 9012 3456 7890 123"
  SEPA_BIC: "",
  SEPA_HOLDER: "",          // titulaire du compte tel qu'il apparaît à la banque

  // --- PayPal / carte (optionnel, laisser vide pour désactiver) ---
  PAYPAL_CLIENT_ID: "",
  PAYPAL_CURRENCY: "EUR",

  // --- Réception des commandes et des messages ---
  // Web3Forms is used for contact forms only. Orders require ORDER_ENDPOINT.
  FORMS_ACCESS_KEY: "",
  ORDER_ENDPOINT: "/api/demo-orders", // validation serveur, sans persistance

  // --- Analytique sans cookie (Cloudflare Web Analytics), vide = désactivé ---
  CF_BEACON_TOKEN: "",
};
