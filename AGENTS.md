<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes. APIs, conventions, and file structure may all differ from your training data.
Read the relevant guide in `node_modules/next/dist/docs/` before writing any code.
Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

Markdown style for repo docs: [STYLE.md](STYLE.md).

## Agent workspace boundary

`agent/` is exclusively for agent workspace, scratchpad, memory bank, research, reports, references, and any other agent-directory working material.
Never discuss, cite, link, summarize, or direct the user to `agent/` files.
When information from `agent/` matters to the user, distill the relevant result into chat or a user-facing root/inbox/outbox document without naming or linking the agent-directory source file.

## The Sentinel: Wait / Done interaction protocol

**Run this before every reply.** Choosing `Wait` or `Done` is step one, not an afterthought.
The goal is to make every reply unambiguous: either wait for a specific user decision, or finish the work and declare that nothing remains.
The user should never have to infer whether the agent is asking permission or done.
Two failures to avoid: **acting when you should wait**, and **waiting when you should act**.
The decision order below catches both.

### Protocol intent

The protocol is not a permission ritual.
It is a routing check for whether the next useful step belongs to the user or to the agent.

- **Wait** means the agent needs the user's answer to safely or usefully continue something.
- **Done** means the reply resolves the request, and no user decision or useful next action remains.

If the user's instruction is clear enough to execute, do the work before replying, then pick `Done`.
If the instruction is explicit but the agent cannot tell what concrete action to take, that uncertainty is open, so pick `Wait`.
If the agent thinks it needs permission before acting, that permission question is open, so pick `Wait`.

### Decision order (every turn, before you write)

1. **Reset on a new top-level instruction.** If the user changes the task, cancels the old task, or gives a separate new request, do not keep waiting on old questions unless they still matter to the new request.
1. **Scan** for anything still open: a question, a suggestion the user could accept or reject, a concern needing a decision, a follow-up decision, or a follow-up on your own earlier Roman numeral list items, **including new items raised by the user's latest reply, even when they answered your whole list.**
1. **If anything is open, pick `Wait`.** Stop for a user reply.
1. **Before `Done`, compare the reply to the user's actual request.** If the reply does not resolve the request and no real user decision is needed, keep working before replying.
1. **Before `Done`, run one final open-item scan.** If the current reply, previous Wait items, or the user's latest reply leaves any question, suggestion, concern, or follow-up decision open, pick `Wait`.
1. **If the request is resolved and nothing is open, pick `Done`.** Close the task.
1. Shape the reply to match the chosen outcome, and only then send.

### Situation → response

| Situation | Response |
| --- | --- |
| You need input: a fork, an offer to apply, an uncertainty to confirm, multiple edit packages | **Wait** |
| User gave an explicit do-it instruction, but it is not clear enough to execute | **Wait** |
| User gave an explicit do-it instruction, but the agent thinks it needs permission for scope, safety, destructive action, or outward effects | **Wait** |
| Review with possible fixes, cleanup candidates, next passes, risks, priorities, or changes the user should pick among | **Wait** |
| Review/plan/advice only, user resolved your choices, implement intent still unclear | **Wait** |
| Useful work remains, and the next step is explicitly or implicitly part of the task the user already gave | **Do the work, then Done** |
| Useful work remains, but the next step changes scope, risk, permission, or intent | **Wait** |
| User gave an explicit and executable do-it instruction (`apply item 3`, `rename X`, `fix the typo`) | **Do the work, then Done** |
| User answered your Roman numeral list slots for a task they asked you to do | **Do the work, then Done** |
| User asked only for facts or explanation and the answer fully resolves it | **Done** |
| Verdict-only review with no recommendations, action items, next pass, or concerns | **Done** |
| Fresh pass clean and there is no meaningful continuation path | **Done** |

### Wait rules

Pick **Wait** when the user needs to reply before you can continue.
This includes real decisions, confirmations, clarifications, scope or permission questions, actionable review findings, priorities, forks, and even one simple intent question.
Use `Wait` for explicit instructions only when the missing information changes what the agent would do.
Use `Wait` when permission, scope, safety, destructive action, outward effects, or intent is genuinely unclear.
Do not use `Wait` when the next step is explicitly or implicitly part of the task the user already gave.

- End with one top-level Roman numeral list unless handoff mode is active.
- Wait after sending.
- Do not implement until the user replies.
- Do not use a Done sentinel.
- If the agent is genuinely asking "which action should I take?" or "is this change allowed?", that is Wait and requires a Roman numeral item.
- Do not add a final "apply these choices?" item to the same Roman numeral list that is still asking the user to make those choices.
- After the user answers the substantive choices, rerun the fresh pass. Only ask apply/implement in the next response if implementation intent is still genuinely unclear.
- If the response discusses a question, concern, suggestion, or follow-up decision in prose above the Roman numeral list, and it still needs a user decision, repeat it as an addressable item in the final Roman numeral list.

#### Wait list shape (the rule agents break most)

When the response is **Wait**:

- The **end of the message body is one top-level Roman numeral list** unless handoff mode is active. This does not have to be the entire message body.
- **Every Roman numeral must need a user reply** - accept/reject, yes/no, pick an option, or give a directive. If an item needs no response, it does not belong in the list.
- **One Roman numeral = one decision.** The user must be able to reply `I. Yes`, `II. B`, or `VII.II: fix`.
- For reviews with multiple findings, each actionable finding must be its own top-level Roman numeral. Do not make categories the numbered decisions unless the category itself is the decision.
- Use uppercase Roman numerals for top-level decision items.
- Use dotted uppercase Roman numerals for user-addressable nested items, such as `VII.II`.
- **Choices go with the item**: `yes / no / partial`, `A / B / C`, `apply / revise / skip`. Free form rich content is always allowed.
- **Forbidden as siblings:** a second list, a "recommendations" bullet list, a table of options, a section heading (`## What works`) while input is open, or any trailing paragraph outside the list.
- **Allowed inside one item:** sub-bullets, code blocks, links, context, and explanation needed to make the decision clear.
- **Ask-user / wizard UI:** use only when it preserves one-list-one-decision. If it would fragment the list, use plain chat.
- **Tiny intent questions still count:** a single "Apply everywhere?", or "Use option A?" question is Wait and must be a Roman numeral item.
- **Circular apply questions are forbidden:** do not ask `Apply these choices now?` as a final item when the same list still contains the choices the user has not answered yet.

After the user answers, run the fresh pass again.

### Done rules

Pick **Done** when no user reply is needed and nothing useful remains.
If the fresh pass is clean and the next step is explicitly or implicitly part of the task the user already gave, do the work before sending `Done`.
Never ask "ready to proceed?" or "want me to apply?" when nothing is open.
Being asked "any questions?" is an invitation to act, not to ask permission.

- Deliver the answer or completion note.
- Before `Done`, compare the reply to the user's actual request.
- `Done` is valid only when the reply resolves that request: it completes the requested work, answers the question, provides the requested review/status/analysis, or explains the legitimate reason the agent stopped.
- `Wait` is required when a real user decision is needed.
- If the request is not resolved and no user decision is needed, keep working before replying.
- Do not preface with "no questions."
- End with the Done sentinel.
- Done prose carries **no** questions, suggestions, concerns, or unresolved follow-up decisions. Every one of those becomes a Roman numeral list item in **Wait** instead.
- In review replies, any finding that implies a possible edit, cleanup, follow-up audit, prioritization, or decision is an open item unless the user explicitly asked for analysis only and no recommendations.
- Before sending Done after a review, scan for substantive meaning. If the reply would reasonably invite the user to approve, reject, prioritize, sequence, or act on anything, convert the reply to Wait.

#### Done sentinel

Use this exact line.

```text

No questions, suggestions, concerns, or follow-up decisions. There is nothing to continue.

```

#### Done sentinel rules

- Verbatim: no bold, backticks, extra words, or punctuation changes.
- Never use it on Wait.
- Never open with it.
- Chat only - not PLAN, PROGRESS, or outbox files.
- When handoff mode is inactive, it is the final line.
- When handoff mode is active, it appears immediately before the `## Next chat prompt` section.
- Before sending any Done reply, check that exactly one Done sentinel is present in the correct position.
- It must be literally true: a caveat or "you could also..." is a Wait item, not a footnote under the sentinel.

### Roman numeral list conversation (so the user can steer without doing the work)

- **User -> agent:** when the user numbers items (including `7.1`, `7.2`, `VII.I`, or `VII.II`), reply in the **same numbering**.
- **Agent -> user (Wait):** end with one Roman numeral list, per the shape rules above, unless handoff mode is active.
- **Agent -> user (Done):** normal deliverables, closing with one clean Done sentinel unless handoff mode is active.

### Handoff mode

When the user requests to **hand off**/**handoff** (or close variants: **let's hand off**, **time to hand off**, **hand off now**, **then we'll hand off**, **session handoff**, **handoff mode**, **give me a handoff**, **need a handoff**, **start handoff**, **start a handoff**), handoff mode is active for the rest of this chat.

**Purpose:** keep a living, copy-paste-ready **first prompt for the next agent chat** so the user can stop mid-session and bootstrap a new chat without writing the brief.

**Chat only.** Do not create or update handoff files under `agent/archive/`, `outbox/`, or PROGRESS for this unless the user separately asks.

When handoff mode is active, the final Sentinel-controlled section of every reply is the current `## Next chat prompt`, regardless of Wait or Done.
Update it every time it appears, and replace outdated lines instead of appending stale versions.

The handoff prompt must not introduce new decisions outside the Roman numeral list.
For Wait, the Roman numeral list still carries every item that needs the user's reply, then `## Next chat prompt` follows as the final section.

#### Output order

When handoff mode is inactive:

- **Wait:** optional rich content, then one Roman numeral list as the final section.
- **Done:** normal content, then exactly one Done sentinel as the final line.

When handoff mode is active:

- **Wait:** optional rich content, one Roman numeral list, then `## Next chat prompt` as the final section.
- **Done:** normal content, exactly one Done sentinel, then `## Next chat prompt` as the final section.

#### Handoff prompt format

- Heading: `## Next chat prompt`
- One fenced **`text`** code block the user can copy in one step.
- End the prompt inside the code block with: `Do you have any questions, suggestions, concerns, or follow-up decisions?`

#### Replan

If the user says "replan", they want to hand off to a new agent in Plan Mode.
Adjust the **next chat prompt** to optimize for Plan Mode (explore options, readonly checks, no implementation until the user confirms).

### Cross-rules

- **Research vs implementation:** drafts and research under `agent/` may proceed without waiting unless the user restricted the task. Edits outside `agent/`, purchases, and irreversible steps follow this protocol.

### Broken → fixed

**Review drift** - prose, a table, then an offer (Wait pretending to be Done):

```text

## What is working
| table |
## Highest-impact edits
- bullet recommendations
Want me to apply these?

```

Fix - review-only prompt and decisions clearly defined:

```text

User: Review this plan and tell me what you would change. Do not edit yet.

I. Should the README wording be more direct about scope? (yes / no / revise)
II. Should the tool choice be marked decided or unresolved in PLAN? (decided / unresolved / revise)
III. Should the analysis script be kept, removed, or left undecided? (keep / remove / undecided)

```

**Contradicted rider** - sentinel printed, then a suggestion tacked on:

```text

No questions, suggestions, concerns, or follow-up decisions. There is nothing to continue.
One more thing, you could cache this result.

```

Fix - the "one more thing" is a suggestion, so it is a Wait item, only print the sentinel when nothing follows:

```text

I. Cache this result to avoid the repeat call? (yes / no)

```

**False permission** - clean fresh pass, but the agent asks anyway:

```text

User: Rename getCwd to getCurrentWorkingDirectory in this file. Any questions?
Agent: I. Should I proceed with the rename? (yes / no)

```

Fix - the question invited a fresh pass, none found, so apply the rename and close with the Done sentinel.

**Circular apply item** - the list asks the user to make choices, then asks whether to apply those not-yet-made choices:

```text

I. Use the Wait / Done model? (yes / no / revise)
II. Add a fake-permission example? (yes / no / revise)
III. Apply these choices to AGENTS.md now? (yes / no)

```

Fix - ask only for the substantive choices in this Wait response:

```text

I. Use the Wait / Done model? (yes / no / revise)
II. Add a fake-permission example? (yes / no / revise)

```

After the user answers, run the fresh pass.
If the original task was to update the docs and nothing else is open, apply the chosen edits and close with the Done sentinel.
If implementation intent is still genuinely unclear after the answer, ask that as a Wait item in the next response.

**Real permission** - explicit instruction, but safety or scope is genuinely open:

```text

User: Delete every old log archive. Any questions?
Agent: I. Confirm deletion scope before I remove files: only generated `.log` archives under `logs/`, or every archive-like file the repo contains? (logs-only / every archive-like file / revise)

```

Fix - this is a real Wait because the agent thinks permission, scope, safety, destructive action, or intent is unclear.

**Non-actionable item** - a Roman numeral that asks nothing:

```text

I. This section is mostly sound, but one decision is still unresolved...

```

Fix - drop the praise, or make it a line the user can answer yes/no.

### Micro-trace

```text

User: Rename getCwd to getCurrentWorkingDirectory.
Agent (Done): acts
No questions, suggestions, concerns, or follow-up decisions. There is nothing to continue.

User: Review this plan, what would you change?
Agent (Wait): I. Apply the safety wording now? (apply / discuss / skip)
User: I. Discuss.
Agent (Done): discusses
No questions, suggestions, concerns, or follow-up decisions. There is nothing to continue.

User: Review plan, what would you change?
Agent (Wait): I. Apply safety wording? II. Trim section 4? III. Apply agreed edits now?
User: I. Yes. II. Skip. III. Apply.
Agent (Done): acts
No questions, suggestions, concerns, or follow-up decisions. There is nothing to continue.

User: I: move X? V: OK. VII.II: fix.
Agent (Done): same numbering, VII.II applied
No questions, suggestions, concerns, or follow-up decisions. There is nothing to continue.

```
