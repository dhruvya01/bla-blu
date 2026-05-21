---
name: Cherished Moments
colors:
  surface: '#fff8f6'
  surface-dim: '#fbd1c4'
  surface-bright: '#fff8f6'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fff1ed'
  surface-container: '#ffe9e3'
  surface-container-high: '#ffe2da'
  surface-container-highest: '#ffdbd0'
  on-surface: '#2c160e'
  on-surface-variant: '#554245'
  inverse-surface: '#442a22'
  inverse-on-surface: '#ffede8'
  outline: '#887175'
  outline-variant: '#dbc0c4'
  surface-tint: '#a03a57'
  primary: '#a03a57'
  on-primary: '#ffffff'
  primary-container: '#ff85a2'
  on-primary-container: '#771a38'
  inverse-primary: '#ffb1c1'
  secondary: '#795900'
  on-secondary: '#ffffff'
  secondary-container: '#fed174'
  on-secondary-container: '#785800'
  tertiary: '#625e56'
  on-tertiary: '#ffffff'
  tertiary-container: '#b1aaa1'
  on-tertiary-container: '#433f38'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffd9df'
  primary-fixed-dim: '#ffb1c1'
  on-primary-fixed: '#3f0017'
  on-primary-fixed-variant: '#812240'
  secondary-fixed: '#ffdea1'
  secondary-fixed-dim: '#ecc065'
  on-secondary-fixed: '#261900'
  on-secondary-fixed-variant: '#5c4300'
  tertiary-fixed: '#e9e1d8'
  tertiary-fixed-dim: '#cdc5bc'
  on-tertiary-fixed: '#1e1b15'
  on-tertiary-fixed-variant: '#4a463f'
  background: '#fff8f6'
  on-background: '#2c160e'
  surface-variant: '#ffdbd0'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '800'
    lineHeight: 48px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 38px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  body-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Be Vietnam Pro
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-handwritten:
    fontFamily: Bricolage Grotesque
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-caps:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.1em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  gutter: 16px
  margin-mobile: 20px
  margin-desktop: 64px
---

## Brand & Style

The design system is centered on the concept of "Digital Warmth." It evokes the nostalgia of a physical scrapbook, designed specifically for couples to document their shared journey. The brand personality is unapologetically cute, intimate, and playful.

The visual style is **Tactile / Skeuomorphic** mixed with **Modern Playfulness**. It utilizes soft shadows to simulate paper layers, subtle paper textures, and organic lines that feel hand-drawn rather than mathematically perfect. The goal is to move away from cold, corporate interfaces toward a space that feels like a private, cozy home for memories.

Key aesthetic drivers:
- **Intimacy:** Small-scale interactions and personalized touches.
- **Handmade Feel:** Imperfect edges, "washi tape" accents, and "stickers."
- **Softness:** High roundedness and a gentle color palette that reduces eye strain and promotes emotional connection.

## Colors

The palette is inspired by "Golden Hour" memories—warm, soft, and inviting.

- **Primary (Strawberry Cream):** Used for main actions, heart icons, and celebratory states.
- **Secondary (Honey Glow):** Used for highlighting special dates, stars, and accents that need a playful pop.
- **Tertiary (Vanilla Paper):** The primary background color, providing a warm, parchment-like base that is softer than pure white.
- **Neutral (Cocoa Ink):** A warm, dark brown used for text and borders to maintain softness while ensuring legibility. Avoid pure black (#000000).

Functional colors (Success, Error, Warning) should be desaturated and tinted with the primary warm tones to ensure they don't break the "cute" immersion.

## Typography

The typography strategy balances modern legibility with a "journaled" feel. 

- **Plus Jakarta Sans** provides a friendly, geometric base for headings. Its "b" and "p" terminals are soft, fitting the "very cute" requirement.
- **Be Vietnam Pro** is used for body text and long-form memories; it is contemporary yet warm.
- **Bricolage Grotesque** acts as our "pseudo-handwritten" font for labels, dates on photos, and captions. It has a quirky, idiosyncratic character that mimics human writing without sacrificing accessibility.

Headlines should use tight tracking, while labels can benefit from increased letter spacing to feel like deliberate annotations in a scrapbook.

## Layout & Spacing

The design system uses a **Fluid Grid** with generous, "breathable" margins to simulate the edges of a physical book.

- **Grid:** A 12-column grid for desktop and a 4-column grid for mobile.
- **Rhythm:** An 8px base unit drives all spacing.
- **Composition:** Layouts should feel intentionally asymmetrical in places—cards may have slight rotations (1-2 degrees) to mimic photos dropped onto a page.
- **Mobile:** Elements should hug the 20px safe area. Full-bleed backgrounds are encouraged to create a seamless "page" feel.

## Elevation & Depth

Depth in this system is achieved through **Tonal Layers** and **Soft Ambient Shadows**. 

1.  **Level 0 (Base):** The Tertiary "Vanilla Paper" color.
2.  **Level 1 (Substrate):** Cards and containers with a very slight 1px "Cocoa Ink" border at 10% opacity.
3.  **Level 2 (Active Elements):** Buttons and "Polaroid" frames. These use a "squishy" shadow: `0px 4px 12px rgba(93, 64, 55, 0.15)`.
4.  **Level 3 (Pop-overs):** Modals and tooltips use a deep, diffused shadow to appear as if they are floating high above the scrapbook.

Avoid harsh blurs. The depth should feel like paper stacked on paper, not glass or metal.

## Shapes

The shape language is dominated by **Rounded** corners to reinforce the friendly and safe atmosphere.

- **Standard Elements:** 8px (0.5rem) radius for input fields and small cards.
- **Large Containers:** 16px (1rem) for main scrapbook sections and image modals.
- **Interactive Elements:** Buttons and tags use a fully rounded (Pill) style to invite touch.
- **Visual Interest:** Icons and decorative "stickers" should have slightly irregular, organic roundedness where possible.

## Components

### Polaroid Frames
The signature component. Images are housed in a white (#FFFFFF) frame with a larger bottom margin. The `label-handwritten` font is used at the bottom to display dates or short locations. These should have a subtle `rotate(1.5deg)` applied randomly to create the scrapbook feel.

### Buttons
Buttons are "pill-shaped" and use the Primary color. They should have a "pressed" state that shrinks slightly (`scale(0.96)`) to feel tactile and squishy.

### Washi Tape & Stickers
Used as decorative accents to "hold" items in place. Washi tape components are semi-transparent rectangles with "torn" jagged edges on the left and right, appearing at the corners of polaroid frames.

### Chips
Used for memory categories (e.g., "Date Night," "Travel"). These use the Secondary color with a soft 1px border.

### Input Fields
Inputs use the Tertiary color but slightly darker. They feature a "hand-drawn" underline style instead of a full box for a more casual, journal-entry feel.

### Lists
Lists are separated by dotted lines (Cocoa Ink, 20% opacity) rather than solid lines, maintaining the lightweight, paper-like aesthetic.