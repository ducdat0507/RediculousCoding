import * as vscode from "vscode";
import { PanelMessageFromExt, PanelMessageToExt, Settings } from "../types";
import { XPService } from "../services/XPService";
import { SettingProp, SettingsService } from "../services/SettingService";

export class PanelViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "ridiculousCoding.panel";

  private _view?: vscode.WebviewView;
  private context: vscode.ExtensionContext;
  private xp: XPService;
  private settings: SettingsService;

  constructor(context: vscode.ExtensionContext, xp: XPService, settings: SettingsService) {
    this.context = context;
    this.xp = xp;
    this.settings = settings;
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void | Thenable<void> {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };

  webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((msg: PanelMessageToExt) => {
      switch (msg.type) {
        case "ready":
          const soundBase = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'sound');
          const soundUris = {
            blip: webviewView.webview.asWebviewUri(vscode.Uri.joinPath(soundBase, 'blip.wav')).toString(),
            boom: webviewView.webview.asWebviewUri(vscode.Uri.joinPath(soundBase, 'boom.wav')).toString(),
            fireworks: webviewView.webview.asWebviewUri(vscode.Uri.joinPath(soundBase, 'fireworks.wav')).toString()
          };
          this.post({
            type: "init",
            settings: this.settings.data,
            xp: this.xp.xp,
            level: this.xp.level,
            xpNext: this.xp.xpToNextLevel,
            xpLevelStart: this.xp.xpStartOfLevel,
            soundUris
          });
          break;
        case "toggle":
          this.updateSetting(msg.key + ".enabled", msg.value);
          break;
        case "resetXp":
          vscode.commands.executeCommand("ridiculousCoding.resetXp");
          break;
        case "requestState":
          this.post({
            type: "state",
            xp: this.xp.xp,
            level: this.xp.level,
            xpNext: this.xp.xpToNextLevel,
            xpLevelStart: this.xp.xpStartOfLevel
          });
          break;
        case "requestSettings":
          this.post({
            type: "settings",
            settings: this.settings.data
          });
          break;
      }
    });
  }

  post(message: PanelMessageFromExt) {
    this._view?.webview.postMessage(message);
  }

  reveal() {
    this._view?.show?.(true);
  }

  private async updateSetting<T>(key: string, value: T) {
    let prop: any = this.settings.props;
    for (let p of key.split(".")) prop = prop[p];
    (prop as SettingProp<T>).value = value;
    this.settings.persist();
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = Math.random().toString(36).slice(2);
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "webview", "panel.css")
    );
    const jsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "webview", "panel.js")
    );
    const logoUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "media", "icons", "icon.svg")
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} blob: data:; media-src ${webview.cspSource}; connect-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="${cssUri}" rel="stylesheet">
<title>Ridiculous Coding</title>
</head>
<body>
  <div class="notice" id="soundNotice" role="button" tabindex="0" title="Click to enable sound">Click here to enable sound</div>
  <div class="container">
  
    <section class="xp">
      <div class="labels">
        <div class="level">
          Level
          <span id="levelLabel">0</span>
        </div>
        <div class="xp-labels">
          <span id="currentXPLabel">0</span><br>/
          <span id="targetXPLabel">0</span> XP
        </div>
      </div>
      <div id="xpBar"></div>
      <canvas id="fwCanvas" class="hidden"></canvas>
    </section>

    <section class="card">
      <h2 class="card-title">Effects</h2>
      <div class="toggles">
        <label class="toggle-pill"><input id="explosions" type="checkbox"><span>Explosions</span></label>
        <label class="toggle-pill"><input id="blips" type="checkbox"><span>Blips</span></label>
        <label class="toggle-pill"><input id="chars" type="checkbox"><span>Char labels</span></label>
        <label class="toggle-pill"><input id="shake" type="checkbox"><span>Shake</span></label>
        <label class="toggle-pill"><input id="sound" type="checkbox"><span>Sound</span></label>
        <label class="toggle-pill"><input id="fireworks" type="checkbox"><span>Fireworks</span></label>
        <label class="toggle-pill"><input id="reducedEffects" type="checkbox"><span>Reduced Effects</span></label>
      </div>
    </section>

    <section class="card">
      <h2 class="card-title">Other</h2>
      <div class="row">
        <button id="resetBtn" class="btn">Reset XP</button>
      </div>
    </section>
  </div>

  <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
  }
}