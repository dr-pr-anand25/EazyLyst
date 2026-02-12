# EazyLyst UI Description

## Application Windows

### Window 1: Circular Drop Target
**Position**: Center of screen (can be dragged anywhere)
**Size**: 150x150 pixels
**Appearance**:
- Circular shape with rounded borders
- Semi-transparent blue background (rgba(70, 130, 255, 0.5))
- White dashed border (3px)
- "Drop Here" text in white, centered
- Always stays on top of other windows

**Behavior**:
- When you drag content over it:
  - Background changes to green (rgba(70, 200, 130, 0.7))
  - Circle scales up 10% (transform: scale(1.1))
  - Border becomes solid white
- When you drop content:
  - Flashes bright green briefly
  - Sends the content to the panel
- Can be dragged to any position on screen
- Can be hidden/shown from panel

### Window 2: Right-Docked Panel
**Position**: Right side of screen, full height
**Size**: 350px wide, full screen height
**Layout**:

```
┌─────────────────────────────────────┐
│         EazyLyst                    │ ← Blue header bar
│  [Hide Overlay]  [Export CSV]      │ ← Control buttons
├─────────────────────────────────────┤
│                                     │
│  ┌───────────────────────────────┐ │
│  │ LINKS        [Rename] [Discard]│ │ ← Blue badge
│  │ https://www.example.com        │ │
│  │ Added: 2/12/2026, 12:41:09 PM  │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ BUSINESS     [Rename] [Discard]│ │ ← Orange badge
│  │ Tech Solutions Inc             │ │
│  │ Added: 2/12/2026, 12:41:15 PM  │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ NAME         [Rename] [Discard]│ │ ← Green badge
│  │ John Smith                     │ │
│  │ Added: 2/12/2026, 12:41:20 PM  │ │
│  └───────────────────────────────┘ │
│                                     │
│  ... more items ...                │
│                                     │
└─────────────────────────────────────┘
```

**Features**:
1. **Header Section** (blue background):
   - Title: "EazyLyst"
   - "Hide Overlay" button (toggles to "Show Overlay")
   - "Export CSV" button

2. **Item Cards** (white background with shadow):
   - Category badge (color-coded):
     - LINKS: Blue (#4682ff)
     - BUSINESS: Orange (#ff9500)
     - NAME: Green (#34c759)
   - Item value (word-wrapped)
   - Timestamp in gray
   - Two action buttons:
     - "Rename": Edit the item value inline
     - "Discard": Delete the item (with confirmation)

3. **Empty State** (when no items):
   - 📋 icon (large)
   - "Drop items into the circular overlay to start collecting"

### Export CSV Modal
**Appearance**: Centered overlay with white background

```
┌─────────────────────────────────┐
│  Export Options                 │
│                                 │
│  Select columns to include:     │
│                                 │
│  ☑ Category (required)          │
│  ☑ Value (required)             │
│  ☑ Timestamp                    │
│  ☑ ID                           │
│  ☑ Value Length                 │
│  ☑ Date Only                    │
│  ☑ Time Only                    │
│                                 │
│           [Cancel]  [Export]    │
└─────────────────────────────────┘
```

## Color Scheme
- **Primary Blue**: #4682ff (header, links category)
- **Success Green**: #34c759 (name category, success feedback)
- **Warning Orange**: #ff9500 (business category)
- **Danger Red**: #ff3b30 (discard button)
- **Background**: #f5f5f5 (light gray)
- **Text**: #333 (dark gray)
- **Muted Text**: #999 (light gray for timestamps)

## User Flow
1. User starts the application
2. Circular drop target appears in center of screen
3. Panel opens on the right side
4. User drags text or URL from browser/document
5. Drops it on the circular target
6. Item appears in panel with auto-assigned category
7. User can:
   - Click "Rename" to edit the label
   - Click "Discard" to remove it
   - Continue collecting more items
8. When ready, click "Export CSV" to save data
9. Select desired columns in export modal
10. Choose save location and filename
11. CSV file is created with selected data

## Categorization Examples

### Links (Blue Badge)
- https://www.google.com
- http://example.com
- www.github.com

### Business (Orange Badge)
- Acme Inc
- Tech Solutions
- Global Holdings LLC
- Microsoft Financial Services
- ABC Company

### Name (Green Badge)
- John Smith
- Jane Doe
- Bob Builder
- Mary Johnson Wilson

### Default to Business
- random text
- product description
- meeting notes
