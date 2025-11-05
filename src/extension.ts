import * as vscode from "vscode";
import { EffectManager } from "./effects/EffectManager";
import { XPService } from "./services/XPService";
import { PanelViewProvider } from "./view/PanelViewProvider";
import { PanelMessageFromExt, Settings } from "./types";
import { SettingProp, SettingsService } from "./services/SettingService";

export function activate(context: vscode.ExtensionContext) {
  const settings = new SettingsService();
  const instanceID = Math.random().toString().substring(2);

  const xp = new XPService(context, settings.data.general.xpScale);
  const effects = new EffectManager(context, settings);
  const panelProvider = new PanelViewProvider(context, xp, settings);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(PanelViewProvider.viewType, panelProvider)
  );

  // Status bar
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  status.command = "ridiculousCoding.showPanel";
  context.subscriptions.push(status);

  function updateStatus() {
    if (!settings.data.statusBar.enabled) {
      status.hide();
    } else {
      const prog = xp.progress;
      const templates: Record<string, string> = {
        level: xp.level.toString(),
        currentXP: prog.current.toLocaleString("en-US"),
        targetXP: prog.max.toLocaleString("en-US")
      }
      function applyTemplates(text: string) {
        for (let template in templates) {
          text = text.replace(`{${template}}`, templates[template]);
        }
        return text;
      }
      status.text = applyTemplates(settings.data.statusBar.template);
      status.tooltip = applyTemplates(`Ridiculous Coding\nLevel {level} — {currentXP} / {targetXP} XP`);
      status.show();
    }
  }
  updateStatus();
  // One-time panel reveal to help unlock audio on first sound attempt
  let revealedForSound = false;

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand("ridiculousCoding.showPanel", () => panelProvider.reveal()),
    vscode.commands.registerCommand("ridiculousCoding.resetXp", () => {
      xp.reset();
      pushState();
      updateStatus();
    }),
    vscode.commands.registerCommand("ridiculousCoding.toggleExplosions", () => toggle("booms.enabled")),
    vscode.commands.registerCommand("ridiculousCoding.toggleBlips", () => toggle("blips.enabled")),
    vscode.commands.registerCommand("ridiculousCoding.toggleChars", () => toggle("keys.enabled")),
    vscode.commands.registerCommand("ridiculousCoding.toggleShake", () => toggle("shakes.enabled")),
    vscode.commands.registerCommand("ridiculousCoding.toggleSound", () => toggle("sounds.enabled")),
    vscode.commands.registerCommand("ridiculousCoding.toggleFireworks", () => toggle("fireworks.enabled")),
    vscode.commands.registerCommand("ridiculousCoding.toggleReducedEffects", () => toggle("reducedEffects.enabled"))
  );

  function toggle(key: string) {
    let prop: any = settings.props;
    for (let p of key.split(".")) prop = prop[p];
    (prop as SettingProp<boolean>).value = !(prop as SettingProp<boolean>).value;
    settings.persist();
  }

  // React to configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (!e.affectsConfiguration("ridiculousCoding")) return;
      settings.refresh();
    
      if (settings.props.reducedEffects.enabled) {
        vscode.window.visibleTextEditors.forEach(editor => {
          effects.clearAllDecorations(editor);
        });
      }
      
      xp.setBaseXp(settings.data.general.xpScale);
      pushState();
      updateStatus();
    })
  );

  // Pitch increase that resets shortly after typing stops
  let pitchIncrease = 0;
  let pitchResetTimer: NodeJS.Timeout | undefined;

  // Event handling: typing, deleting, newline
  let lastLineByEditor = new WeakMap<vscode.TextEditor, number>();

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(evt => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || evt.document !== editor.document) return;

      const change = evt.contentChanges[0];
      if (!change) return;

      console.log(evt);

      // Classify
      const insertedText = change.text ?? "";
      const removedChars = change.rangeLength ?? 0;
      const isInsert = insertedText.length > 0;
      const isNewLine = isInsert && "\r\n".includes(insertedText[0]);
      const isDelete = !isInsert && removedChars > 0;

      const caret = editor.selection.active;
      // Character label from inserted text (first char) or delete symbol
      const charLabel =
        !settings.data.keys.enabled || isNewLine
          ? undefined
        : isInsert
          ? sanitizeLabel(insertedText[0] ?? "")
        : isDelete
          ? "BACKSPACE"
        : undefined;

      if (!settings.data.reducedEffects.enabled) {

        if (isNewLine) {
          effects.showNewline(editor, settings.data.shakes.enabled);
          if (settings.data.sounds.enabled) {
            post({ 
              type: "boom", 
              volume: settings.data.booms.volume * settings.data.sounds.volume,
            });
          }
        } else if (isInsert) {
          if (settings.data.sounds.enabled) {
            if (!revealedForSound) {
              revealedForSound = true;
              panelProvider.reveal();
            }

            pitchIncrease += 1.0;
            if (pitchResetTimer) clearTimeout(pitchResetTimer);
            pitchResetTimer = setTimeout(() => { pitchIncrease = 0; }, settings.data.blips.streakTimeout);
            const pitch = 1.0 + Math.min(20, pitchIncrease) * 0.05;
            post({ 
              type: "blip", 
              volume: settings.data.blips.volume * settings.data.sounds.volume,
              pitch,
            });
          }

          effects.showBlip(editor, settings.data.keys.enabled, settings.data.shakes.enabled, charLabel);
        } else if (isDelete) {
          if (settings.data.sounds.enabled) {
            post({ 
              type: "boom", 
              volume: settings.data.booms.volume * settings.data.sounds.volume,
            });
          }

          effects.showBoom(editor, settings.data.keys.enabled, settings.data.shakes.enabled, charLabel);
        }
      }

      // Update XP
      if (isInsert) {
        const leveled = xp.addXp(1);
        if (leveled && settings.data.fireworks.enabled && !settings.data.reducedEffects.enabled) {
          post({ type: "fireworks" });
        }
        pushState();
        updateStatus();
      }

      // Track line change between events for additional newline cues
      lastLineByEditor.set(editor, caret.line);
    }),
  );

  function sanitizeLabel(ch: string): string {
    if (ch === "\n") return "";
    if (ch === "\t") return "↹";
    if (ch.trim() === "") return "SPACE";
    return ch;
  }

  function post(msg: PanelMessageFromExt) {
    panelProvider.post(msg);
  }

  function pushState() {
    post({ type: "state", xp: xp.xp, level: xp.level, xpNext: xp.xpToNextLevel, xpLevelStart: xp.xpStartOfLevel });
  }

  // Initial state is sent by PanelViewProvider when webview is ready
}

export function deactivate() {
  // no-op
}