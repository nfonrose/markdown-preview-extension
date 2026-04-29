import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';
import { MarkdownRenderer } from './markdownRenderer';
import { PreviewServer } from './server';

let previewServer: PreviewServer | null = null;
let extensionContext: vscode.ExtensionContext | null = null;
const updateDebounceMap = new Map<string, NodeJS.Timeout>();
const scrollThrottleMap = new Map<string, NodeJS.Timeout>();

/**
 * 扩展激活时调用
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('Markdown Preview Extension is now active!');

    extensionContext = context;

    // 获取服务器单例
    previewServer = PreviewServer.getInstance();

    // 加载配置并更新服务器设置
    loadConfiguration();

    // 监听配置变化
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('markdownPreview')) {
                loadConfiguration();
            }
        })
    );

    // 监听文档变化以便自动刷新
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.languageId === 'markdown') {
                handleDocumentChange(e.document);
            }
        })
    );

    // 监听编辑器滚动以便同步滚动
    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorVisibleRanges(e => {
            if (e.textEditor.document.languageId === 'markdown') {
                handleEditorScroll(e.textEditor);
            }
        })
    );

    // 注册命令
    const commands = [
        vscode.commands.registerCommand('markdownPreview.previewInBrowser', previewMarkdownInBrowser),
        vscode.commands.registerCommand('markdownPreview.startServer', startServer),
        vscode.commands.registerCommand('markdownPreview.stopServer', stopServer),
        vscode.commands.registerCommand('markdownPreview.restartServer', restartServer),
        vscode.commands.registerCommand('markdownPreview.showServerStatus', showServerStatus)
    ];

    commands.forEach(cmd => context.subscriptions.push(cmd));

    // 扩展停用时清理资源
    context.subscriptions.push({
        dispose: () => {
            if (previewServer) {
                previewServer.stop();
                previewServer = null;
            }
            updateDebounceMap.forEach(timeout => clearTimeout(timeout));
            updateDebounceMap.clear();
            scrollThrottleMap.forEach(timeout => clearTimeout(timeout));
            scrollThrottleMap.clear();
        }
    });
}

/**
 * 处理文档变化
 */
function handleDocumentChange(document: vscode.TextDocument) {
    const filePath = document.uri.fsPath;
    
    // 清除旧的定时器
    if (updateDebounceMap.has(filePath)) {
        clearTimeout(updateDebounceMap.get(filePath)!);
    }

    // 设置新的定时器（防抖 300ms）
    const timeout = setTimeout(async () => {
        updateDebounceMap.delete(filePath);
        if (previewServer && previewServer.isRunning()) {
            const semanticId = getSemanticId(document.uri);
            if (semanticId) {
                const renderer = new MarkdownRenderer();
                const htmlContent = renderer.render(document.getText());
                previewServer.registerPreview(htmlContent, filePath, semanticId);
            }
        }
    }, 300);

    updateDebounceMap.set(filePath, timeout);
}

/**
 * 处理编辑器滚动
 */
function handleEditorScroll(editor: vscode.TextEditor) {
    const filePath = editor.document.uri.fsPath;
    
    // 节流处理 (50ms)
    if (scrollThrottleMap.has(filePath)) {
        return;
    }

    const timeout = setTimeout(() => {
        scrollThrottleMap.delete(filePath);
        if (previewServer && previewServer.isRunning()) {
            const semanticId = getSemanticId(editor.document.uri);
            if (semanticId) {
                const topVisibleLine = editor.visibleRanges[0].start.line;
                previewServer.broadcastScroll(semanticId, topVisibleLine);
            }
        }
    }, 50);

    scrollThrottleMap.set(filePath, timeout);
}

/**
 * 获取语义化 ID: workspaceName/relativePath
 */
function getSemanticId(uri: vscode.Uri): string | undefined {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
        return undefined;
    }

    const workspaceName = workspaceFolder.name;
    const relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
    
    // 统一使用正斜杠，并进行 URL 编码
    const normalizedRelativePath = relativePath.split(path.sep).join('/');
    return `${workspaceName}/${normalizedRelativePath}`;
}

/**
 * 在浏览器中预览markdown文件
 */
async function previewMarkdownInBrowser(): Promise<void> {
    try {
        // 获取当前活动的编辑器
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || activeEditor.document.languageId !== 'markdown') {
            vscode.window.showWarningMessage('Please open a markdown file in the editor first.');
            return;
        }

        const document = activeEditor.document;
        const filePath = document.uri.fsPath;

        // 渲染markdown为HTML
        const renderer = new MarkdownRenderer();
        const htmlContent = renderer.render(document.getText());

        // 确保服务器已启动
        if (!previewServer) {
            previewServer = PreviewServer.getInstance();
        }
        const port = await previewServer.start();

        // 获取语义化 ID
        const semanticId = getSemanticId(document.uri);

        // 注册预览会话
        const previewId = previewServer.registerPreview(htmlContent, filePath, semanticId);

        // 构建预览URL，添加 autoRefresh=1
        let previewUrl = previewServer.getPreviewUrl(previewId);
        previewUrl += '?autoRefresh=1';

        // 在外部浏览器中打开
        await openExternalBrowser(previewUrl);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to preview markdown: ${errorMessage}`);
        console.error('Preview error:', error);
    }
}

/**
 * 使用系统默认浏览器打开 URL
 */
function openExternalBrowser(url: string): Promise<void> {
    const fallback = (): Thenable<boolean> =>
        vscode.env.openExternal(vscode.Uri.parse(url));

    return new Promise((resolve, reject) => {
        const platform = process.platform as string;
        const { command, args } = getOpenCommand(platform, url);

        if (!command) {
            fallback().then(() => resolve(), reject);
            return;
        }

        try {
            const child = child_process.spawn(command, args, {
                detached: true,
                stdio: 'ignore'
            });

            child.on('error', (err: NodeJS.ErrnoException) => {
                console.warn(`[Markdown Preview] open failed: ${err.message}, using fallback`);
                fallback().then(() => resolve(), reject);
            });

            child.unref();
            resolve();
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(`[Markdown Preview] spawn failed: ${msg}, using fallback`);
            fallback().then(() => resolve(), reject);
        }
    });
}

/**
 * 各平台打开 URL 的标准命令
 */
function getOpenCommand(platform: string, url: string): { command: string | null; args: string[] } {
    switch (platform) {
        case 'win32':
            return { command: 'cmd', args: ['/c', 'start', '', url] };
        case 'darwin':
            return { command: 'open', args: [url] };
        case 'linux':
        case 'freebsd':
        case 'openbsd':
        default:
            return { command: 'xdg-open', args: [url] };
    }
}

/**
 * 加载配置
 */
function loadConfiguration(): void {
    const config = vscode.workspace.getConfiguration('markdownPreview');
    if (previewServer) {
        previewServer.updateConfig({
            port: config.get<number>('serverPort', 3000),
            maxSessions: config.get<number>('maxSessions', 50),
            sessionTimeout: config.get<number>('sessionTimeout', 30)
        });
    }
}

/**
 * 启动服务器
 */
async function startServer(): Promise<void> {
    try {
        if (!previewServer) {
            previewServer = PreviewServer.getInstance();
            loadConfiguration();
        }
        if (previewServer.isRunning()) {
            vscode.window.showInformationMessage('Preview server is already running.');
            return;
        }
        const port = await previewServer.start();
        vscode.window.showInformationMessage(`Preview server started on port ${port}`);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to start server: ${errorMessage}`);
    }
}

/**
 * 停止服务器
 */
function stopServer(): void {
    if (!previewServer || !previewServer.isRunning()) {
        vscode.window.showInformationMessage('Preview server is not running.');
        return;
    }
    previewServer.stop();
    vscode.window.showInformationMessage('Preview server stopped.');
}

/**
 * 重启服务器
 */
async function restartServer(): Promise<void> {
    if (previewServer && previewServer.isRunning()) {
        previewServer.stop();
        // 等待一下确保完全停止
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    await startServer();
    vscode.window.showInformationMessage('Preview server restarted.');
}

/**
 * 显示服务器状态
 */
function showServerStatus(): void {
    if (!previewServer) {
        previewServer = PreviewServer.getInstance();
        loadConfiguration();
    }
    const status = previewServer.getStatus();
    const statusMessage = status.isRunning
        ? `Server Status:\n- Running: Yes\n- Port: ${status.port}\n- Active Sessions: ${status.sessionCount}/${status.maxSessions}`
        : `Server Status:\n- Running: No\n- Port: ${status.port}\n- Active Sessions: ${status.sessionCount}/${status.maxSessions}`;
    
    vscode.window.showInformationMessage(statusMessage);
}

/**
 * 扩展停用时调用
 */
export function deactivate() {
    if (previewServer) {
        previewServer.stop();
        previewServer = null;
    }
}
