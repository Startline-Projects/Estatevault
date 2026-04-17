---
name: new-zod-schema
description: Add a new Zod validation schema to /lib/validation/schemas.ts in EstateVault. Use this whenever the user needs to add validation for a new form, API request body, quiz flow, intake step, or any structured data — even if they just say "add validation" or "I need a schema for X". Always trigger this skill for any schema or validation work in this project.
---

Add a new Zod schema export to `/lib/validation/schemas.ts` in EstateVault.

## Step 1 — Read the file first

Always read `/lib/validation/schemas.ts` before writing anything. Understand the existing schemas so you don't duplicate field names or violate naming conventions.

## Step 2 — Ask if not provided

Gather this before writing code:

- What is this schema for? (one sentence — drives the name)
- What fields are needed? For each: name, required or optional, and data type
- Any fields with a fixed set of allowed values? (becomes `z.enum([...])`)
- Does this form require the user to check an acknowledgment box before submitting? (adds `acknowledgment_signed` at the end)
- Any percentage fields? → `z.number().min(0).max(100)`
- Any money/price fields? → integers in cents (add `// stored in cents` comment)

## Step 3 — Write the schema

### Naming convention

| Thing | Format | Example |
|---|---|---|
| Schema variable | `[feature]Schema` camelCase | `partnerOnboardingSchema` |
| Exported type | `[Feature]` PascalCase | `PartnerOnboarding` |

### Zod patterns used in this codebase

```ts
// Required string
field: z.string().min(1, "Field is required")

// Optional string
field: z.string().optional()

// Fixed set of values
status: z.enum(["active", "pending", "inactive"])

// Optional enum
status: z.enum(["active", "pending"]).optional()

// Acknowledgment checkbox — must be true
acknowledgment_signed: z.boolean().refine((val) => val === true, {
  message: "You must sign the acknowledgment before proceeding",
})

// Required array with typed items
items: z.array(z.object({ ... })).min(1, "At least one item is required")

// Optional array
items: z.array(z.object({ ... })).optional()

// Percentage
share: z.number().min(0).max(100)

// Money — always integers, never floats
amount_cents: z.number().int().min(0) // stored in cents
```

### Group fields with section comments (follow existing file style)

```ts
export const exampleSchema = z.object({
  // Personal information
  full_name: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email"),

  // Options
  plan_type: z.enum(["basic", "premium"]),

  // Acknowledgment — always last if present
  acknowledgment_signed: z.boolean().refine((val) => val === true, {
    message: "You must sign the acknowledgment before proceeding",
  }),
})

export type Example = z.infer<typeof exampleSchema>
```

## Step 4 — Append to the file

Append to `/lib/validation/schemas.ts`. Place new schema **before** the existing `export type` lines at the bottom so the type exports stay grouped.

Always add both:
1. `export const [feature]Schema = z.object({ ... })`
2. `export type [Feature] = z.infer<typeof [feature]Schema>`

## Rules

- Never create a new file — always append to `/lib/validation/schemas.ts`
- No `any` types
- `acknowledgment_signed` is always last when present
- Money fields always have `// stored in cents` comment inline
- Export the inferred type immediately after the schema (not grouped at the end of the file)
