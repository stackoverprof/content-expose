# content-expose

A lightweight content editing devtools panel for React applications. Edit your JSON content in real-time with live preview.

## Installation

```bash
npm install content-expose
# or
pnpm add content-expose
# or
yarn add content-expose
```

## Usage

### 1. Initialize in your root component

```tsx
// app/root.tsx or similar
import { initContentExpose, ContentExpose } from 'content-expose';
import rawContent from '../content.json';

// Initialize with your content
initContentExpose(rawContent);

export default function App() {
  return (
    <>
      <Outlet />
      <ContentExpose />
    </>
  );
}
```

### 2. Use content anywhere

```tsx
// Any component
import { content } from 'content-expose';

export function Navbar() {
  return <img src={content.settings.logo.url} />;
}

export function Footer() {
  return <span>{content.settings.company_name}</span>;
}
```

## Features

- **Keyboard shortcut**: Press `Cmd+E` (Mac) or `Ctrl+E` (Windows/Linux) to toggle the panel
- **Live preview**: Edit JSON and see changes immediately after clicking Preview
- **Tabbed interface**: Only shows content keys you've actually accessed
- **Draggable & resizable**: Position the panel wherever you want
- **Export**: Copy the full JSON to clipboard for easy PR creation
- **Reset**: Revert to original content at any time

## How it works

1. `initContentExpose()` stores your raw content in a singleton
2. The `content` export is a Proxy that tracks which keys are accessed
3. `ContentExpose` component shows tabs only for accessed content sections
4. Preview stores modified content in localStorage and reloads
5. The proxy returns localStorage content when available

## License

MIT
