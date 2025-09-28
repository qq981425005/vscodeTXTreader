"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const novelReader_1 = require("./novelReader");
const statusBarReader_1 = require("./statusBarReader");
const novelProvider_1 = require("./novelProvider");
let novelReader;
let statusBarReader;
let novelProvider;
async function activate(context) {
    // 插件已激活
    // 初始化组件
    novelProvider = new novelProvider_1.NovelProvider();
    novelReader = new novelReader_1.NovelReader(context, novelProvider);
    statusBarReader = new statusBarReader_1.StatusBarReader(context, novelProvider);
    // 章节进度持久化：保存/恢复
    const chapterKeyFor = (folder) => `novelReader:progress:chapter:${folder}`;
    const restoreChapterProgress = async (folder) => {
        const saved = context.globalState.get(chapterKeyFor(folder));
        if (typeof saved === 'number') {
            const list = novelProvider.getChapterList();
            if (saved >= 0 && saved < list.length) {
                novelProvider.setCurrentChapter(saved);
            }
        }
    };
    novelProvider.onChapterChange(() => {
        const folder = novelProvider.getNovelFolder();
        if (!folder)
            return;
        const info = novelProvider.getChapterInfo();
        context.globalState.update(chapterKeyFor(folder), info.current - 1);
    });
    // 注册命令
    const commands = [
        vscode.commands.registerCommand('novelReader.openNovel', () => {
            novelReader.openNovelInTab();
        }),
        vscode.commands.registerCommand('novelReader.showInStatusBar', () => {
            statusBarReader.show();
        }),
        vscode.commands.registerCommand('novelReader.selectNovelFolder', async () => {
            const folderUri = await vscode.window.showOpenDialog({
                canSelectFolders: true,
                canSelectFiles: false,
                canSelectMany: false,
                openLabel: '选择小说文件夹'
            });
            if (folderUri && folderUri[0]) {
                const config = vscode.workspace.getConfiguration('novelReader');
                await config.update('novelFolder', folderUri[0].fsPath, vscode.ConfigurationTarget.Global);
                await novelProvider.setNovelFolder(folderUri[0].fsPath);
                await restoreChapterProgress(folderUri[0].fsPath);
                -vscode.window.showInformationMessage(`已设置小说文件夹: ${folderUri[0].fsPath}`);
                +vscode.window.setStatusBarMessage(`已设置小说文件夹: ${folderUri[0].fsPath}`, 3000);
            }
        }),
        vscode.commands.registerCommand('novelReader.previousChapter', () => {
            novelProvider.previousChapter();
        }),
        vscode.commands.registerCommand('novelReader.nextChapter', () => {
            novelProvider.nextChapter();
        }),
        // 改造：使用 createQuickPick 并将当前章节设为激活项
        vscode.commands.registerCommand('novelReader.searchChapter', async () => {
            const chapters = novelProvider.getChapterList();
            if (chapters.length === 0) {
                -vscode.window.showWarningMessage('请先选择小说文件夹');
                +vscode.window.setStatusBarMessage('请先选择小说文件夹', 3000);
                return;
            }
            // 构造 QuickPick
            const qp = vscode.window.createQuickPick();
            const items = chapters.map((chapter, index) => ({
                label: chapter.title,
                description: `第${index + 1}章`,
                index
            }));
            qp.items = items;
            qp.placeholder = '搜索并选择章节';
            qp.matchOnDescription = true;
            qp.ignoreFocusOut = false;
            // 将当前章节作为活动项，自动滚动到该位置
            const info = novelProvider.getChapterInfo();
            const currentIndex = Math.max(0, Math.min(items.length - 1, info.current - 1));
            qp.activeItems = [items[currentIndex]];
            const disposables = [];
            const disposeAll = () => {
                disposables.forEach(d => d.dispose());
                qp.dispose();
            };
            disposables.push(qp.onDidAccept(() => {
                const picked = qp.selectedItems[0] ?? qp.activeItems[0];
                if (picked) {
                    novelProvider.setCurrentChapter(picked.index);
                }
                qp.hide();
            }), qp.onDidHide(() => {
                disposeAll();
            }));
            qp.show();
        }),
        vscode.commands.registerCommand('novelReader.previousLine', () => {
            statusBarReader.previousLine();
        }),
        vscode.commands.registerCommand('novelReader.nextLine', () => {
            statusBarReader.nextLine();
        }),
        // 兼容旧命令ID
        vscode.commands.registerCommand('read-book-status-bar.prev-line', () => {
            statusBarReader.previousLine();
        }),
        vscode.commands.registerCommand('read-book-status-bar.next-line', () => {
            statusBarReader.nextLine();
        })
    ];
    // 添加到订阅列表
    commands.forEach(command => context.subscriptions.push(command));
    // 初始化小说文件夹
    const config = vscode.workspace.getConfiguration('novelReader');
    const novelFolder = config.get('novelFolder');
    if (novelFolder) {
        await novelProvider.setNovelFolder(novelFolder);
        await restoreChapterProgress(novelFolder);
    }
}
exports.activate = activate;
function deactivate() {
    if (statusBarReader) {
        statusBarReader.dispose();
    }
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map