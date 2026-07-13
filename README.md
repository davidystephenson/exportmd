# ExportMD

ExportMD is a web app for exporting ChatGPT and Grok conversations to Markdown format.
Just paste your link.

## Stack

- Cloudflare Domains (exportmd.com)
- Vercel (Deployment)
- Next.js (Framework)
- React (UI)
- ShadCN UI and Tailwind CSS (UI styling)
- ts-standard (Linting)

Deployment notes: [docs/deployment.md](docs/deployment.md).
Domain research: [docs/domain-research-2026-06.md](docs/domain-research-2026-06.md).

## Spec-driven and agent-orchestrated development

ExportMD is developed spec-first.
This README is the human-readable product specification for the app, not just a summary after implementation.
It should document the user experience, visible design, visible behavior, user-facing copy, export flow, privacy tradeoffs, and user-relevant infrastructure in enough detail for developers to lead agent-orchestrated development from the spec.
It should not document internal implementation contracts that do not affect the user experience.
Agents should read this file before changing behavior and should update it whenever a user-facing feature, design rule, export strategy, or deployment assumption changes.

## Export flow

ExportMD accepts public ChatGPT share links and public Grok share links.
The main page subtitle is "Paste a ChatGPT or Grok share link and export it as Markdown."
The URL field placeholder is `https://chatgpt.com/share/... or https://grok.com/share/...`.
The canonical public share examples are `chatgpt.com/share/...` and `grok.com/share/...`.
The app also accepts legacy ChatGPT share URLs on `chat.openai.com/share/...` and Grok share URLs on `www.grok.com/share/...` for compatibility.
Private ChatGPT conversation URLs such as `https://chatgpt.com/c/[id]` and `https://chat.openai.com/c/[id]` are rejected with guidance for creating a public share link.

Slow mode is the default path.
It tries public CORS proxies from the browser in this order, with one attempt per proxy and no retries:

1. Corsfix
1. corsproxy.io
1. allOrigins raw
1. allOrigins get
1. allOrigins JSONP
1. cors.lol
1. cors.syrins
1. every-origin

If every public proxy fails, the app falls back to the ExportMD API.
Fast mode skips the browser proxy list and uses the ExportMD API directly.
The UI labels this option "Fast mode (less private)" because the share URL is sent directly to the ExportMD API instead of first trying browser-side public CORS proxies.
The ExportMD API returns the same user-facing exported Markdown content as the browser-proxy path.
Private ChatGPT URLs, fetch failures, and parse failures return user-facing error messages.
Private ChatGPT conversation URLs show the specific private-link alert.

While exporting, the current strategy, source, and status are displayed just below the form.
Browser-proxy exports show the proxy name as the source.
API exports always show `ExportMD API` as the source, including fast mode and fallback exports.
Slow mode starts with "Starting export...", then reports each browser proxy as "Trying [proxy]...".
ChatGPT slow-mode exports may briefly show "Starting client export..." before the first proxy attempt.
Fast mode starts with "Starting fast export...", then reports the API phase as "Fetching share page via server...".
When the app has fetched a share payload and is converting it, the status is "Parsing conversation...".
When export succeeds, the status is "Export complete."
Both ChatGPT and Grok slow-mode exports try the full browser proxy list before falling back to the ExportMD API.
When every browser proxy fails, ChatGPT fallback reports "Client proxies failed, trying server export..." and Grok fallback reports "Client proxy failed, trying server export...".
The singular Grok wording is only the visible status copy, it does not mean Grok tried only one proxy.

Exports use one provider-neutral Markdown document shape.
Each export starts with a top-level `#` heading for the conversation title or provider fallback title.
The next line is italic metadata joined with ` | `.
Metadata always includes `Provider: ChatGPT` or `Provider: Grok`.
ChatGPT metadata also includes `Updated: YYYY-MM-DD HH:MM:SS` when a share update time is available and `Model: [model]` when a model value is available.
Messages render under `##` sender headings.
ChatGPT exports preserve user-visible user/assistant message content, and filter out tool replies and empty statements before rendering.
Grok exports preserve non-control message text, and filter out control responses and empty messages before rendering.
If an export has no messages after filtering, it still succeeds as a Markdown document with the title and metadata.
Grok sender value `human` renders as `## User`.
Grok sender value `ASSISTANT` renders as `## Grok`.
Any other non-empty Grok sender string is trimmed and used directly as the `##` heading.
If a Grok sender value is missing or empty, the heading is `## Message`.
Downloaded filenames are generated from the conversation title when available, otherwise from the export timestamp.
Filename bases are sanitized, collapsed to hyphen-separated words, capped at 80 characters, and saved with the `-export.md` suffix.

## Layout

The app is a single-screen tool.
The page uses the viewport height as its frame and prevents page-level vertical or horizontal scrollbars.
The header, theme controls, fast-mode toggle, URL form, progress panel, alerts, and export result all live inside that frame.

Before export, the header controls and URL form sit together in the centered single-screen frame.
During export, a progress panel appears below the form and reports the strategy, source, and status.
On errors, the alert appears in the same form area so the input and recovery path stay visible.

After a successful export, the result appears below the form in a framed preview.
The markdown preview takes the available remaining height, scrolls internally, and wraps long words so large exports fit on narrow screens such as iPhone SE.
The page itself should stay fixed while only the exported content scrolls.
The markdown preview renders GitHub-flavored Markdown.
It styles headings, paragraphs, lists, blockquotes, horizontal rules, inline code, code blocks, tables, and links inside the preview frame.
Preview links open in a new tab.
Tables scroll horizontally inside the preview when needed.

The success footer sits below the markdown preview.
Its left side shows the source for the completed export.
Its right side shows "Copy", "Download", and "Reset" actions.
"Copy" copies the generated Markdown to the clipboard.
"Copied!" is shown for 2 seconds after a successful copy, then the button returns to "Copy".
"Download" saves the generated Markdown filename.
"Reset" clears the export state and focuses the URL input.
If Clipboard API access is unavailable, the app switches to the generic error state and shows "Copy is not supported in this browser."
If copying fails without a specific error message, the app shows "Could not copy to clipboard."

## Theme

The UI uses system light/dark mode by default.
You can also manually switch between light and dark mode with a button next to the header.
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
The private-link alert title is "This is a private conversation link".
The private-link alert body starts with "The URL you pasted opens a chat in your account. ExportMD needs a public share link instead."
It then shows these recovery steps:

1. Open the conversation on chatgpt.com while signed in.
1. Click Share in the top-right of the chat, or open the three-dot menu next to the chat in the sidebar and choose Share.
1. Click Create link, then Copy link.
1. Paste the chatgpt.com/share/... link here and export again.

The app metadata title is "ExportMD".
The app metadata description is "One click ChatGPT or Grok to Markdown".

## Infrastructure

The production domain is `exportmd.com`.
Cloudflare provides registrar and DNS management for the domain.
Vercel hosts the Next.js application.
Cloudflare proxying should remain DNS-only for the Vercel domain records.
The app uses the Next.js App Router.
The ExportMD API is deployed with the Vercel app rather than as a separate Cloudflare Worker.
Deployment details live in [docs/deployment.md](docs/deployment.md).
Domain research lives in [docs/domain-research-2026-06.md](docs/domain-research-2026-06.md).

## Error handling

If the user submits a url like `<https://chatgpt.com/c/[id]>`, one they have to share first, the UI shows a specific warning explaining why and how to export the chat in the current ChatGPT UI.
If ChatGPT cannot be reached from the server, the app shows "Could not reach ChatGPT. Check your connection and try again."
If ChatGPT returns a failed response from the server, the app shows "Could not fetch this conversation. The link may be invalid or temporarily unavailable."
If ChatGPT does not return a valid share page from the server, the app shows "Could not fetch a valid share page from ChatGPT."
If ChatGPT share parsing fails, the app shows `Could not parse this conversation — the page format may have changed or the link is not public.`
If Grok cannot be reached from the server, the app shows "Could not reach Grok. Check your connection and try again."
If Grok returns a failed response from the server, the app shows "Could not fetch this Grok conversation. The link may be invalid or temporarily unavailable."
If Grok returns invalid JSON or an invalid payload shape from the server, the app shows "Grok returned an invalid response."
If the ExportMD API cannot be reached after client-side proxy failure, the app shows "Could not fetch this conversation. Client proxies and the server fallback are unavailable."
If the ExportMD API returns an unexpected failure without a specific message, the app shows "Could not export this conversation. Please try again."

Markdown style for repo docs: [STYLE.md](STYLE.md).

## Project relationships

| Relationship | Project | Root |
| --- | --- | --- |
| Parent | Athena | [~/athena/athena](/home/david/athena/athena) |
| Children | N/A | N/A |
