---
name: Lumina Desktop
colors:
  surface: '#fcf8fb'
  surface-dim: '#dcd9dc'
  surface-bright: '#fcf8fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f5'
  surface-container: '#f0edef'
  surface-container-high: '#eae7ea'
  surface-container-highest: '#e4e2e4'
  on-surface: '#1b1b1d'
  on-surface-variant: '#414754'
  inverse-surface: '#303032'
  inverse-on-surface: '#f3f0f2'
  outline: '#717786'
  outline-variant: '#c0c6d6'
  surface-tint: '#005db8'
  primary: '#005ab3'
  on-primary: '#ffffff'
  primary-container: '#0073e0'
  on-primary-container: '#fefcff'
  inverse-primary: '#aac7ff'
  secondary: '#575f67'
  on-secondary: '#ffffff'
  secondary-container: '#d8e1ea'
  on-secondary-container: '#5b646b'
  tertiary: '#9a4100'
  on-tertiary: '#ffffff'
  tertiary-container: '#c25300'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d6e3ff'
  primary-fixed-dim: '#aac7ff'
  on-primary-fixed: '#001b3e'
  on-primary-fixed-variant: '#00468d'
  secondary-fixed: '#dbe4ed'
  secondary-fixed-dim: '#bfc8d0'
  on-secondary-fixed: '#141d23'
  on-secondary-fixed-variant: '#3f484f'
  tertiary-fixed: '#ffdbcb'
  tertiary-fixed-dim: '#ffb691'
  on-tertiary-fixed: '#341100'
  on-tertiary-fixed-variant: '#793100'
  background: '#fcf8fb'
  on-background: '#1b1b1d'
  surface-variant: '#e4e2e4'
typography:
  display-lg:
    fontFamily: Manrope
    fontSize: 48px
    fontWeight: '800'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-md:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Manrope
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.2'
  headline-lg-mobile:
    fontFamily: Manrope
    fontSize: 28px
    fontWeight: '700'
    lineHeight: '1.3'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  gutter: 24px
  margin-desktop: 40px
  margin-mobile: 16px
  container-max: 1440px
---

## Brand & Style
The design system embodies a refined, MacOS-inspired aesthetic characterized by clarity, precision, and high-end utility. It targets professional environments where focus and organization are paramount.

The design style is a hybrid of **Minimalism** and **Glassmorphism**, leveraging generous whitespace and translucent layers to create a sense of breathability. By utilizing off-white surfaces and soft, natural depth, the UI feels lightweight yet structurally sound. The emotional response should be one of calm productivity and premium reliability.

## Colors
The palette is rooted in a "Clean Gallery" philosophy. The primary surface is pure white, while secondary surfaces use a subtle off-white to define functional areas like sidebars or toolbars without introducing heavy visual weight.

- **Primary Blue (#0A84FF):** Used for actionable items, active states, and focus indicators. Its weight is optimized for high legibility against white backgrounds.
- **Deep Charcoal (#1A1A1C):** Reserved for primary headings and body text to ensure maximum contrast and readability.
- **Muted Grey (#6C757D):** Used for secondary metadata, placeholders, and deactivated states.
- **Glass Overlays:** Use `rgba(255, 255, 255, 0.7)` with a 20px background blur for floating panels and navigation bars.

## Typography
This design system utilizes **Manrope** exclusively to maintain a modern, geometric, and highly legible interface.

The type scale is generous, prioritizing vertical rhythm. Headlines use tighter letter-spacing and heavier weights to anchor the page, while body copy maintains a 1.6x line-height to prevent eye fatigue during long reading sessions. All labels should be rendered in "Medium" or "SemiBold" weights to ensure they remain distinct even at smaller sizes.

## Layout & Spacing
The layout follows a **Fixed Grid** philosophy for desktop, centered within a 1440px max-width container to maintain a focused "app-like" experience.

- **Grid:** 12-column system with 24px gutters.
- **Rhythm:** All spacing (padding, margins) must be increments of the 8px base unit.
- **Desktop:** Generous 40px outer margins to provide "breathing room" typical of premium desktop software.
- **Mobile:** Elements reflow to a single column with 16px horizontal margins and reduced vertical padding between sections.

## Elevation & Depth
Depth is achieved through **Ambient Shadows** and **Glassmorphism** rather than lines. This creates a soft, tiered hierarchy.

1.  **Level 0 (Base):** `#F8F9FA` background.
2.  **Level 1 (Cards/Content):** Pure `#FFFFFF` with a very subtle 1px border (`#E9ECEF`).
3.  **Level 2 (Dropdowns/Modals):** Glassmorphic white fill with a soft drop shadow: `0 8px 30px rgba(0, 0, 0, 0.08)`.
4.  **Level 3 (Popovers):** Enhanced shadow: `0 12px 40px rgba(0, 0, 0, 0.12)`.

Avoid inner glows. Use "Natural" shadows that mimic a light source directly above the screen, resulting in shadows that are primarily offset on the Y-axis.

## Shapes
Following the MacOS aesthetic, the design system utilizes high roundedness to feel approachable and tactile.

- **Standard Elements:** 0.5rem (8px) for buttons and inputs.
- **Large Containers:** 1rem (16px) for cards and modals.
- **Extra Large:** 1.5rem (24px) for featured hero areas or side-panel groupings.

## Components

- **Buttons:** Primary buttons use the accent blue with white text. Secondary buttons use a light grey ghost style (transparent fill, `#E9ECEF` border) that fills to white on hover.
- **Chips:** Highly rounded (pill-shaped) with a `#F1F3F5` background and `#1A1A1C` text. Active chips use the primary blue with 10% opacity for the background and 100% opacity for the text.
- **Input Fields:** 8px corner radius with a 1px border. Focus state changes the border to primary blue and adds a subtle 3px blue outer glow (20% opacity).
- **Cards:** White background, 16px corner radius, and a soft 1px border. No shadow unless the card is "hovered" or "active," at which point a Level 2 shadow is applied.
- **Lists:** Use 16px vertical padding for list items to maintain the generous whitespace narrative. Hover states should use a subtle `#F8F9FA` background change.
- **Checkboxes/Radios:** Use the primary blue for selected states. Ensure the "check" icon is a crisp white for maximum visibility.
