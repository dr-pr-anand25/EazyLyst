# EazyLyst (modified fork)

A Windows desktop app that turns anything you drag onto a small floating circle into a **clickable internet shortcut** saved in a folder of your choice. Built with Electron.

> This is a modified version of [EazyLyst by DanPolland8](https://github.com/DanPolland8/EazyLyst), used under its ISC license. See [What's different](#whats-different-from-the-original) for the changes.

## Features

### Floating drop box

- A small circular drop box that **always stays on top** of other windows, including full-screen apps
- Starts **near the top of the screen**, close to a browser's address bar, so you can drag a link straight from the address bar onto it
- **Drag the circle** to move it. It remembers where you put it and returns there the next time you start the app
- **Double-click the circle** to open the folder where your shortcuts are saved. If that folder is already open, its window is brought to the front instead of opening another one
- **Hide Dropbox / Show Dropbox** button in the panel header
- Colour change and scale animation while you hover over it with an item

### One copy at a time

Only one EazyLyst runs at once. Starting it again brings the existing panel to the front and shows the drop box if it was hidden, instead of opening a second copy.

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
- A link is saved exactly as dropped. If its address contains a login token, that token is saved in the shortcut too, so do not share those files.

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
- The drop box can be **dragged to a new position**, and the position is remembered. It is moved with JavaScript instead of a CSS drag region, which on Windows stopped the circle from receiving drops.
- The drop box starts **near the top of the screen** instead of the middle.
- **Double-clicking** the drop box opens (or re-focuses) the shortcuts folder.
- **Shortcut folder setting** added to the Settings tab.
- **Single instance:** a second launch no longer opens a second copy.

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

The terminal stays busy while the app runs. Close the panel window, or press `Ctrl + C` in the terminal, to stop it.

## Building the Windows installer

```powershell
npm run build:win
```

The installer is created in the `dist` folder (for example `EazyLyst Setup 1.0.3.exe`). Uninstall any older installed copy first, then run the installer once. Afterwards start EazyLyst from the Start menu like any other program. To start it with Windows, put a shortcut to it in the folder that opens when you press `Win + R` and run `shell:startup`.

> **Auto-update note:** the original project checks its author's GitHub Releases for updates when the packaged app starts. In this fork that check should stay disabled so an installed copy is not replaced by the original version. In `main.js`, the line `initializeAutoUpdater();` inside `app.whenReady()` should be commented out (`// initializeAutoUpdater();`).

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

**The circle appears but cannot be moved, or old behaviour keeps showing up**

Make sure `main.js`, `panel.html` and `drop-target.html` are the versions from this repository, and close every running copy of the app (including an older installed one, and any Electron entries in Task Manager) before starting again.

**A circle is visible even though the app is closed**

If you are viewing a preview of `drop-target.html` in a browser or chat page, that circle is only the web page and not the app.

## Project files

| File | Purpose |
|---|---|
| `main.js` | Main process: windows, single-instance lock, saving shortcuts, page-title lookup, settings, data storage |
| `drop-target.html` | The floating circle: drag to move, drop to capture, double-click to open the folder |
| `panel.html` | The side panel: Collected, Lists and Settings tabs, Hide/Show Dropbox button |
| `classify.js` | Decides whether a dropped item is a link, a name or a business |
| `preload.js`, `overlay.html` | Supporting files from the original project |

## Credits and license

Original project: [DanPolland8/EazyLyst](https://github.com/DanPolland8/EazyLyst). This fork keeps the original **ISC** license.
