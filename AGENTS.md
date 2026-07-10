<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes. APIs, conventions, and file structure may all differ from your training data.
Read the relevant guide in `node_modules/next/dist/docs/` before writing any code.
Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

Markdown style for repo docs: [STYLE.md](STYLE.md).

## Agent workspace boundary

`agent/` is exclusively for agent workspace, scratchpad, memory bank, research, reports, references, and any other agent-directory working material.
Never discuss, cite, link, summarize, or direct David to `agent/` files.
When information from `agent/` matters to David, distill the relevant result into chat or a user-facing root/inbox/outbox document without naming or linking the agent-directory source file.

## Critical: interaction protocol (state a / b / c)

**Run this before every reply.** Choosing a state is step one, not an afterthought.
Two failures to avoid: **acting when you should ask** (false State A), and **asking when you should act** (false State B/C).
The fresh pass below catches both.

### Fresh pass (every turn, before you write)

1. **Reset** on a new top-level instruction. Drop any blocked state from the previous task.
1. **Scan** for anything still open: a question, a suggestion the user could accept or reject, a concern needing a decision, a follow-up decision, or a follow-up on your own earlier Roman-numbered items - **including new items raised by the user's latest reply, even when they answered your whole list.**
1. **Pick the state**, shape the reply to match, and only then send.

**No open items means go.** If the fresh pass is clean and the user gave you work, do it.
Never ask "ready to proceed?" or "want me to apply?" when nothing is open.
Being asked "any questions?" is an invitation to act, not to ask permission.

### Situation → state

| Situation | State |
| --- | --- |
| Fresh pass clean, user gave a task | **A** |
| User gave an explicit do-it instruction (`apply item 3`, `rename X`, `fix the typo`) | **A** |
| User answered all your Roman-numbered slots for a task they asked you to do | **A** |
| User answered Roman-numbered slots **and** said proceed / implement / apply / continue | **A** |
| User asked only for facts or explanation | **A** |
| Verdict-only review with no recommendations, action items, next pass, or concerns | **A** |
| You need input: a fork, an offer to apply, an uncertainty to confirm, multiple edit packages | **B** |
| Review with possible fixes, cleanup candidates, next passes, risks, priorities, or changes the user should pick among | **B** |
| Review/plan/advice only, user resolved your choices, implement intent still unclear | **C** |

**State A:** deliver work with headings, tables, and prose. Do not preface with "no questions." End with one clean sentinel (below). State A prose carries **no** questions, suggestions, concerns, or unresolved follow-up decisions - every one of those becomes a Roman-numbered **State B** item instead.
In review replies, any finding that implies a possible edit, cleanup, follow-up audit, prioritization, or decision is an open item unless the user explicitly asked for analysis only and no recommendations.
Before sending State A after a review, scan for substantive meaning: if the reply would reasonably invite the user to approve, reject, prioritize, sequence, or act on anything, convert the reply to State B.

**State B / C:** the **entire message body** is one top-level Roman-numbered list. **Wait.** No implementation until the user replies (except where State A green-light rules apply). No sentinel.

**State C is narrow.** Use it only for review/plan/advice where choices are resolved but implement intent is still unclear.
**Do not use State C** when the user already picked concrete edit decisions for a task they asked you to do - that is **State A**.
Do not re-ask proceed/implement/apply/continue in the same turn.

### State a sentinels (the rider)

Every clean **State A** reply ends with exactly one of these final-line sentinels.
Use the ready sentinel when there is a next action and name the next action after `continue to`.
Use the nothing sentinel only when the task is complete and there is no meaningful continuation path.

```text

No questions, suggestions, concerns, or follow-up decisions. I am ready to continue to <specific next action>.

```

```text

No questions, suggestions, concerns, or follow-up decisions. There is nothing to continue.

```

- Verbatim except for `<specific next action>` in the ready sentinel: no bold, backticks, extra words, or punctuation changes, nothing after it.
- Every clean State A reply (informational, acks, substantive work alike). Never on B or C, never as an opener.
- Chat only - not PLAN, PROGRESS, or outbox files.
- Before sending any State A reply, check that exactly one sentinel is present as the final line.
- It must be literally true: a caveat or "you could also..." is a State B item, not a footnote under the sentinel.

### State b / c - shape (the rule agents break most)

When the state is **B** or **C**:

- The **entire message body is one top-level Roman-numbered list**. Nothing else at that level.
- **Every Roman numeral must need a user reply** - accept/reject, yes/no, pick A/B/C, or a short directive. If an item needs no response, it does not belong in the list.
- **One Roman numeral = one decision.** The user must be able to reply `I. Yes`, `II. B`, or `VII.II: fix`.
- Use uppercase Roman numerals for top-level decision items.
- Use dotted uppercase Roman numerals for user-addressable nested items, such as `VII.II`.
- **Choices go under the item** as sub-bullets: `yes / no / partial`, `A / B / C`, `apply / revise / skip`. Prefer compact choices, free-form is always allowed.
- **Forbidden as siblings:** a second list, a "recommendations" bullet list, a table of options, a section heading (`## What works`) while input is open, or any trailing paragraph outside the list.
- **Allowed inside one item:** sub-bullets, code blocks, links, short context.
- **Ask-user / wizard UI:** use only when it preserves one-list-one-decision. If it would fragment the list, use plain chat.

After the user answers, run the fresh pass again.

### Roman-numbered conversation (so the user can steer without doing the work)

- **User -> agent:** when the user numbers items (including `7.1`, `7.2`, `VII.I`, or `VII.II`), reply in the **same numbering**.
- **Agent -> user (B/C):** one Roman-numbered list, per the shape rules above.
- **Agent -> user (A):** normal deliverables, closing with one clean sentinel.

### Cross-rules

- **Session handoff mode:** append `## Next chat prompt` only on eligible **State A** replies, **above** the sentinel. Never on B or C.
- **Research vs implementation:** drafts and research under `agent/` may proceed without waiting unless the user restricted the task. Edits outside `agent/`, purchases, and irreversible steps follow this protocol.

### Broken → fixed

**Review drift** - prose, a table, then an offer (State B pretending to be A):

```text

## What is working
| table |
## Highest-impact edits
- bullet recommendations
Want me to apply these?

```

Fix - each recommendation is one decision, nothing else at top level:

```text

I. Compress duplicated "Agent leadership" in README to a pointer? (yes / no / partial)
II. Mark LM Studio as (A) committed or (B) TBD in PLAN? (A / B)
III. Apply the agreed edits now? (yes / no / revise)

```

**Contradicted rider** - sentinel printed, then a suggestion tacked on:

```text

No questions, suggestions, concerns, or follow-up decisions. There is nothing to continue.
One more thing, you could cache this result.

```

Fix - the "one more thing" is a suggestion, so it is a State B item, only print the sentinel when nothing follows:

```text

I. Cache this result to avoid the repeat call? (yes / no)

```

**False permission** - clean fresh pass, but the agent asks anyway:

```text

User: Drop model X from the stack. Any questions?
Agent: I. Keep it on disk? ...

```

Fix - the question invited a fresh pass, none found → drop from stack (State A), close with the sentinel.

**Non-actionable item** - a Roman numeral that asks nothing:

```text

I. The README/AGENTS split is sound, the gap is duplication...

```

Fix - drop the praise, or make it a line the user can answer yes/no.

### Micro-trace

```text

User: Rename getCwd to getCurrentWorkingDirectory.
Agent (A): acts
No questions, suggestions, concerns, or follow-up decisions. There is nothing to continue.

User: Review this plan; what would you change?
Agent (B): I. Apply the safety wording now? (apply / discuss / skip)
User: I. Discuss.
Agent (A): discusses
No questions, suggestions, concerns, or follow-up decisions. There is nothing to continue.

User: Review plan; what would you change?
Agent (B): I. Apply safety wording? II. Trim section 4? III. Apply agreed edits now?
User: I. Yes. II. Skip. III. Apply.
Agent (A): acts
No questions, suggestions, concerns, or follow-up decisions. There is nothing to continue.

User: I: move X? V: OK. VII.II: fix.
Agent (A): same numbering, VII.II applied
No questions, suggestions, concerns, or follow-up decisions. There is nothing to continue.

```

## Session handoff mode

When the user requests to **hand off**/**handoff** (or close variants: **let's hand off**, **time to hand off**, **hand off now**, **then we'll hand off**, **session handoff**, **handoff mode**, **give me a handoff**, **need a handoff**, **start handoff**, **start a handoff**), **session handoff mode** is active for the rest of this chat.

**Purpose:** keep a living, copy-paste-ready **first prompt for the next agent chat** so the user can stop mid-session and bootstrap a new chat without writing the brief.

**Chat only.** Do not create or update handoff files under `agent/archive/`, `outbox/`, or PROGRESS for this unless the user separately asks.

### When to include `## next chat prompt`

After each reply while handoff mode is active, decide whether to append the section:

| Include | Skip |
| --- | --- |
| The **first agent reply** after the handoff request | **State B** or **State C** replies (Roman-numbered list only, no trailing sections) |
| Any reply where the **fresh pass** finds no open questions, suggestions, concerns, follow-up decisions, or follow-ups on earlier Roman-numbered items | Replies that still need user input |

Do **not** include the section in every reply.
Update and include it only when the table above says include.

### Section format

Append on eligible **State A** replies, **above** the State A sentinel (see **Critical: interaction protocol**).
Handoff prompts must end with: `Do you have any questions, suggestions, concerns, or follow-up decisions?`

- Heading: `## Next chat prompt`
- One fenced **`text`** code block the user can copy in one step

**Prompt contents** (include what you know, omit empty sections):

1. Opening line: what the next agent should do.
1. **Read first:** repo-relative paths the next agent must read before acting.
1. **Goals:** numbered list when the task is clear enough.
1. **Constraints:** only when relevant (sudo, scope limits, do-not-delete rules).
1. **Done when:** clear completion criteria when known.

Start shorter right after handoff activation if the task is still forming.
Expand **Goals**, **Constraints**, and **Done when** as decisions land in the session.
Replace outdated lines every time you include the section, do not append stale versions.

### Replan

If the user says "replan", they want to hand off to a new agent in Plan Mode.
Adjust the **next chat prompt** to optimize for Plan Mode (explore options, readonly checks, no implementation until the user confirms).
