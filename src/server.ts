import * as http from 'http';
import * as url from 'url';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/** 图片扩展名 -> Content-Type，跨平台一致 */
const MIME_TYPES: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.svgz': 'image/svg+xml'
};

/**
 * 预览会话信息
 */
export interface PreviewSession {
    id: string;
    htmlContent: string;
    filePath: string;
    /** 文档所在目录，用于解析相对路径图片 */
    basePath: string;
    createdAt: number;
    lastAccessed: number;
    /** SSE 客户端连接 */
    connections: http.ServerResponse[];
}

/**
 * HTTP服务器单例
 * 负责提供markdown预览的HTML内容服务
 */
export class PreviewServer {
    private static instance: PreviewServer | null = null;
    private server: http.Server | null = null;
    private port: number = 3000;
    private previewSessions: Map<string, PreviewSession> = new Map();
    private cleanupInterval: NodeJS.Timeout | null = null;
    private maxSessions: number = 50;
    private sessionTimeout: number = 30 * 60 * 1000; // 30分钟

    private constructor() {
        // 私有构造函数，确保单例模式
    }

    /**
     * 获取服务器单例实例
     */
    public static getInstance(): PreviewServer {
        if (!PreviewServer.instance) {
            PreviewServer.instance = new PreviewServer();
        }
        return PreviewServer.instance;
    }

    /**
     * 更新配置
     */
    public updateConfig(config: { port?: number; maxSessions?: number; sessionTimeout?: number }): void {
        if (config.port !== undefined) {
            this.port = config.port;
        }
        if (config.maxSessions !== undefined) {
            this.maxSessions = config.maxSessions;
        }
        if (config.sessionTimeout !== undefined) {
            this.sessionTimeout = config.sessionTimeout * 60 * 1000; // 转换为毫秒
        }
    }

    /**
     * 启动HTTP服务器
     */
    public async start(): Promise<number> {
        if (this.server) {
            return this.port; // 服务器已启动，返回当前端口
        }

        return new Promise((resolve, reject) => {
            const tryStart = (port: number) => {
                this.server = http.createServer((req, res) => {
                    this.handleRequest(req, res);
                });

                this.server.listen(port, '127.0.0.1', () => {
                    this.port = port;
                    console.log(`Preview server started on port ${port}`);
                    this.startCleanupTimer();
                    resolve(port);
                });

                this.server.on('error', (err: NodeJS.ErrnoException) => {
                    if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
                        // 端口被占用或无权限（如 Windows 保留端口），尝试下一个端口
                        this.server?.close();
                        this.server = null;
                        if (port < 65535) {
                            tryStart(port + 1);
                        } else {
                            reject(err);
                        }
                    } else {
                        reject(err);
                    }
                });
            };

            tryStart(this.port);
        });
    }

    /**
     * 处理HTTP请求
     */
    private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
        const parsedUrl = url.parse(req.url || '', true);
        const pathname = parsedUrl.pathname || '';

        // 设置CORS头
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        // 处理 SSE 流：/stream/{previewId}
        const streamMatch = pathname.match(/^\/stream\/(.+)$/);
        if (streamMatch && req.method === 'GET') {
            const previewId = streamMatch[1];
            const session = this.previewSessions.get(previewId);

            if (session) {
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                });
                // 发送初始心跳
                res.write(':ok\n\n');
                session.connections.push(res);
                
                req.on('close', () => {
                    session.connections = session.connections.filter(c => c !== res);
                });
            } else {
                res.writeHead(404);
                res.end();
            }
            return;
        }

        // 处理预览请求：/preview/{previewId}
        // 注意：这里的 previewId 可能是 hash 或者是 workspaceName/relativePath
        const previewMatch = pathname.match(/^\/preview\/(.+)$/);
        if (previewMatch && !pathname.includes('/asset/')) {
            const previewId = previewMatch[1];
            const session = this.previewSessions.get(previewId);

            if (session) {
                session.lastAccessed = Date.now();
                const baseUrl = `/preview/${previewId}/asset/`;
                // 相对路径 img src 重写，以便本服务器提供图片
                let rewrittenHtml = session.htmlContent.replace(
                    /(<img[^>]+src=)(["'])(?!(?:https?:|\/|data:))([^"']+)\2/gi,
                    (_, before, quote, src) => `${before}${quote}${baseUrl}${src}${quote}`
                );
                // 相对路径 a href 重写，使链接点击可打开本地文件（新标签）
                rewrittenHtml = rewrittenHtml.replace(
                    /(<a\s[^>]*?href=)(["'])(?!(?:https?:|\/|#|mailto:))([^"']+)\2/gi,
                    (_, before, quote, href) => `${before}${quote}${baseUrl}${encodeURIComponent(href)}${quote}`
                );
                res.writeHead(200, {
                    'Content-Type': 'text/html; charset=utf-8',
                    'Cache-Control': 'no-cache'
                });
                res.end(rewrittenHtml);
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Preview not found');
            }
            return;
        }

        // 处理相对路径资源：/preview/{previewId}/asset/{relativePath}
        const assetMatch = pathname.match(/^\/preview\/(.+)\/asset\/(.+)$/);
        if (assetMatch && req.method === 'GET') {
            this.servePreviewAsset(assetMatch[1], assetMatch[2], res);
            return;
        }

        // 根路径返回简单信息
        if (pathname === '/' || pathname === '') {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
                <html>
                    <head><title>Markdown Preview Server</title></head>
                    <body>
                        <h1>Markdown Preview Server</h1>
                        <p>Server is running on port ${this.port}</p>
                        <p>Active previews: ${this.previewSessions.size}</p>
                    </body>
                </html>
            `);
            return;
        }

        // 404
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
    }

    /**
     * 提供预览内的相对路径资源（图片等），路径与平台无关
     */
    private servePreviewAsset(previewId: string, urlEncodedPath: string, res: http.ServerResponse): void {
        const session = this.previewSessions.get(previewId);
        if (!session?.basePath) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found');
            return;
        }
        let relativePath: string;
        try {
            relativePath = decodeURIComponent(urlEncodedPath);
        } catch {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Bad request');
            return;
        }
        // URL 恒为正斜杠，转为当前平台分隔符后 resolve（path 模块跨平台）
        relativePath = relativePath.replace(/\//g, path.sep);
        const fullPath = path.normalize(path.resolve(session.basePath, relativePath));
        const rel = path.relative(session.basePath, fullPath);
        if (rel.startsWith('..') || path.isAbsolute(rel)) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Forbidden');
            return;
        }
        fs.readFile(fullPath, (err, data) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not found');
                return;
            }
            const ext = path.extname(fullPath).toLowerCase();
            res.writeHead(200, {
                'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
                'Cache-Control': 'private, max-age=3600'
            });
            res.end(data);
        });
    }

    /**
     * 注册或更新预览会话
     * @param htmlContent 渲染后的HTML内容
     * @param filePath 原始markdown文件路径
     * @param semanticId 可选的语义化ID (workspace/relative/path)
     * @returns 预览ID
     */
    public registerPreview(htmlContent: string, filePath: string, semanticId?: string): string {
        let previewId = semanticId;

        if (!previewId) {
            // 回退到基于 hash 的 ID
            const hash = crypto.createHash('sha256');
            hash.update(filePath + Date.now() + Math.random().toString());
            previewId = hash.digest('hex').substring(0, 16);
        }

        const existingSession = this.previewSessions.get(previewId);
        const basePath = path.dirname(filePath);

        if (existingSession) {
            existingSession.htmlContent = htmlContent;
            existingSession.lastAccessed = Date.now();
            existingSession.filePath = filePath;
            existingSession.basePath = basePath;
            // 触发更新
            this.broadcastUpdate(existingSession);
            return previewId;
        }

        // 检查会话数量限制
        if (this.previewSessions.size >= this.maxSessions) {
            this.cleanupOldestSession();
        }

        const session: PreviewSession = {
            id: previewId,
            htmlContent,
            filePath,
            basePath,
            createdAt: Date.now(),
            lastAccessed: Date.now(),
            connections: []
        };

        this.previewSessions.set(previewId, session);

        return previewId;
    }

    /**
     * 向所有连接的客户端广播更新
     */
    private broadcastUpdate(session: PreviewSession): void {
        if (session.connections.length === 0) return;

        console.log(`Broadcasting update for session: ${session.id}`);
        const data = JSON.stringify({
            event: 'update'
        });

        session.connections.forEach(res => {
            res.write(`data: ${data}\n\n`);
        });
    }

    /**
     * 向所有连接的客户端广播滚动位置
     */
    public broadcastScroll(previewId: string, line: number): void {
        const session = this.previewSessions.get(previewId);
        if (!session || session.connections.length === 0) return;

        const data = JSON.stringify({
            event: 'scroll',
            line: line
        });

        session.connections.forEach(res => {
            res.write(`data: ${data}\n\n`);
        });
    }

    /**
     * 获取预览URL
     */
    public getPreviewUrl(previewId: string): string {
        return `http://localhost:${this.port}/preview/${previewId}`;
    }

    /**
     * 启动清理定时器
     */
    private startCleanupTimer(): void {
        // 每5分钟清理一次过期会话
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredSessions();
        }, 5 * 60 * 1000);
    }

    /**
     * 清理过期会话
     */
    private cleanupExpiredSessions(): void {
        const now = Date.now();
        const expiredIds: string[] = [];

        this.previewSessions.forEach((session, id) => {
            if (now - session.lastAccessed > this.sessionTimeout) {
                expiredIds.push(id);
            }
        });

        expiredIds.forEach(id => {
            const session = this.previewSessions.get(id);
            if (session) {
                session.connections.forEach(c => c.end());
            }
            this.previewSessions.delete(id);
        });

        if (expiredIds.length > 0) {
            console.log(`Cleaned up ${expiredIds.length} expired preview sessions`);
        }
    }

    /**
     * 清理最旧的会话
     */
    private cleanupOldestSession(): void {
        let oldestId: string | null = null;
        let oldestTime = Date.now();

        this.previewSessions.forEach((session, id) => {
            if (session.createdAt < oldestTime) {
                oldestTime = session.createdAt;
                oldestId = id;
            }
        });

        if (oldestId) {
            const session = this.previewSessions.get(oldestId);
            if (session) {
                session.connections.forEach(c => c.end());
            }
            this.previewSessions.delete(oldestId);
            console.log(`Cleaned up oldest preview session: ${oldestId}`);
        }
    }

    /**
     * 停止服务器
     */
    public stop(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        if (this.server) {
            this.server.close(() => {
                console.log('Preview server stopped');
            });
            this.server = null;
        }

        // 关闭所有连接并清理所有会话
        this.previewSessions.forEach(session => {
            session.connections.forEach(c => c.end());
        });
        this.previewSessions.clear();
    }

    /**
     * 获取当前端口
     */
    public getPort(): number {
        return this.port;
    }

    /**
     * 获取服务器状态信息
     */
    public getStatus(): { isRunning: boolean; port: number; sessionCount: number; maxSessions: number } {
        return {
            isRunning: this.server !== null,
            port: this.port,
            sessionCount: this.previewSessions.size,
            maxSessions: this.maxSessions
        };
    }

    /**
     * 检查服务器是否运行
     */
    public isRunning(): boolean {
        return this.server !== null;
    }
}
