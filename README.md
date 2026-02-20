# EazyLyst

A desktop app for capturing, categorizing, and organizing text and URLs via drag-and-drop. Built with Electron.

## Features

### Circular Drop Target
- **Always-on-top transparent circular overlay** that sits above all other windows
- Drag any text or URL from any app onto the circle to capture it instantly
- Visual feedback (color change + scale animation) when hovering over the target
- Draggable — reposition it anywhere on screen
- Can be hidden/shown from the panel when not in use

### Auto-Categorization
Every dropped item is automatically assigned a category:

| Category | Detection rule |
|---|---|
| **Links** | Starts with `http://`, `https://`, or `www.` |
| **Name** | 2–3 words in Title Case (e.g. "John Smith") |
| **Business** | Contains keywords like Inc, LLC, Corp, Solutions, Group, Agency, etc. |
| **Business** *(default)* | Anything that doesn't match the above |

### Collected Tab
The right-docked panel shows all captured items with color-coded category badges (Links: blue, Business: orange, Name: green). From here you can:
- **Rename** any item inline
- **Discard** items you no longer need
- **Add to List** — send any item into one of your named Lists
- **Export CSV** with customizable columns:
  - Category, Value (always included)
  - ID, Timestamp, Date Only, Time Only, Value Length (optional)

### Lists Tab
Create persistent, named lists to organize your captured items:
- **Create** a new list by typing a name and pressing Enter
- **Rename** any list inline
- **Delete** a list (with confirmation)
- **Expand/collapse** lists to view their contents
- **Remove individual items** from a list
- Lists and their contents are saved between sessions

## Installation

```bash
npm install
```

## Running the App

```bash
npm start
```

## Building

### Build for your current platform

```bash
npm run build
```

### Build for Windows

```bash
npm run build:win
```

### Build for macOS

```bash
npm run build:mac
```

Build artifacts are created in the `dist` folder.

## Automatic Updates

The packaged app checks for updates automatically at startup. If an update is available it downloads in the background and prompts you to restart. Update metadata is sourced from GitHub Releases on this repository.

### Releasing a new version

1. Bump the version in `package.json`
2. Commit and push to `main`
3. Create and push a version tag: `git tag v1.0.3 && git push origin v1.0.3`
4. The **Release Desktop Artifacts** GitHub Actions workflow builds and publishes the installers automatically

## Usage

1. Launch EazyLyst — the circular drop target and panel open automatically
2. Drag text or a URL from any application onto the circle
3. The item appears in the **Collected** tab, already categorized
4. Optionally add items to a named **List** for further organization
5. Export your collection or individual lists to CSV at any time

## Requirements

- Windows 10+ or macOS 12+
- Node.js 20 or later (for development)

## License

ISC

