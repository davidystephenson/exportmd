# Style guide

Local style guide copy for agent-led repos in the Pantheon ecosystem.
Every in-scope project keeps its own `STYLE.md` at the repo or project root.
Keep these copies synchronized across in-scope projects when the style changes.

Repos in scope: non-client Pantheon-owned repos and project roots.
This includes `athena`, `dotfiles`, `exportmd`, `tuf`, `venus`, `inside`, `bloodline`, `squire`, `valkyrie`, `eris`, `longlivetheempress`, `hera`, `tyche`, and `pantheon`.
Client and company workspaces under Tyche client folders keep their local style unless they explicitly opt in.
Apply to every `.md` file in scope unless the file is raw source material, generated output, imported text, or historical evidence.

Follow markdownlint rules (except for line length) in all markdown files.
Do not use em dashes or semicolons in Markdown prose.
Usually the best replacement for a semicolon is a comma.

The custom punctuation lint rules apply to visible prose in paragraphs, headings, list item text, table cells, and normal link or image alt text in those contexts.
They do not apply to block quotes, fenced code, indented code, inline code, link URLs, autolinks, reference definitions, HTML comments, raw HTML, front matter, math, Markdown structure markers, or raw/source artifacts excluded from the normal lint run.

Do not use bolding (`**bold**`) as a formatting tool.
Bolding is reserved for meaningful inline emphasis.

Prefer letting each sentence be on its own line, with no empty lines between sentences in the same paragraph.
This is advisory because URLs, initials, abbreviations, versions, and quoted/source text need judgment.
Do not pad the indentation of follow-up lines to match dashes or other meta characters.
Keep a blank line between paragraphs.
Do not reformat inside fenced code blocks.

## Titles

Do not capitalize the words of a title after the first unless it is a proper noun.
This is advisory because project names, model names, acronyms, commands, route names, and quoted/source text need judgment.

## Sections

Capitalize the first word of each section title.
Only capitalize the first word of each section title.
This is advisory because project names, model names, acronyms, commands, route names, and quoted/source text need judgment.

## Table of contents

Use a table of contents when a Markdown file has enough sections that navigation would help.
This especially applies to long files, reference docs, policy docs, and files with many peer sections.
The table of contents must use Markdown links to section headings.

## Lists

Use `1.` in markdown for all ordered lists, not `1.`, `2.`, `3.`, etc.
Prefer capitalizing the first letter of a list item when it is normal prose.
Use judgment for route names, commands, identifiers, values, quoted/source text, and other content where lower case is intentional.
If the item has a key and a value, add a colon after the key followed by the value.
Do not capitalize the description unless it has multiple sentences.
Do not use extra backticks or bolding for each list item title.

Most list items should not use punctuation at the end.
Only use punctuation if the list item has multiple sentences.
If the list item has multiple sentences, begin each sentences with a capital letter, and end each sentence with a period, including the last one.

Do not use nested listed lists unless there are multiple nested items.

## Tables

Markdown tables must be contiguous: no blank lines between header, separator, or body rows.
CommonMark ends a table on the first blank line, so internal blanks break rendering in Glass and other parsers.
Keep one blank line before and after the whole table block only.

## Not applicable

If a required section needs to be empty, the section content should read "N/A".

## Markdownlint

Every `.md` edit must pass [markdownlint](https://github.com/DavidAnson/markdownlint) with zero errors before the task is done.
Use each repo's `.markdownlint.json` at repo root.

After changing any markdown file, run from that repo root:

```bash

npx --yes markdownlint-cli2 "path/to/changed.md"

```

Do not leave markdownlint failures for the user to discover in the editor.

Each repo's `.markdownlint-cli2.jsonc` should exclude dependency/build output such as `node_modules`.
Exclude raw preserved artifacts from the lint gate instead of weakening markdownlint rules.
Current raw-artifact exclusions:

- `archive/bakeoffs/**`: Bakeoff per-model files are raw evidence, not styled or linted in bulk passes
- `archive/bakeoffTasks/**`: User-owned Athena bakeoff task prompts
- `prompts/INBOX.md`: Raw Venus prompt staging queue
- `prompts/exports/**/*.md`: Venus chat/export transcripts
- `prompts/meta/**/*.md`: Venus prompt meta/source material
- `prompts/reference/**/*.md`: Venus reference/source material
- `prompts/seeds/**/*.md`: Venus seed/source material

Prompt `README.md` files are documentation and should stay linted.
No `agent/` Markdown file should be excluded from markdownlint.

Avoid `markdownlint-disable` comments.
Prefer fixing the markdown or adjusting repo config (`.markdownlint.json`, `.markdownlint-cli2.jsonc`).
If a disable is truly necessary, use the narrowest scope (`disable-next-line` or a short block), and add an HTML comment on the preceding line explaining why.
Example: `<!-- lint: generated table, column widths fixed by formatter -->`.
