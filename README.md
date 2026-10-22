# AI in Everyday Life and Computer Engineering

**Live site:** https://mesleki-ingilizce-sunum.vercel.app

A scroll-driven presentation for our Professional English course. As you scroll, a robot head comes apart
frame by frame, and its five parts become the five sections of the talk.

**Presented by** Hasan Batuhan Kılıçkan and Samet Burak Gülten

## Contents

1. **Introduction**: AI in Everyday Life and Computer Engineering · Agenda
2. **Understanding AI**: What Is AI? · A Brief History of AI
3. **AI in Daily Life**: Everyday Examples · Benefits and Risks
4. **AI in Our Field**: AI Tools and Use Cases · How LLMs Work · Basic vs. Technical Prompts · Token Efficiency and Accuracy
5. **Conclusion**: Using AI Responsibly · Key Takeaways

## Presenting from the site

| Key | Action |
| --- | --- |
| → ↓ Space Page Down Enter | Next step (works with most presentation clickers) |
| ← ↑ Shift+Space Page Up | Previous step |
| Home / End | First / last step |
| F | Fullscreen |

The steps are: title → contents → each of the five sections → presenters.

## How it works

- A 10-second, 24 fps render was split into 240 frames and saved as WebP (`frames-webp/`, 1920×1080).
- The frames are preloaded and drawn on a `<canvas>`. GSAP ScrollTrigger maps the scroll position to the frame
  number and pins the scene while it plays.
- On phones a virtual camera follows the action, so no part of the robot is cut off at narrow widths.
- GSAP SplitText, ScrollSmoother and ScrollToPlugin handle the text reveals, smooth scrolling and keyboard navigation.
- The whole site is a single `index.html` with no build step. Visitors who prefer reduced motion get a static version.

## Run locally

Open `index.html` in a browser, or serve the folder with any static server, for example `npx serve .`

## Project files

| Path | Purpose |
| --- | --- |
| `index.html` | The site: markup, styles and scripts |
| `frames-webp/` | The 240 animation frames |
| `og.jpg` | Preview image shown when the link is shared |
| `favicon.svg` | Browser tab icon |
| `vercel.json` | Hosting configuration for Vercel |
