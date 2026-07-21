# HTML Spark Editor

[简体中文](README.md) | [English](README_EN.md)

A browser-based visual HTML editor that feels like PowerPoint.

Import an existing static HTML file, edit its text, styles, position, and size visually, then export a complete HTML file again. No backend or database is required.

## Try It Online

- Cloudflare: [https://html-spark-editor.pages.dev/](https://html-spark-editor.pages.dev/)
- Vercel mirror: [https://html-spark-editor.vercel.app/](https://html-spark-editor.vercel.app/)

## How to Use

1. Click **Import HTML** and choose a local `.html` or `.htm` file.
2. Click text or an element on the page to select it.
3. Click selected text again, or press `Enter` / `F2`, to edit it.
4. Use the right toolbar to change the font, size, color, background, and text formatting.
5. Drag an element to move it, or drag the handles around the blue selection box to resize it.
6. Click **Export HTML** to download the edited file.

## Features

- Import and preview existing static HTML files
- Select, move, and resize elements in eight directions
- Edit page text directly
- Change font family, font size, text color, and text background color
- Bold, italic, underline, and upper/lowercase conversion
- Apply formatting to only the selected characters
- Numbered lists, bullet lists, and automatic list continuation on Enter
- Find and replace, including mixed Chinese/English text across inline style tags
- Recently used colors and standard color presets
- Smart alignment guides and snapping
- Select and move outer layout containers
- Copy, paste, delete, and adjust z-index
- Fine-tune position with keyboard arrow keys
- Undo and redo with up to 50 history states
- Pre-export checks for broken images, empty links, garbled text, and off-canvas elements
- Export clean, complete HTML without editor-only markers

## Scripts and Safety

Scripts from imported pages do not run inside the editor. Link navigation, form submission, and original button actions are also blocked while editing.

Preserved scripts are restored during export, so animations, carousels, menus, and other original behavior may continue to work in the exported page. Only import and open HTML files you trust.

## Local Development

Install Node.js, then run:

```bash
npm install
npm run dev
```

Open the local address shown in the terminal, usually:

```text
http://localhost:5173/
```

Type checking and production build:

```bash
npm run typecheck
npm run build
```

## Tech Stack

- React
- TypeScript
- Vite
- interact.js
- iframe and native DOM APIs

The project runs entirely in the browser and does not use a backend, database, or AI service.

## Current Limitations

- Primarily supports static HTML, native CSS, inline styles, and `<style>` tags.
- React, Vue, Next.js, and other source projects that require a build step cannot be imported directly.
- Local relative images, fonts, and other assets are not bundled automatically and may not load in preview.
- Remote assets still depend on network access and the provider's access policies.
- Complex JavaScript apps, SVG, tables, CSS transforms, and unusual positioning contexts may not preserve their original behavior perfectly.
- Browsers may normalize parts of the HTML, so exported files are not guaranteed to be byte-for-byte identical to the originals.

## Deployment

Run `npm run build`, then deploy the generated `dist` directory to Cloudflare Pages, Vercel, Netlify, or another static hosting provider.
