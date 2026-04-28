# Resource Consumption Explanation

## Web Server Resource Consumption Analysis

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

## Configuration Options

The following parameters can be adjusted in VSCode settings:

- `markdownPreview.serverPort`: Server port (default 3000)
- `markdownPreview.maxSessions`: Maximum number of sessions (default 50)
- `markdownPreview.sessionTimeout`: Session timeout in minutes (default 30)
- `markdownPreview.autoStartServer`: Whether to start automatically (default true)

## Server Control Commands

The following commands are available via the Command Palette (`Cmd+Shift+P`):

- **Start Preview Server**: Manually start the server.
- **Stop Preview Server**: Stop the server.
- **Restart Preview Server**: Restart the server.
- **Show Server Status**: Display server status (running status, port, session count).

## Performance Suggestions

1. **Normal Use**: The default configuration is sufficient; resource consumption is very low.
2. **Heavy Use**: If you frequently preview many files, you can increase `maxSessions`.
3. **Memory Sensitive**: If memory is tight, you can decrease `maxSessions` or shorten `sessionTimeout`.
4. **Port Conflict**: If port 3000 is occupied, it will automatically find an available port.

## Monitoring

You can monitor resource usage in the following ways:

1. **Check Server Status**: Use the command "Show Server Status".
2. **VSCode Process Explorer**: View the resource usage of the extension process.
3. **System Monitoring Tools**: macOS Activity Monitor / Windows Task Manager.

## Conclusion

The resource consumption of this extension is very low:
- ✅ Memory: 10-40 MB (configurable)
- ✅ CPU: < 1% (normal conditions)
- ✅ Network: Local only, no external requests
- ✅ Disk: Almost no IO operations
- ✅ Auto-optimization: Automatically cleans up expired resources

It is suitable for long-term operation without significantly impacting system performance.
