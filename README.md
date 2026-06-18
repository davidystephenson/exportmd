# ExportMD

ExportMD is a web app for exporting ChatGPT conversations to Markdown format.
Just paste your link.

## Stack

- Cloudflare Domains (exportmd.com)
- Vercel (Deployment)
- Next.js (Framework)
- React (UI)
- ShadCN UI (Styling)
- ts-jstandard (Linting)

Exports try public CORS proxies in order (Corsfix, corsproxy.io, allOrigins, cors.lol, cors.syrins, every-origin).
When all fail, the app falls back to `/api/export`.
While exporting, the current strategy, source, and status is displayed to the user just below the form.

## Layout

Once an export successfully appears, export text is centered along with the rest of the content, pushing the header up if necessary until it is pinned to the top of the page depending on how long the content is.
Above the export inline with the title are "Copy" "Download" and "Reset" buttons. The same buttons appear below the export.
"Reset" also focuses the form input.
The styling ensures only the exported content's internal scrollbar appears, there is no page level vertical or horizontal scrollbars even for large exports with long words on iPhone SE.

## Theme

The UI uses system light/dark mode by default.
You can also manually switch between light and dark mode with a button next to the header.

## Error handling

If the user submits a url like https://chatgpt.com/c/[id], one they have to share  first, the UI shows a specific warning explaining why and how to export the chat in the current Chat GPT UI.
Parsing errors display the full context and error in the console to facilitate user debugging.