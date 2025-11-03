import * as vscode from 'vscode';
import { NovelProvider, Chapter } from './novelProvider';

export class NovelReader {
    private panel: vscode.WebviewPanel | undefined;
    private currentChapter: Chapter | null = null;

    constructor(
        private context: vscode.ExtensionContext,
        private novelProvider: NovelProvider
    ) {
        this.setupEventListeners();
    }

    private setupEventListeners() {
        // 监听章节变化
        this.novelProvider.onChapterChange((chapter) => {
            this.currentChapter = chapter;
            if (this.panel) {
                this.updateWebview();
            }
        });
    }

    public openNovelInTab() {
        if (!this.novelProvider.hasChapters()) {
            vscode.window.showWarningMessage('请先选择小说文件夹');
            return;
        }

        this.currentChapter = this.novelProvider.getCurrentChapter();
        
        if (this.panel) {
            // 如果面板已存在，则显示它
            this.panel.reveal(vscode.ViewColumn.One);
        } else {
            // 创建新的webview面板
            this.panel = vscode.window.createWebviewPanel(
                'novelReader',
                '小说阅读器',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            // 设置webview内容
            this.updateWebview();

            // 处理webview消息
            this.panel.webview.onDidReceiveMessage(
                message => {
                    switch (message.command) {
                        case 'previousChapter':
                            this.novelProvider.previousChapter();
                            break;
                        case 'nextChapter':
                            this.novelProvider.nextChapter();
                            break;
                        case 'searchChapter':
                            vscode.commands.executeCommand('novelReader.searchChapter');
                            break;
                    }
                },
                undefined,
                this.context.subscriptions
            );

            // 当面板被关闭时清理
            this.panel.onDidDispose(
                () => {
                    this.panel = undefined;
                },
                null,
                this.context.subscriptions
            );
        }
    }

    private updateWebview() {
        if (!this.panel || !this.currentChapter) {
            return;
        }

        const config = vscode.workspace.getConfiguration('novelReader');
        const fontSize = config.get<number>('fontSize', 14);
        const lineHeight = config.get<number>('lineHeight', 1.6);
        const info = this.novelProvider.getChapterInfo();

        this.panel.title = `小说阅读器 - ${this.currentChapter.title}`;
        this.panel.webview.html = this.getWebviewContent(
            this.currentChapter,
            info,
            fontSize,
            lineHeight
        );
    }

    private getWebviewContent(
        chapter: Chapter,
        info: { current: number; total: number },
        fontSize: number,
        lineHeight: number
    ): string {
        const content = chapter.content
            .replace(/\r\n/g, '<br>')
            .replace(/\n/g, '<br>')
            .replace(/\s{2,}/g, '&nbsp;&nbsp;');

        return `
            <!DOCTYPE html>
            <html lang="zh-CN">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${chapter.title}</title>
                <style>
                    body {
                        font-family: 'Microsoft YaHei', '微软雅黑', Arial, sans-serif;
                        font-size: ${fontSize}px;
                        line-height: ${lineHeight};
                        width: 100%;
                        height: 100vh;
                        margin: 0;
                        padding: 20px;
                        box-sizing: border-box;
                        background-color: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                        overflow-x: hidden;
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 20px;
                        padding-bottom: 10px;
                        border-bottom: 1px solid var(--vscode-panel-border);
                    }
                    .chapter-title {
                        font-size: ${fontSize + 4}px;
                        font-weight: bold;
                        margin: 0;
                    }
                    .chapter-info {
                        color: var(--vscode-descriptionForeground);
                        font-size: ${fontSize - 2}px;
                    }
                    .navigation {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 20px;
                        gap: 10px;
                    }
                    .nav-button {
                        background-color: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                        border: 1px solid var(--vscode-panel-border);
                        padding: 6px 12px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: ${fontSize - 2}px;
                        transition: background-color 0.2s, border-color 0.2s;
                    }
                    .nav-button:hover {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border-color: var(--vscode-focusBorder);
                    }
                    .nav-button:disabled {
                        opacity: 0.6;
                        cursor: not-allowed;
                    }
                    .content {
                        text-align: justify;
                        text-indent: 2em;
                        margin-bottom: 40px;
                        width: 100%;
                        word-wrap: break-word;
                        word-break: break-all;
                        white-space: pre-wrap;
                    }
                    .content p {
                        margin-bottom: 1em;
                        width: 100%;
                    }
                    .footer {
                        text-align: center;
                        padding-top: 20px;
                        border-top: 1px solid var(--vscode-panel-border);
                        color: var(--vscode-descriptionForeground);
                        font-size: ${fontSize - 2}px;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1 class="chapter-title">${chapter.title}</h1>
                    <div class="chapter-info">第 ${info.current} / ${info.total} 章</div>
                </div>
                
                <div class="navigation">
                    <button class="nav-button" onclick="previousChapter()" ${info.current <= 1 ? 'disabled' : ''}>
                        上一章
                    </button>
                    <button class="nav-button" onclick="searchChapter()">
                        目录
                    </button>
                    <button class="nav-button" onclick="nextChapter()" ${info.current >= info.total ? 'disabled' : ''}>
                        下一章
                    </button>
                </div>
                
                <div class="content">
                    ${content}
                </div>
                
                <div class="footer">
                    <div class="navigation">
                        <button class="nav-button" onclick="previousChapter()" ${info.current <= 1 ? 'disabled' : ''}>
                            上一章
                        </button>
                        <button class="nav-button" onclick="searchChapter()">
                            目录
                        </button>
                        <button class="nav-button" onclick="nextChapter()" ${info.current >= info.total ? 'disabled' : ''}>
                            下一章
                        </button>
                    </div>
                </div>
                
                <script>
                    const vscode = acquireVsCodeApi();
                    
                    function previousChapter() {
                        vscode.postMessage({ command: 'previousChapter' });
                    }
                    
                    function nextChapter() {
                        vscode.postMessage({ command: 'nextChapter' });
                    }
                    
                    function searchChapter() {
                        vscode.postMessage({ command: 'searchChapter' });
                    }
                    
                    // 键盘快捷键支持
                    document.addEventListener('keydown', function(event) {
                        if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
                            previousChapter();
                        } else if (event.key === 'ArrowRight' || event.key === 'PageDown') {
                            nextChapter();
                        } else if (event.key === 'Escape') {
                            searchChapter();
                        }
                    });
                </script>
            </body>
            </html>
        `;
    }
}