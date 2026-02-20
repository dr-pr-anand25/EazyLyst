# EazyLyst

A desktop Electron app for collecting and categorizing dropped text and URLs.

## Features

### Circular Drop Target
- **Always-on-top transparent circular overlay** that accepts drag-and-drop
- Positioned in the center of the screen
- Visual feedback when dragging items over it
- Can be toggled on/off from the panel

### Auto-Categorization
Items are automatically categorized into three types:

1. **Links**: URLs starting with `http://`, `https://`, or `www.`
2. **Business**: Items containing business keywords:
   - Legal entities: Inc, LLC, Ltd, Corp, Corporation
   - Business types: Solutions, Group, Systems, Holdings, Partners, Ventures, Bank, Financial, Services, Industries, Enterprises
   - Common business words: Company, Firm, Agency, Capital, Investment, Management, Consulting
3. **Name**: 2-3 capitalized words (e.g., "John Smith", "Jane Doe Wilson")
4. **Default**: Any other text defaults to Business category

### Panel Features
- **Right-docked panel** displaying all collected items
- **Rename labels**: Click "Rename" to edit any item's value
- **Discard items**: Remove items you don't need
- **Toggle overlay**: Show/hide the circular drop target
- **Export CSV**: Export your collection with customizable columns:
  - Category (required)
  - Value (required)
  - ID (optional)
  - Timestamp (optional)
  - Date Only (optional)
  - Time Only (optional)
  - Value Length (optional)

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

## Usage

1. Start the application
2. A circular drop target will appear in the center of your screen
3. The panel window will open on the right side
4. Drag and drop text or URLs onto the circular target
5. Items will automatically be categorized and appear in the panel
6. Use the panel to:
   - Rename items by clicking the "Rename" button
   - Discard items you don't need
   - Toggle the drop target visibility
   - Export your collection to CSV

## Technical Details

- Built with Electron 28
- Uses transparent, always-on-top windows for the drop target
- Implements IPC communication between windows
- Drag-and-drop API for capturing text and URLs
- CSV export with customizable options

## Requirements

- Windows 10+ or macOS 12+
- Node.js 18 or later

## License

ISC

