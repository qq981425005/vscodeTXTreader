"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusBarReader = void 0;
const vscode = require("vscode");
class StatusBarReader {
    constructor(context, novelProvider) {
        this.context = context;
        this.novelProvider = novelProvider;
        this.isVisible = false;
        this.currentChapter = null;
        this.hideTimer = null;
        this.HIDE_DELAY = 10000; // 10秒
        this.currentLineIndex = 0;
        this.contentLines = [];
        this.contentFullLines = [];
        this.contentVisible = false;
        this.MAX_STATUS_TEXT_LENGTH = 60; // 状态栏可见最大字符数（分段显示）
        // 创建状态栏项目
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.prevButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 103);
        this.nextButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 102);
        // 新增：上一行/下一行按钮
        this.upButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 105);
        this.downButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 104);
        this.chapterInfo = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 101);
        this.setupStatusBarItems();
        this.setupEventListeners();
        // 添加到订阅列表
        this.context.subscriptions.push(this.statusBarItem, this.prevButton, this.nextButton, this.upButton, this.downButton, this.chapterInfo);
    }
    setupStatusBarItems() {
        // 上一章按钮
        this.prevButton.text = '$(chevron-left)';
        this.prevButton.command = 'novelReader.statusBar.previousChapter';
        this.prevButton.tooltip = '阅读上一章';
        // 下一章按钮
        this.nextButton.text = '$(chevron-right)';
        this.nextButton.command = 'novelReader.statusBar.nextChapter';
        this.nextButton.tooltip = '阅读下一章';
        // 新增：上一行/下一行按钮
        this.upButton.text = '$(chevron-up)';
        this.upButton.command = 'novelReader.previousLine';
        this.upButton.tooltip = '上一行';
        this.downButton.text = '$(chevron-down)';
        this.downButton.command = 'novelReader.nextLine';
        this.downButton.tooltip = '下一行';
        // 章节信息
        this.chapterInfo.command = 'novelReader.statusBar.searchChapter';
        this.chapterInfo.tooltip = '点击搜索章节';
        // 主要内容区域
        this.statusBarItem.command = 'novelReader.statusBar.toggleContent';
        this.statusBarItem.tooltip = '点击隐藏/显示小说内容';
    }
    setupEventListeners() {
        // 监听章节变化
        this.novelProvider.onChapterChange((chapter) => {
            this.currentChapter = chapter;
            this.updateDisplay();
        });
        // 注册状态栏专用命令
        this.registerStatusBarCommands();
    }
    updateDisplay() {
        if (!this.isVisible || !this.currentChapter) {
            return;
        }
        // 更新章节信息
        const info = this.novelProvider.getChapterInfo();
        this.chapterInfo.text = `${info.current}/${info.total}`;
        // 准备内容行：对过长的行进行分段，以便在状态栏完整展示
        const content = this.currentChapter.content || '';
        const rawLines = content.split('\n').filter(line => line.trim() !== '');
        this.contentLines = [];
        this.contentFullLines = [];
        // 首先添加章节标题作为第一行
        const chapterTitle = this.currentChapter.title || '未知章节';
        if (chapterTitle.length <= this.MAX_STATUS_TEXT_LENGTH) {
            this.contentLines.push(chapterTitle);
            this.contentFullLines.push(chapterTitle);
        }
        else {
            const titleChunks = this.chunkString(chapterTitle, this.MAX_STATUS_TEXT_LENGTH);
            for (const chunk of titleChunks) {
                this.contentLines.push(chunk);
                this.contentFullLines.push(chapterTitle); // tooltip 显示完整章节标题
            }
        }
        // 然后添加章节内容
        for (const raw of rawLines) {
            const line = raw.trim();
            if (line.length <= this.MAX_STATUS_TEXT_LENGTH) {
                this.contentLines.push(line);
                this.contentFullLines.push(line);
            }
            else {
                const chunks = this.chunkString(line, this.MAX_STATUS_TEXT_LENGTH);
                for (const c of chunks) {
                    this.contentLines.push(c);
                    this.contentFullLines.push(line); // tooltip 显示完整原始行
                }
            }
        }
        this.currentLineIndex = 0;
        this.updateLineDisplay();
        // 更新按钮状态（仅保留图标，不显示文字）
        this.upButton.text = '$(chevron-up)';
        this.downButton.text = '$(chevron-down)';
        this.prevButton.text = '$(chevron-left)';
        this.nextButton.text = '$(chevron-right)';
        // 显示所有项目
        this.upButton.show();
        this.downButton.show();
        this.prevButton.show();
        this.chapterInfo.show();
        this.statusBarItem.show();
        this.nextButton.show();
        // 重置自动隐藏定时器
        this.resetHideTimer();
    }
    updateLineDisplay() {
        if (this.contentLines.length === 0) {
            this.statusBarItem.text = '无内容';
            this.statusBarItem.tooltip = undefined;
            this.contentVisible = true;
            return;
        }
        const currentLine = this.contentLines[this.currentLineIndex] || '';
        const fullLine = this.contentFullLines[this.currentLineIndex] || currentLine;
        const lineInfo = `[${this.currentLineIndex + 1}/${this.contentLines.length}]`;
        // 展示该章进度在前，再展示内容；tooltip 展示完整原始行
        this.statusBarItem.text = `${lineInfo} ${currentLine}`;
        this.statusBarItem.tooltip = fullLine;
        this.statusBarItem.show();
        this.contentVisible = true;
    }
    show() {
        if (!this.novelProvider.hasChapters()) {
            vscode.window.showWarningMessage('请先选择小说文件夹');
            return;
        }
        this.isVisible = true;
        this.currentChapter = this.novelProvider.getCurrentChapter();
        this.updateDisplay();
        vscode.window.showInformationMessage('小说阅读器已在状态栏显示');
    }
    resetHideTimer() {
        // 清除现有定时器
        if (this.hideTimer) {
            clearTimeout(this.hideTimer);
        }
        // 设置新的定时器
        this.hideTimer = setTimeout(() => {
            this.hideContent();
        }, this.HIDE_DELAY);
    }
    hideContent() {
        if (this.isVisible) {
            // 隐藏小说内容，不展示任何占位文字
            this.statusBarItem.hide();
            this.contentVisible = false;
        }
    }
    showContent() {
        if (this.isVisible && this.currentChapter) {
            this.updateLineDisplay();
            this.resetHideTimer();
        }
    }
    previousLine() {
        if (!this.isVisible) {
            this.show();
        }
        if (!this.currentChapter) {
            return;
        }
        if (this.contentLines.length === 0) {
            this.updateDisplay();
        }
        if (this.contentLines.length === 0)
            return;
        // 如果已经在第一行，尝试切换到上一章的最后一行
        if (this.currentLineIndex === 0) {
            const success = this.novelProvider.previousChapter();
            if (success) {
                // 切换成功，设置到新章节的最后一行
                // 等待章节更新后再设置行索引
                setTimeout(() => {
                    if (this.contentLines.length > 0) {
                        this.currentLineIndex = this.contentLines.length - 1;
                        this.updateLineDisplay();
                        this.showContent();
                    }
                }, 50);
                return;
            }
        }
        this.currentLineIndex = Math.max(0, this.currentLineIndex - 1);
        this.updateLineDisplay();
        this.showContent();
    }
    nextLine() {
        if (!this.isVisible) {
            this.show();
        }
        if (!this.currentChapter) {
            return;
        }
        if (this.contentLines.length === 0) {
            this.updateDisplay();
        }
        if (this.contentLines.length === 0)
            return;
        // 如果已经在最后一行，尝试切换到下一章的第一行
        if (this.currentLineIndex === this.contentLines.length - 1) {
            const success = this.novelProvider.nextChapter();
            if (success) {
                // 切换成功，设置到新章节的第一行
                // 等待章节更新后再设置行索引
                setTimeout(() => {
                    this.currentLineIndex = 0;
                    this.updateLineDisplay();
                    this.showContent();
                }, 50);
                return;
            }
        }
        this.currentLineIndex = Math.min(this.contentLines.length - 1, this.currentLineIndex + 1);
        this.updateLineDisplay();
        this.showContent();
    }
    // 将长字符串按固定长度切分为多段
    chunkString(str, size) {
        if (size <= 0)
            return [str];
        const result = [];
        for (let i = 0; i < str.length; i += size) {
            result.push(str.slice(i, i + size));
        }
        return result;
    }
    hide() {
        this.isVisible = false;
        this.statusBarItem.hide();
        this.prevButton.hide();
        this.nextButton.hide();
        this.upButton.hide();
        this.downButton.hide();
        this.chapterInfo.hide();
    }
    registerStatusBarCommands() {
        const commands = [
            vscode.commands.registerCommand('novelReader.statusBar.previousChapter', () => {
                this.novelProvider.previousChapter();
                this.showContent();
            }),
            vscode.commands.registerCommand('novelReader.statusBar.nextChapter', () => {
                this.novelProvider.nextChapter();
                this.showContent();
            }),
            vscode.commands.registerCommand('novelReader.statusBar.searchChapter', () => {
                vscode.commands.executeCommand('novelReader.searchChapter');
                this.showContent();
            }),
            vscode.commands.registerCommand('novelReader.statusBar.showContent', () => {
                this.showContent();
            }),
            vscode.commands.registerCommand('novelReader.statusBar.toggleContent', () => {
                if (this.contentVisible) {
                    this.hideContent();
                }
                else {
                    this.showContent();
                }
            })
            // 注意：不要在此重复注册 novelReader.previousLine / nextLine，已在 extension.ts 全局注册
        ];
        commands.forEach(command => this.context.subscriptions.push(command));
    }
    dispose() {
        this.hide();
        if (this.hideTimer) {
            clearTimeout(this.hideTimer);
        }
        this.statusBarItem.dispose();
        this.prevButton.dispose();
        this.nextButton.dispose();
        this.upButton.dispose();
        this.downButton.dispose();
        this.chapterInfo.dispose();
    }
}
exports.StatusBarReader = StatusBarReader;
//# sourceMappingURL=statusBarReader.js.map