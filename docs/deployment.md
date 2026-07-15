# ExportMD deployment

ExportMD is deployed on Vercel and uses Cloudflare Registrar and DNS for `exportmd.com`.

## Domain setup

Add both domains to the Vercel project that serves `exportmd.vercel.app`:

- `exportmd.com`
- `www.exportmd.com`

Use Vercel dashboard records exactly. Typical defaults are:

| Hostname | Type | Value |
| --- | --- | --- |
| `@` | A | `76.76.21.21` |
| `www` | CNAME | `cname.vercel-dns.com` |

Keep Cloudflare proxy status set to **DNS only** so Vercel can verify the domain and issue TLS certificates.

## API protection

`/api/export` is an internal fallback path for the web app, not a public API product.
The application route allows `POST /api/export` only when the request has the app origin, the `X-ExportMD-Client: web` header, and, when present, same-origin browser fetch metadata.
This browser-abuse guard is not authentication and is not curl-safe because non-browser clients can spoof request headers.
ExportMD uses platform-only curl/bot abuse protection: Vercel Firewall/WAF is the active enforcement layer, and the application route remains a lightweight browser guard rather than an authentication boundary.

Before relying on server-side export fallback in production, configure Vercel-side firewall or rate-limiting protection that targets `POST /api/export`, limits request volume, blocks obvious direct abuse, and allows normal app fallback traffic.
Cloudflare WAF rules are not the chosen protection path while Cloudflare remains DNS-only for the Vercel domain records.

Configure the production Vercel project Firewall with these rules:

1. Add a rate-limit rule named `Rate limit ExportMD API`.
1. Match requests where method is `POST` and path is `/api/export`.
1. Start with `Log` long enough to observe normal export traffic.
1. Switch the rule to `Rate Limit` after confirming it only matches API fallback traffic.
1. Use IP address or Vercel's available client/network fingerprint as the rate-limit key.
1. Return `429` for limited requests so the app can show "ExportMD API is temporarily rate limited. Please wait a moment and try again."
1. Keep the threshold low enough to stop scripted curl abuse and high enough for normal repeated export attempts from one user.
1. Add separate deny or challenge rules for obvious direct-abuse patterns only after observing production traffic.

Do not add Cloudflare WAF or rate-limit rules for this path while Cloudflare remains DNS-only.
Those rules would not see traffic for the Vercel-hosted app.
If the domain records are later proxied through Cloudflare, update this document and choose one active edge protection layer instead of maintaining conflicting Vercel and Cloudflare policies.

## Verify

```bash
dig exportmd.com +short
```

```bash
dig www.exportmd.com +short
```

```bash
curl -sI https://exportmd.com | head -5
```

```bash
curl -sI https://www.exportmd.com | head -5
```

Expected result: `200`, `301`, or `302`, depending on the canonical-domain redirect configured in Vercel.

After the Vercel Firewall rule is published, verify that direct API abuse does not run freely:

```bash
curl -i -X POST https://exportmd.com/api/export \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://chatgpt.com/share/example"}'
```

Expected result: either the application guard rejects the request with `403`, or Vercel eventually returns `429` when the rate-limit threshold is exceeded.
Normal browser exports from the app should still complete.

## Troubleshooting

| Symptom | Likely fix |
| --- | --- |
| Vercel invalid config | Match DNS, keep proxy off. |
| `www` fails but apex works | Add or fix the `www` CNAME |
| Browser shows SSL errors | Keep proxy DNS-only, wait for Vercel TLS. |
| Wrong app loads | Attach custom domain to the ExportMD Vercel project. |
| Direct API curl succeeds repeatedly | Confirm the Vercel Firewall rule is published for `POST /api/export`. |
| Normal app exports receive 429 | Raise the Vercel API rate-limit threshold or switch obvious-abuse traffic to a separate challenge/deny rule. |
