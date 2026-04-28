# Development Documentation

This document is for developers, introducing how to participate in development and contribute code.

## Project Structure

```
markdown-preview-ext/
├── package.json              # Extension configuration and dependencies
├── tsconfig.json            # TypeScript configuration
├── .vscodeignore           # Files ignored during publishing
├── src/
│   ├── extension.ts        # Extension main entry
│   ├── markdownRenderer.ts # Markdown rendering logic
│   └── server.ts           # HTTP server
├── media/
│   └── preview.html        # HTML template
└── README.md               # Extension documentation
```

## Development Environment Setup

### Prerequisites

- Node.js (v18+ recommended)
- npm or yarn
- VSCode 1.60+

### Install Dependencies

```bash
npm install
```

### Compilation

```bash
# Compile TypeScript
npm run compile

# Compilation in watch mode (used during development)
npm run watch
```

### Debugging

1. Open this project in VSCode.
2. Press `F5` to start the Extension Development Host window.
3. Test the extension functions in the new window.
4. After modifying the code, press `Cmd+R` (Mac) or `Ctrl+R` (Windows) in the development window to reload the extension.

## Technical Architecture

### Singleton HTTP Server

- There is only one HTTP server instance throughout the extension lifecycle.
- Default listening port is 3000; if occupied, it automatically finds an available port.
- All preview requests share the same server instance.
- Starts on demand, only starting upon the first preview.

### Preview Session Isolation

- Each preview generates a unique preview ID (based on file path hash + timestamp).
- URL format: `http://localhost:{port}/preview/{previewId}`
- HTML content is stored in server memory, no temporary files are created.
- Each preview has an independent URL, without interference.

### Automatic Cleanup Mechanism

- Periodically cleans up preview sessions that haven't been accessed for more than 30 minutes (configurable).
- Limits the maximum number of sessions to 50 (configurable), cleaning up the oldest session when exceeded.
- Cleans up all sessions when the extension is deactivated.

## Resource Consumption Analysis

### Memory Consumption

**Base Memory Usage**:
- HTTP server instance: approx. 2-5 MB
- Node.js HTTP module: approx. 1-2 MB
- Extension runtime: approx. 5-10 MB

**Dynamic Memory (Preview Sessions)**:
- Each preview session: approx. 50-500 KB (depends on Markdown file size)
- Max sessions: default 50, maximum occupancy approx. 25 MB
- Automatic cleanup: sessions not accessed for over 30 minutes are automatically cleaned up.

**Total Memory Usage**: approx. 10-40 MB (depends on active sessions)

### CPU Consumption

**Normal Conditions**:
- Idle: near 0% (server is in listening state)
- Processing requests: < 1% (simple memory lookup and HTML return)

**When Rendering Markdown**:
- First preview: approx. 5-50 ms CPU time (depends on file size)
- Subsequent access: < 1 ms (directly returned from memory)

### Network Resources

**Local Network**:
- Only listens on `127.0.0.1` (localhost), does not occupy external network.
- Bandwidth consumption: almost 0 (local loopback).
- Port occupancy: default 3000 (configurable).

### Disk IO

**No Disk Operations**:
- HTML content is stored in memory, no temporary files are created.
- Only one disk read when reading the Markdown file.
- No log file writing (unless in debug mode).

## Optimization Features

1. **Singleton Mode**: Only one server instance throughout the extension lifecycle.
2. **On-demand Startup**: Server only starts during the first preview.
3. **Automatic Cleanup**: Regularly cleans up expired sessions to prevent memory leaks.
4. **Session Limit**: Up to 50 sessions, automatic cleanup of the oldest when exceeded.
5. **Lightweight**: Uses Node.js native HTTP module, no extra dependencies.

## Dependency Description

### Runtime Dependencies

- `markdown-it` - Markdown parser
- `highlight.js` - Code highlighting
- `dompurify` - HTML sanitization
- `jsdom` - DOM implementation for Node.js

### Development Dependencies

- `@types/markdown-it` - Markdown-it type definitions
- `@types/node` - Node.js type definitions
- `@types/vscode` - VSCode API type definitions
- `typescript` - TypeScript compiler
- `@types/dompurify` - DOMPurify type definitions
- `@types/jsdom` - JSDOM type definitions

## Packaging and Publishing

### Local Packaging

```bash
npm run vsix
```

(Internally executes compile + vsce package, including dependencies. Do not manually type `vsce package --no-dependencies`.)

### Publishing to Marketplace

Refer to [PUBLISH_STEPS-EN.md](./PUBLISH_STEPS-EN.md)

## Code Standards

- Written in TypeScript
- Follows VSCode extension development best practices
- UTF-8 encoding

## Contribution Guide

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Testing

Currently relies mainly on manual testing. Recommended test scenarios:

- [ ] Basic Markdown syntax rendering
- [ ] Code block syntax highlighting
- [ ] Mermaid diagram rendering
- [ ] Table rendering
- [ ] Context menu functions
- [ ] Command palette functions
- [ ] Server start/stop/restart
- [ ] Configuration changes taking effect
- [ ] Simultaneous multiple file preview
- [ ] Session automatic cleanup

## Known Issues

- None

## Planned Features

- [ ] Support real-time preview (auto-refresh after file modification)
- [ ] Support custom CSS themes
- [ ] Support more Mermaid diagram types
- [ ] Add unit tests

## License

MIT License

## Author

kejiqing
