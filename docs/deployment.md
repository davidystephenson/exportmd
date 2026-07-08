# ExportMD deployment

ExportMD is deployed on Vercel and uses Cloudflare Registrar and DNS for
`exportmd.com`.

## Domain setup

Add both domains to the Vercel project that serves `exportmd.vercel.app`:

- `exportmd.com`
- `www.exportmd.com`

Use Vercel dashboard records exactly. Typical defaults are:

| Hostname | Type | Value |
| --- | --- | --- |
| `@` | A | `76.76.21.21` |
| `www` | CNAME | `cname.vercel-dns.com` |

Keep Cloudflare proxy status set to **DNS only** so Vercel can verify the
domain and issue TLS certificates.

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

Expected result: `200`, `301`, or `302`, depending on the canonical-domain
redirect configured in Vercel.

## Troubleshooting

| Symptom | Likely fix |
| --- | --- |
| Vercel invalid config | Match DNS; keep proxy off. |
| `www` fails but apex works | Add or fix the `www` CNAME |
| Browser shows SSL errors | Keep proxy DNS-only; wait for Vercel TLS. |
| Wrong app loads | Attach custom domain to the ExportMD Vercel project. |
