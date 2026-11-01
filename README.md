# EazyLyst (modified fork)

A Windows desktop app that turns anything you drag onto a small floating circle into a **clickable internet shortcut** saved in a folder of your choice. Built with Electron.

> This is a modified version of [EazyLyst by DanPolland8](https://github.com/DanPolland8/EazyLyst), used under its ISC license. See [What's different](#whats-different-from-the-original) for the changes.

## Features

### Floating drop box

- A small circular drop box that **always stays on top** of other windows, including full-screen apps
- Drag any link or text from any app onto the circle to capture it instantly
- **Drag the circle itself** to move it anywhere on the screen
- Colour change and scale animation while you hover over it with an item

### Shortcuts saved as `.url` files

Every item you drop is saved as a double-clickable Windows internet shortcut:

| What you drop | What gets saved |
|---|---|
| A link (`http://`, `https://`, `www.`) | A shortcut to that page, **named after the page's title**, e.g. `How to Bake Bread - Example Kitchen.url` |
| A link whose page cannot be read (offline, blocked, not a web page) | A shortcut named after the site and path, e.g. `incredible.one.url` |
| A name, a business or any other text | A shortcut that opens a Google search for that text, named after the text, e.g. `John Smith.url` |

- Existing files are never overwritten. A repeat drop is saved as `name (2).url`, `name (3).url`, and so on.
- Reading page titles needs an internet connection and can take a few seconds.
- If the folder you chose is unavailable (for example an unplugged drive), shortcuts go to the default folder instead of being lost.

### Side panel

- **Collected** tab: everything you have dropped, with colour-coded category badges (Links: blue, Business: orange, Name: green). You can rename or discard items and add them to a list.
- **Lists** tab: create, rename and delete named lists, expand them to see their items and remove individual items. Lists are saved between sessions.
- **Settings** tab:
  - **Shortcut folder**: choose where shortcuts are saved, open it in File Explorer, or reset to the default (`Documents\EazyLyst Links`). Your choice is remembered.
  - **Profile lookup** (optional): add a [Perplexity API key](https://www.perplexity.ai/settings/api) to look up social media and web profiles for dropped names and businesses.

### Auto-categorization

| Category | Detection rule |
|---|---|
| **Links** | Starts with `http://`, `https://` or `www.` |
| **Name** | 2 to 3 words in Title Case (e.g. "John Smith") |
| **Business** | Contains keywords such as Inc, LLC, Corp, Solutions, Group, Agency, etc. |
| **Business** *(default)* | Anything that does not match the above |

## What's different from the original

- Dropped items are saved as **`.url` shortcuts** with meaningful names instead of only being collected in the app.
- **CSV export removed**, including the export dialog and its code.
- **Hide/Show Overlay button removed.** The drop box is always available.
- The drop box can now be **dragged to a new position**. It is moved with JavaScript instead of a CSS drag region, which on Windows stopped the circle from receiving drops.
- **Shortcut folder setting** added to the Settings tab.

## Installation (from source)

Requirements: Windows 10 or later and [Node.js](https://nodejs.org) 20 or later (LTS recommended).

```powershell
git clone https://github.com/dr-pr-anand25/EazyLyst.git
cd EazyLyst
npm install
```

## Running the app

```powershell
npm start
```

## Building the Windows installer

```powershell
npm run build:win
```

The installer is created in the `dist` folder (for example `EazyLyst Setup 1.0.3.exe`). Run it once to install; afterwards start EazyLyst from the Start menu like any other program. To start it with Windows, put a shortcut to it in the folder that opens when you press `Win + R` and run `shell:startup`.

> **Auto-update note:** the original project checks its author's GitHub Releases for updates when the packaged app starts. In this fork that check should stay disabled so an installed copy is not replaced by the original version. In `main.js`, the line `initializeAutoUpdater();` inside `app.whenReady()` should be commented out.

## Troubleshooting

**"Electron failed to install correctly" when running `npm start`**

Newer versions of npm block install scripts by default, so Electron's files may not be downloaded. Run:

```powershell
npm install-scripts approve electron
npm install-scripts approve electron-winstaller
Remove-Item -Recurse -Force node_modules\electron
npm install
```

If the files are still missing, check that the environment variable `ELECTRON_SKIP_BINARY_DOWNLOAD` is not set.

**The circle appears but cannot be moved**

Make sure both `main.js` and `drop-target.html` are the versions from this repository, and close every running copy of the app (including an older installed one) before starting again.

## Project files

| File | Purpose |
|---|---|
| `main.js` | Main process: windows, saving shortcuts, page-title lookup, settings, data storage |
| `drop-target.html` | The floating circle: drag to move, drop to capture |
| `panel.html` | The side panel: Collected, Lists and Settings tabs |
| `classify.js` | Decides whether a dropped item is a link, a name or a business |
| `preload.js`, `overlay.html` | Supporting files from the original project |

## Credits and license

Original project: [DanPolland8/EazyLyst](https://github.com/DanPolland8/EazyLyst). This fork keeps the original **ISC** license.
