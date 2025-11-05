import * as vscode from "vscode";

const CONFIG_KEY = "ridiculousCoding";

export class SettingsService 
{
    #props = {
        blips: {
            enabled: new SettingProp("blips.enabled", true),
            volume: new SettingProp("blips.volume", 0.7),
            scale: new SettingProp("blips.scale", 1),
            duration: new SettingProp("blips.duration", 400),
            streakTimeout: new SettingProp("blips.streakTimeout", 180),
        },
        booms: {
            enabled: new SettingProp("booms.enabled", true),
            volume: new SettingProp("booms.volume", 0.5),
            duration: new SettingProp("booms.duration", 650),
            scale: new SettingProp("booms.scale", 1),
        },
        slams: {
            enabled: new SettingProp("slams.enabled", true),
            volume: new SettingProp("slams.volume", 0.5),
            duration: new SettingProp("slams.duration", 300),
        },
        keys: {
            enabled: new SettingProp("keys.enabled", true),
            maxCount: new SettingProp("keys.maxCount", 10),
            duration: new SettingProp("keys.duration", 300),
            scaleBase: new SettingProp("keys.scaleBase", 1),
            scaleAdd: new SettingProp("keys.scaleAdd", 1),
            floatDistance: new SettingProp("keys.floatDistance", 1),
        },
        shakes: {
            enabled: new SettingProp("shakes.enabled", true),
            duration: new SettingProp("shakes.duration", 120),
            intensity: new SettingProp("shakes.intensity", 4),
        },
        fireworks: {
            enabled: new SettingProp("fireworks.enabled", true),
            volume: new SettingProp("fireworks.volume", 0.7),
        },
        sounds: {
            enabled: new SettingProp("sounds.enabled", true),
            volume: new SettingProp("sounds.volume", 0.7),
        },
        reducedEffects: {
            enabled: new SettingProp("reducedEffects.enabled", false),
        },
        general: {
            maxDecorationCount: new SettingProp("general.maxDecorationCount", 10),
            updateRate: new SettingProp("general.updateRate", 50),
            xpScale: new SettingProp("general.xpScale", 50),
        },
        statusBar: {
            enabled: new SettingProp("statusBar.enabled", true),
            template: new SettingProp("statusBar.template", "$(rocket) Lv.{level} — {currentXP} / {targetXP} XP"),
        }
    }
    #data = toValueProxy(this.#props);

    constructor() {
    }

    get props() { return this.#props }
    get data() { return this.#data }

    refresh() {
        const cfg = vscode.workspace.getConfiguration(CONFIG_KEY);
        function processRecord(record: SettingPropRecord) {
            for (let key in record) {
                if (record[key] instanceof SettingProp) 
                    record[key].value = cfg.get(record[key].key, record[key].value);
                else 
                    processRecord(record[key]);
            }
        }
        processRecord(this.props);
    }

    persist() {
        const cfg = vscode.workspace.getConfiguration(CONFIG_KEY);
        function processRecord(record: SettingPropRecord) {
            for (let key in record) {
                if (record[key] instanceof SettingProp) 
                    cfg.update(record[key].key, record[key].value);
                else 
                    processRecord(record[key]);
            }
        }
        processRecord(this.props);
    }
}

interface SettingPropRecord {
    [record: string]: SettingProp<any> | SettingPropRecord
};
type SettingPropValueProxy<T> = {
    [record in keyof T]: 
        T[record] extends SettingProp<infer TKey> ? TKey : 
        T[record] extends SettingPropRecord ? SettingPropValueProxy<T[record]> : T[record]
};

class SettingProp<T> {
    #key: string = "";
    #value: T;
    
    constructor(key: string, defaultValue: T) {
        this.#key = key;
        this.#value = defaultValue;
    }

    get key() { return this.#key; }
    get value() { return this.#value; }
    set value(value) {this.#value = value; }
}

const valueProxyHandler = {
    get: function<T extends SettingPropRecord>(target: T, prop: string, receiver: any) {
        if (target[prop] instanceof SettingProp)
            return target[prop].value;
        else if (typeof target[prop] == "object")
            return toValueProxy(target[prop]);
        else 
            return undefined;
    },
    set: function<T extends SettingPropRecord>(target: T, prop: string, value: any) {
        if (target[prop] instanceof SettingProp) {
            target[prop].value = value;
            return true;
        } else {
            return false;
        } 
    },
    ownKeys<T extends SettingPropRecord>(target: T) {
        return Reflect.ownKeys(target);
    },
}

function toValueProxy<T extends SettingPropRecord>(record: T): SettingPropValueProxy<T> {
    return new Proxy(record, valueProxyHandler) as SettingPropValueProxy<T>;
}

export type { SettingProp }