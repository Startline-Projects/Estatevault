---
name: new-component
description: Scaffold a new branded EstateVault React component with correct structure, TypeScript, Tailwind brand classes, and loading/error states.
---

Scaffold a new EstateVault React component based on the name and purpose the user provides.

## Output
Create a single file at `/components/[ComponentName].tsx`.

## Template to follow

```tsx
import React from 'react'

interface [ComponentName]Props {
  // props here
}

export default function [ComponentName]({ }: [ComponentName]Props) {
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  return (
    <div className="...">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {/* component content */}
    </div>
  )
}
```

## Rules
- No `any` types — every prop explicitly typed
- Tailwind only — no inline styles
- Brand colors: navy `#1C3557`, gold `#C9A84C`, white `#FFFFFF`, charcoal `#2D2D2D`
- Mobile-first: base classes for 375px, `md:` for tablet, `lg:` for desktop
- Loading state included if the component triggers any async action
- Error state included if the component makes any API call
- Never use the word "death" in any copy — use "passing" or "when you're gone"

## Ask the user if not provided
- Component name
- What it does (one sentence)
- Does it make any API calls? (determines if loading/error states are needed)
- Where it will be used (page context)
