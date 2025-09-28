import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface Chapter {
    title: string;
    content: string;
    index: number;
    filePath?: string;
}

export class NovelProvider {
    private novelFolder: string = '';
    private chapters: Chapter[] = [];
    private currentChapterIndex: number = 0;
    private onChapterChangeEmitter = new vscode.EventEmitter<Chapter>();
    public readonly onChapterChange = this.onChapterChangeEmitter.event;

    constructor() {}

    public setNovelFolder(folderPath: string) {
        this.novelFolder = folderPath;
        this.loadChapters();
    }

    private async loadChapters() {
        if (!this.novelFolder || !fs.existsSync(this.novelFolder)) {
            this.chapters = [];
            return;
        }

        try {
            const files = fs.readdirSync(this.novelFolder)
                .filter(file => file.endsWith('.txt'))
                .sort((a, b) => {
                    // 尝试按章节数字排序
                    const numA = this.extractChapterNumber(a);
                    const numB = this.extractChapterNumber(b);
                    if (numA !== null && numB !== null) {
                        return numA - numB;
                    }
                    return a.localeCompare(b);
                });

            this.chapters = [];
            let globalIndex = 0;
            for (let i = 0; i < files.length; i++) {
                const filePath = path.join(this.novelFolder, files[i]);
                const content = fs.readFileSync(filePath, 'utf-8');
                const titleFromFile = path.basename(files[i], '.txt');

                // 尝试从单文件内容中解析多章节
                const parsed = this.parseChaptersFromContent(content);
                if (parsed.length > 1) {
                    for (const ch of parsed) {
                        this.chapters.push({
                            title: ch.title || titleFromFile,
                            content: ch.content,
                            index: globalIndex++,
                            filePath
                        });
                    }
                } else {
                    // 回退：将整个文件作为一章
                    this.chapters.push({
                        title: titleFromFile,
                        content,
                        index: globalIndex++,
                        filePath
                    });
                }
            }

            if (this.chapters.length > 0) {
                this.currentChapterIndex = 0;
                this.onChapterChangeEmitter.fire(this.chapters[0]);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`加载小说文件失败: ${error}`);
        }
    }

    // 新增：从单个txt内容中解析章节
    private parseChaptersFromContent(content: string): { title: string; content: string }[] {
        // 规范化换行
        const text = content.replace(/\r\n/g, '\n');
        // 匹配常见中文章节标题：第X章/回/节/部/卷，X支持中文数字与阿拉伯数字
        const headingRegex = /^\s*(第\s*[0-9一二三四五六七八九十百千零〇两]+\s*[章节回节部卷])[\s：:—\-]*([^\n]*)$/gm;
        const matches: { index: number; title: string }[] = [];
        let m: RegExpExecArray | null;
        while ((m = headingRegex.exec(text)) !== null) {
            const fullTitle = (m[1] + (m[2] ? ' ' + m[2].trim() : '')).trim();
            matches.push({ index: m.index, title: fullTitle });
        }

        if (matches.length === 0) {
            return [];
        }

        const chapters: { title: string; content: string }[] = [];
        for (let i = 0; i < matches.length; i++) {
            const start = matches[i].index;
            const end = i < matches.length - 1 ? matches[i + 1].index : text.length;

            // 取该段文本
            const segment = text.slice(start, end).trim();
            // 首行作为标题（或用匹配到的标题）
            const firstLine = segment.split('\n', 1)[0].trim();
            const title = firstLine.length <= matches[i].title.length + 20 ? matches[i].title : firstLine;
            // 内容去掉首行标题
            const contentBody = segment.slice(firstLine.length).trim();

            chapters.push({ title, content: contentBody });
        }
        return chapters;
    }
    private extractChapterNumber(filename: string): number | null {
        // 匹配"第X章"格式
        const chapterMatch = filename.match(/第(\d+)章/);
        if (chapterMatch) {
            return parseInt(chapterMatch[1], 10);
        }
        
        // 匹配纯数字格式
        const numberMatch = filename.match(/(\d+)/);
        if (numberMatch) {
            return parseInt(numberMatch[1], 10);
        }
        
        return null;
    }

    public getCurrentChapter(): Chapter | null {
        if (this.chapters.length === 0) {
            return null;
        }
        return this.chapters[this.currentChapterIndex];
    }

    public getChapterList(): Chapter[] {
        return this.chapters;
    }

    public setCurrentChapter(index: number) {
        if (index >= 0 && index < this.chapters.length) {
            this.currentChapterIndex = index;
            this.onChapterChangeEmitter.fire(this.chapters[index]);
        }
    }

    public previousChapter(): boolean {
        if (this.currentChapterIndex > 0) {
            this.currentChapterIndex--;
            this.onChapterChangeEmitter.fire(this.chapters[this.currentChapterIndex]);
            return true;
        }
        return false;
    }

    public nextChapter(): boolean {
        if (this.currentChapterIndex < this.chapters.length - 1) {
            this.currentChapterIndex++;
            this.onChapterChangeEmitter.fire(this.chapters[this.currentChapterIndex]);
            return true;
        }
        return false;
    }

    public getChapterInfo(): { current: number; total: number } {
        return {
            current: this.currentChapterIndex + 1,
            total: this.chapters.length
        };
    }

    public hasChapters(): boolean {
        return this.chapters.length > 0;
    }
}