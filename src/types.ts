import { SettingsService } from "./services/SettingService";

export type Settings = SettingsService["data"];

export type PanelMessageFromExt =
  | { type: "init"; settings: Settings; xp: number; level: number; xpNext: number; xpLevelStart: number; soundUris: { blip: string; boom: string; fireworks: string } }
  | { type: "state"; xp: number; level: number; xpNext: number; xpLevelStart: number }
  | { type: "settings"; settings: Settings; }
  | { type: "blip"; volume: number; pitch: number; }
  | { type: "boom"; volume: number; }
  | { type: "fireworks"; };

export type PanelMessageToExt =
  | { type: "ready" }
  | { type: "toggle"; key: keyof Settings; value: boolean }
  | { type: "resetXp" }
  | { type: "requestState" }
  | { type: "requestSettings" };