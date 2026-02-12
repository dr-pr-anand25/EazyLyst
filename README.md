# EazyLyst

A lightweight Windows desktop app (Electron) that lets you quickly collect and categorize text and links from any application via drag‑and‑drop.

## Features

- **Circular overlay** – a small transparent circle, always on top, acts as a drag‑and‑drop target.
- **Side panel** – a right‑docked window showing captured items organized into three categories:
  - **Name** – detected person names (2–3 capitalized words)
  - **Business** – business names (suffixes like Inc, LLC, Ltd, etc. and keywords like Bank, Financial, Holdings, etc.)
  - **Links** – URLs (http://, https://, www.)
- **Automatic classification** using heuristic rules.
- **Rename labels** – click any section label in the panel to rename it.
- **CSV export** with six format options:
  1. Category,Value (default)
  2. Value,Category
  3. Grouped with blank lines
  4. With ID column
  5. With Timestamp column
  6. Category row with pipe‑separated values
- **Toggle Circle** / **Discard** buttons for quick control.

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm (comes with Node.js)

## Getting Started

```bash
# Install dependencies
npm install

# Start the app
npm start
```

## Running Tests

```bash
npm test
```

## How to Use

1. Launch the app — a blue dashed circle appears in the center of the screen and the side panel docks to the right.
2. Highlight text or a URL in any application and drag it onto the circle.
3. The item is automatically classified and appears in the panel.
4. Rename categories by clicking their label text.
5. Click **Save CSV** to choose an export format and save.
6. Click **Discard** to clear all items.
7. Click **Toggle Circle** to show/hide the overlay.
