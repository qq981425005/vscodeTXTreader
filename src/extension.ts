import * as vscode from 'vscode';
import { NovelReader } from './novelReader';
import { StatusBarReader } from './statusBarReader';
import { NovelProvider } from './novelProvider';

let novelReader: NovelReader;
let statusBarReader: StatusBarReader;
let novelProvider: NovelProvider;

export function activate(context: vscode.ExtensionContext) {
    console.log('小说阅读器插件已激活');

    // 初始化组件
    novelProvider = new NovelProvider();
    novelReader = new NovelReader(context, novelProvider);
    statusBarReader = new StatusBarReader(context, novelProvider);

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
                novelProvider.setNovelFolder(folderUri[0].fsPath);
                vscode.window.showInformationMessage(`已设置小说文件夹: ${folderUri[0].fsPath}`);
            }
        }),
        
        vscode.commands.registerCommand('novelReader.previousChapter', () => {
            novelProvider.previousChapter();
        }),
        
        vscode.commands.registerCommand('novelReader.nextChapter', () => {
            novelProvider.nextChapter();
        }),
        
        vscode.commands.registerCommand('novelReader.searchChapter', async () => {
            const chapters = novelProvider.getChapterList();
            if (chapters.length === 0) {
                vscode.window.showWarningMessage('请先选择小说文件夹');
                return;
            }
            
            const selected = await vscode.window.showQuickPick(
                chapters.map((chapter, index) => ({
                    label: chapter.title,
                    description: `第${index + 1}章`,
                    chapter: chapter,
                    index: index
                })),
                {
                    placeHolder: '搜索并选择章节',
                    matchOnDescription: true
                }
            );
            
            if (selected) {
                novelProvider.setCurrentChapter(selected.index);
            }
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
    const novelFolder = config.get<string>('novelFolder');
    if (novelFolder) {
        novelProvider.setNovelFolder(novelFolder);
    }
}

export function deactivate() {
    if (statusBarReader) {
        statusBarReader.dispose();
    }
}