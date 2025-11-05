import * as vscode from "vscode";

export class XPService {

    xp: number = 0;
    level: number = 0;

    private readonly context: vscode.ExtensionContext;
    private baseXp: number;

    private xpToNextLevelAbs: number = 0;
    private xpToNextLevelRel: number = 0;
    private xpToCurrentLevelAbs: number = 0;

    constructor(context: vscode.ExtensionContext, baseXp: number) {
        this.context = context;
        this.baseXp = baseXp;
        this.refresh();
        this.updateLevelXps();
    }

    get progress(): { current: number; max: number } {
        return {
            current: this.xp - this.xpToCurrentLevelAbs,
            max: this.xpToNextLevelRel,
        };
    }
    get xpToNextLevel(): number {
        return this.xpToNextLevelAbs;
    }
    get xpStartOfLevel(): number {
        return this.xpToCurrentLevelAbs;
    }

    addXp(n: number): boolean {
        this.xp += n;
        let leveledUp = false;
        if (this.xp >= this.xpToNextLevelAbs) {
            this.level += 1;
            this.updateLevelXps();
            leveledUp = true;
        }
        this.persist();
        return leveledUp;
    }
    setBaseXp(base: number) {
        this.baseXp = base;
        this.level = this.getCurrentLevel(this.xp);
        this.updateLevelXps();
        this.persist();
    }
    reset(): void {
        this.level = 1;
        this.xp = 0;
        this.updateLevelXps();
        this.persist();
    }

    private updateLevelXps() {
        this.xpToCurrentLevelAbs = this.getLevelXpAbsolute(this.level - 1);
        this.xpToNextLevelAbs = this.getLevelXpAbsolute(this.level);
        this.xpToNextLevelRel = this.getLevelXpRelative(this.level);
    }

    private getLevelXpRelative(level: number) {
        return Math.max(2, level) * this.baseXp;
    }
    private getLevelXpAbsolute(level: number) {
        if (level <= 0) return 0;
        level--;
        return (level * level * 0.5 + level * 1.5 + 2) * this.baseXp;
    }
    private getCurrentLevel(xp: number) {
        if (xp < 2 * this.baseXp) return 1;
        let factor = xp / this.baseXp;
        return Math.floor(Math.sqrt(2 * factor - 1.75) - 1.5);
    }

    private persist() {
        this.context.globalState.update("xp", this.xp);
        this.context.globalState.update("level", this.level);
    }

    private refresh() {
        this.xp = this.context.globalState.get<number>("xp", 0);
        this.level = this.context.globalState.get<number>("level", 1);
    }
}
