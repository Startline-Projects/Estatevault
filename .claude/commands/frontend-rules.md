# EstateVault — Frontend Rules

Apply these rules to all UI work in this project.

## Brand Colors (exact — do not substitute)
- Navy `#1C3557` — backgrounds, headings, primary buttons
- Gold `#C9A84C` — accents, highlights, quiz CTA
- White `#FFFFFF` — page and card backgrounds
- Charcoal `#2D2D2D` — body text

## Typography
- Font: Inter via Google Fonts — always imported, never system font fallback for branded surfaces
- Headings: `font-bold` or `font-semibold`, navy colored
- Body: `font-normal`, charcoal colored
- Legal/disclaimer copy: `text-sm text-gray-500`

## Voice & Copy Rules
- NEVER use the word "death" — use "passing," "loss," or "when you're gone"
- Frame everything as protection: "protect your family," "secure your legacy"
- Quiz results MUST start with "Based on your answers..." — never "We recommend..."
- Legal disclaimer required on every document-related page

## Component Patterns
- Cards: `bg-white rounded-lg shadow-sm border border-gray-100 p-6`
- Primary button: navy bg, white text, `hover:bg-navy-800`
- Accent/quiz button: gold bg, white text
- Frosted glass: `backdrop-blur-md bg-white/10 border border-white/20`
- Section dividers: subtle gray `border-gray-100`

## Layout System
- Max content width: `max-w-6xl mx-auto`
- Section vertical padding: `py-16 px-4` mobile → `py-24 px-8` desktop
- Hero sections: full-width navy background or navy-to-slate gradient

## Responsive Breakpoints
- Base (mobile-first): 375px+
- `md:` — 768px tablet
- `lg:` — 1024px desktop
- Every page must be tested at 375px, 768px, and 1280px before done

## Accessibility
- All `<img>` tags need descriptive `alt` text
- Interactive elements need visible focus rings (`focus:ring-2`)
- WCAG AA contrast: navy on white passes; gold on white does not — use navy text on gold
- Form inputs always have a visible `<label>` — no placeholder-only labels
