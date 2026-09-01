# Maxence Peptides frontend

Static frontend handoff for the Maxence Peptides website.

## Run locally

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Deployment

Deploy the repository root as a static site (for example with Cloudflare Pages or Netlify). There is no build command and the output directory is `.`.

## Integration boundary

- Product presentation and storefront pages are included.
- Prices and availability are loaded in the browser from TitrateLab's public Maxence storefront endpoint configured in `config.js`.
- Demo storefront mode is enabled.
- Payment processing, order persistence, fulfillment, private supplier credentials, and inventory administration are intentionally not included.
- The configured `/api/demo-orders` checkout receiver must be supplied by the production backend before real orders can be accepted.

`config.js` is public browser configuration. Never place API secrets, wallet private keys, seed phrases, or private supplier credentials in it.
