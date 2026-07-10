# Domain research 2026-06

The retired Framework workspace contained a one-off domain scan for ExportMD naming.
The active result is `exportmd.com`, registered through Cloudflare Registrar on 2026-06-21.

## Scan scope

The scan combined these keywords into two-word and three-word permutations:

- `chat`
- `gpt`
- `open`
- `ai`
- `export`
- `md`

The scan checked these TLDs:

- `.com`
- `.net`
- `.io`
- `.ai`
- `.app`
- `.md`

It produced 900 rows, then filtered them to shorter available names.
The filtered list found no positive estimated 10-year resale-profit candidates.
`exportmd.com` was still the best project fit because it is short, literal, and matches the app.

## Method

The retired helper used RDAP for `.com`, `.net`, and `.app`, and whois for `.io`, `.ai`, and `.md`.
It cached row statuses and wrote markdown tables for review.

The helper is not imported as active ExportMD code.
Future domain research should start from a fresh script or current registrar search because availability and renewal pricing are time-sensitive.

## Archived decision

| Domain | Decision | Why |
| --- | --- | --- |
| `exportmd.com` | Registered | Short, literal, and Vercel-friendly. |
