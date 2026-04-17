---
name: phase-checklist
description: Output a checklist of what's built vs missing for the current EstateVault phase. Use at the start of each session to orient.
---

Read the current phase from `CLAUDE.md`, then scan the codebase and produce a checklist of what's complete and what still needs to be built.

## How to run this
1. Read `CLAUDE.md` to identify the current phase
2. Read the phase definition to understand what's in scope
3. Scan the relevant directories (`/app`, `/components`, `/lib`, `/app/api`) for existing work
4. Output a checklist

## Output format

```
## Phase [N] — [Phase Name]

### Done
- [x] [item] — [file path where it lives]

### In Progress / Partial
- [-] [item] — [what exists, what's missing]

### Not Started
- [ ] [item]

### Blocked / Needs Input
- [!] [item] — [what's needed to unblock]
```

## Rules
- Only list items that are in scope for the current phase
- Do not flag missing work from future phases
- Be specific — reference actual file paths, not vague descriptions
- If a component exists but has no mobile styling, mark it as partial
- If an API route exists but has no auth check, flag it as incomplete
- Note any hard-stop logic that's missing from document/quiz routes
