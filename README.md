# ExportMD

ExportMD is a web app for exporting ChatGPT and Grok conversations to Markdown format.
Just paste your link.

## Stack

- Cloudflare Registrar and DNS (exportmd.com)
- Vercel (Deployment)
- Next.js (Framework)
- React (UI)
- ShadCN UI and Tailwind CSS (UI styling)
- ts-standard (Linting)

Deployment notes: [docs/deployment.md](docs/deployment.md).
Domain research: [docs/domain-research-2026-06.md](docs/domain-research-2026-06.md).

## Spec-driven and agent-orchestrated development

ExportMD is developed spec-first.
This README is the human-readable behavioral contract and product specification for the app, not just a summary after implementation.
It documents the user experience, visible design, visible behavior, user-facing copy, export flow, privacy tradeoffs, and user-relevant infrastructure in enough detail for developers to lead agent-orchestrated development from the spec.
Detailed export ordering, progress copy, filename rules, and visible fallback behavior are part of the user experience because they shape what users see, trust, wait through, copy, and download.
It does not document internal implementation contracts that do not affect the user experience.
Agents must read this file before changing behavior, decide which validation checks are needed for their change, run those checks, and update this README whenever a user-facing feature, design rule, export strategy, or deployment assumption changes.

## Export flow

ExportMD accepts public ChatGPT share links and public Grok share links.
The main page subtitle is "Paste a ChatGPT or Grok share link and export it as Markdown."
The URL field placeholder is `https://chatgpt.com/share/... or https://grok.com/share/...`.
The canonical public share examples are `chatgpt.com/share/...` and `grok.com/share/...`.
The app also accepts legacy ChatGPT share URLs on `chat.openai.com/share/...` and Grok share URLs on `www.grok.com/share/...` for compatibility.
Private ChatGPT conversation URLs such as `https://chatgpt.com/c/[id]` and `https://chat.openai.com/c/[id]` are rejected with guidance for creating a public share link.

Slow mode is the initial default path on a fresh browser profile.
The app stores the fast-mode preference in local storage, so returning users reopen in whichever mode they last selected.
It tries public CORS proxies from the browser in this order, with one attempt per proxy and no retries:

1. Corsfix
1. corsproxy.io
1. allOrigins raw
1. allOrigins get
1. cors.lol
1. cors.syrins
1. every-origin
1. allOrigins JSONP

`allOrigins JSONP` is last because it has a distinct timeout path.
It is still a single proxy attempt, but it can wait up to 20 seconds for a response and then allows a 750ms grace period before the app treats the attempt as failed.
If every public proxy fails, the app falls back to the ExportMD API.
Fast mode skips the browser proxy list and uses the ExportMD API directly.
The UI labels this option "Fast mode (less private)" because the share URL is sent directly to the ExportMD API instead of first trying browser-side public CORS proxies.
Exports completed through the ExportMD API show the same Markdown document shape as browser-proxy exports.
The UI assigns the `ExportMD API` source label when it uses the API path.
Private ChatGPT conversation URLs show the specialized private-link recovery alert.
Fetch failures and parse failures show generic error alerts with user-facing messages.

While exporting, the current strategy, source, and status are displayed just below the form.
Browser-proxy exports show the proxy name as the source.
API exports always show `ExportMD API` as the source, including fast mode and fallback exports.
Slow mode starts with "Starting export...", then reports each browser proxy as "Trying [proxy]...".
ChatGPT slow-mode exports may briefly show "Starting client export..." before the first proxy attempt.
Fast mode starts with "Starting fast export...", then reports the API phase as "Fetching share page via server...".
Client-proxy exports report "Parsing conversation..." when the app has fetched a share payload and is converting it.
API exports do not show a separate parsing status.
They report "Fetching share page via server..." and then "Export complete." before the result preview appears.
When an export succeeds, the progress panel is removed and the result preview appears.
Both ChatGPT and Grok slow-mode exports try the full browser proxy list before falling back to the ExportMD API.
When every browser proxy fails, ChatGPT fallback reports "Client proxies failed, trying server export..." and Grok fallback reports "Client proxy failed, trying server export...".
The singular Grok wording is only the visible status copy, it does not mean Grok tried only one proxy.

Exports use one provider-neutral Markdown document shape.
Each visible preview and downloaded export starts with a top-level `#` heading for the conversation title, or a timestamp fallback title when no provider title is available.
Timestamp fallback titles use the export timestamp format `YYYY-MM-DDTHH-MM-SSZ`.
Exports do not include provider, timestamp, or model metadata in the Markdown body.
Messages render under `##` sender headings.
ChatGPT exports filter out tool replies and empty statements before rendering.
Each remaining ChatGPT reply uses the parsed author name as its `##` heading, or the reply type if no author name is available.
Grok exports render trimmed non-control message text, and filter out control responses and empty messages before rendering.
If a successful export has no messages after filtering, it still renders as a Markdown document with the title.
Grok sender value `human` renders as `## User`.
Grok sender value `ASSISTANT` renders as `## Grok`.
Any other non-empty Grok sender string is trimmed and used directly as the `##` heading.
If a Grok sender value is missing or empty, the heading is `## Message`.
Downloaded filenames are generated from the conversation title when available, otherwise from the timestamp fallback title.
Filename bases are sanitized, non-ASCII characters and punctuation are removed, underscores are preserved, whitespace is collapsed to hyphens, repeated hyphens are collapsed, leading and trailing hyphens are removed, and the result is capped at 80 characters and saved with the `-export.md` suffix.
If the resulting filename base is empty after sanitization, the filename falls back to the export timestamp.

## Layout

The app is a single-screen tool.
The page uses the viewport height as its frame and prevents page-level vertical or horizontal scrollbars.
The header, theme controls, fast-mode toggle, URL form, progress panel, alerts, and export result all live inside that frame.

Before export, the header controls and URL form sit together in the centered single-screen frame.
During export, a progress panel appears below the form and reports the strategy, source, and status.
On errors, the alert appears in the same form area so the input and recovery path stay visible.

After a successful export, the result appears below the form in a result card.
The markdown preview takes the available remaining height, scrolls internally, and wraps long words so large exports fit on narrow screens such as iPhone SE.
The page itself stays fixed while only the exported content scrolls.
The markdown preview renders GitHub-flavored Markdown.
It styles headings, paragraphs, lists, blockquotes, horizontal rules, inline code, code blocks, tables, and links inside the preview frame.
Preview links open in a new tab.
Tables scroll horizontally inside the preview when needed.

The result card footer sits below the markdown preview.
It shows the source for the completed export and the "Copy", "Download", and "Reset" actions.
On wider screens, the source sits on the left and the actions sit on the right.
On narrow screens, the footer stacks them.
"Copy" copies the generated Markdown to the clipboard.
"Copied!" is shown for 2 seconds after a successful copy, then the button returns to "Copy".
"Download" saves the generated Markdown using the generated filename.
"Reset" clears the export state and focuses the URL input.
If Clipboard API access is unavailable when the user clicks "Copy", the app switches to the generic error state and shows "Copy is not supported in this browser."
If copying fails without a specific error message, the app shows "Could not copy to clipboard."

## Theme

The UI uses system light/dark mode by default.
You can also manually switch between light and dark mode with the theme button in the header row.
After a manual theme is stored, a second button appears that clears the stored choice and returns the UI to the system theme.
The manual theme choice is stored in local storage under `theme`.
The app applies the stored or system dark theme before hydration so the first render does not flash the wrong theme.
Fast mode is also stored locally under `exportmd-fast-mode` so the preference persists across reloads.

## User-facing copy

The primary heading is "ExportMD".
The primary button is "Export" and changes to "Exporting" while a request is in progress.
The fast-mode toggle reads "Fast mode (less private)" on screens wide enough to show the privacy note, and "Fast mode" on smaller screens.
The progress panel labels are "Strategy:", "Source:", and "Status:".
If the user enters an unsupported link, the app shows "Please enter a valid ChatGPT or Grok share link (chatgpt.com/share/..., chat.openai.com/share/..., or grok.com/share/...)."
If the user enters an invalid Grok share link, the app can show "Please enter a valid Grok share link (grok.com/share/...)."
The success actions are "Copy", "Download", and "Reset".
After a successful copy, "Copy" changes to "Copied!" for a short confirmation.
The app metadata title is "ExportMD".
The app metadata description is "One click ChatGPT or Grok to Markdown".

## Infrastructure

The production domain is `exportmd.com`.
Cloudflare provides registrar and DNS management for the domain.
Vercel hosts the Next.js application.
Cloudflare proxying is DNS-only for the Vercel domain records.
The app uses the Next.js App Router.
The ExportMD API is deployed with the Vercel app rather than as a separate Cloudflare Worker.
Runtime details are documented here when they affect deployment or production debugging.
The ExportMD API route uses the Next.js `nodejs` runtime.
The ExportMD API is an internal fallback path for the web app, not a public API product.
Production deployments must protect it from direct public abuse before relying on it for server-side export fallback.
The in-app route guard allows `POST /api/export` only when the request has the app origin, the `X-ExportMD-Client: web` header, and, when present, same-origin browser fetch metadata.
Requests missing those browser-abuse guard checks receive "ExportMD API access is restricted to the web app."
This guard is not authentication and is not curl-safe because non-browser clients can spoof request headers.
ExportMD uses platform-only curl/bot abuse protection: Vercel Firewall/WAF is the active enforcement layer, and the application route remains a lightweight browser guard rather than an authentication boundary.
Because Cloudflare is DNS-only for the Vercel domain records, production abuse protection for `/api/export` must be configured on the Vercel side.
The production deployment must use Vercel-side firewall or rate-limiting protection that targets `POST /api/export`, limits request volume, blocks obvious direct abuse, and allows normal app fallback traffic.
Cloudflare WAF rules are not part of the active protection path unless the Vercel domain records are proxied through Cloudflare.
Deployment details live in [docs/deployment.md](docs/deployment.md).
Domain research lives in [docs/domain-research-2026-06.md](docs/domain-research-2026-06.md).

## Error handling

Errors appear as destructive alerts in the form area.
Generic errors use the alert title "Export failed" and show the specific error message as the alert body.
If copying fails after a successful export, the result card is replaced by the generic error alert.
Private ChatGPT conversation URLs use a specialized recovery alert instead of the generic title.
The specialized title tells the user that the pasted URL type is the problem, not that ExportMD failed to process a valid share link.
The private-link alert title is "This is a private conversation link".
The private-link alert body starts with "The URL you pasted opens a chat in your account. ExportMD needs a public share link instead."
It then shows these recovery steps:

1. Open the conversation on chatgpt.com while signed in.
1. Click Share in the top-right of the chat, or open the three-dot menu next to the chat in the sidebar and choose Share.
1. Click Create link, then Copy link.
1. Paste the chatgpt.com/share/... link here and export again.

If the user submits a url like `<https://chatgpt.com/c/[id]>`, one they have to share first, the UI shows a specific warning explaining why and how to export the chat in the current ChatGPT UI.
If ChatGPT cannot be reached from the server, the app shows "Could not reach ChatGPT. Check your connection and try again."
If ChatGPT returns a temporary server failure or rate limit while fetching a share link from the server, the app retries briefly and then shows "ChatGPT is temporarily unavailable while fetching this share link. Please wait a moment and try again."
If ChatGPT returns a failed response from the server, the app shows "Could not fetch this conversation. The link may be invalid or temporarily unavailable."
If ChatGPT does not return a valid share page from the server, the app shows "Could not fetch a valid share page from ChatGPT."
If ChatGPT share parsing fails, the app shows `Could not parse this conversation — the page format may have changed or the link is not public.`
If Grok cannot be reached from the server, the app shows "Could not reach Grok. Check your connection and try again."
If Grok returns a failed response from the server, the app shows "Could not fetch this Grok conversation. The link may be invalid or temporarily unavailable."
If Grok returns invalid JSON or an invalid payload shape from the server, the app shows "Grok returned an invalid response."
If the ExportMD API cannot be reached after client-side proxy failure, the app shows "Could not fetch this conversation. Client proxies and the server fallback are unavailable."
If the ExportMD API is rate limited by the platform, the app shows "ExportMD API is temporarily rate limited. Please wait a moment and try again."
If the ExportMD API returns an unexpected failure without a specific message, the app shows "Could not export this conversation. Please try again."

Markdown style for repo docs: [STYLE.md](STYLE.md).

## Project relationships

| Relationship | Project | Root |
| --- | --- | --- |
| Parent | Athena | [~/athena/athena](/home/david/athena/athena) |
| Children | N/A | N/A |
