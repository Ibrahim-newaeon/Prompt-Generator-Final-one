# MegaPrompt — Design Guide

## Aesthetic
Dark, premium AI-tool vibe. Inspired by the Dropalette reference: near-black base with vivid rainbow/gradient spectrum accents. Feels powerful, creative, slightly futuristic.

## Colors
- Background: `#07070d` (near-black with a hint of indigo)
- Surface cards: `#0f0f1a` with `rgba(255,255,255,0.04)` border
- Gradient accent spectrum: `#ff3cac → #784ba0 → #2b86c5 → #00d2ff → #a8ff78 → #ffbe76`
- Primary CTA: gradient from `#7c3aed` to `#2563eb`
- Text primary: `#f0f0ff`
- Text muted: `#6b6b8a`
- Star rating: `#fbbf24`

## Typography
- Display/Hero: `Syne` (Google Fonts) — bold, geometric, impactful
- Body/UI: `DM Sans` — clean, readable, modern
- Code blocks: `JetBrains Mono`
- Hero heading: 56–72px, weight 800
- Section headings: 28–36px, weight 700
- Body: 15–16px, weight 400–500

## Layout
- Single-page app with top nav + tabbed sections
- Max width: 1200px centered
- Generous vertical spacing (80–120px sections)
- Floating glass cards with subtle border glow

## Backgrounds
- Hero: radial gradient mesh with soft colorful glows
- Grid dot pattern overlay (very subtle, low opacity)
- Section dividers: thin gradient lines

## Motion
- Page load: stagger reveal on main elements
- Buttons: scale + glow on hover
- Generated prompt: typewriter-style reveal or smooth fade-in
- Tab switches: smooth crossfade

## Component Style
- Buttons: gradient bg, no border radius beyond 12px, uppercase tracking
- Input fields: dark glass bg, glowing border on focus (purple→blue)
- Cards: `backdrop-blur`, subtle border, slight inner shadow
- Prompt type pills: colored per type (purple=chat, cyan=image, green=code)
- Template cards: colorful left border accent
