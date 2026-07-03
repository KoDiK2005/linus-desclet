const Desklet = imports.ui.desklet;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;

const PULSE_MIN_OPACITY = 165;
const PULSE_DURATION_MS = 1600;

const WEEKDAYS_FULL_RU = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
const MONTHS_FULL_RU = ["января", "февраля", "марта", "апреля", "мая", "июня",
                         "июля", "августа", "сентября", "октября", "ноября", "декабря"];

const WEEKDAYS_SHORT_RU = ["ВС", "ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ"];
const MONTHS_SHORT_RU = ["ЯНВ", "ФЕВ", "МАР", "АПР", "МАЙ", "ИЮН",
                          "ИЮЛ", "АВГ", "СЕН", "ОКТ", "НОЯ", "ДЕК"];

// Every style is described declaratively here so adding a new one
// doesn't require touching the build/apply logic below.
const ANIME_CHARACTERS = ["sakura", "luna", "miko", "yuki", "hana", "rei", "momo"];

const STYLES = {
    anime: {
        prefix: "anime",
        icon: function (self) {
            let character = ANIME_CHARACTERS.indexOf(self._anime_character) !== -1 ? self._anime_character : "sakura";
            return "sprite-" + character + ".svg";
        },
        boxClass: "anime-box",
        iconClass: "anime-icon",
        decorClass: "anime-decor",
        timeClass: "anime-time",
        dateClass: "anime-date",
        generatedBackground: true,
        weekdays: WEEKDAYS_FULL_RU,
        months: MONTHS_FULL_RU,
        formatDate: function (day, month, weekday) { return day + " " + month + ", " + weekday; }
    },
    persona5: {
        prefix: "persona5",
        icon: "mask.svg",
        boxClass: "p5-box",
        iconClass: "p5-icon",
        decorClass: "p5-decor",
        timeClass: "p5-time",
        dateClass: "p5-date",
        generatedBackground: false,
        weekdays: WEEKDAYS_SHORT_RU,
        months: MONTHS_SHORT_RU,
        formatDate: function (day, month, weekday) { return day + " " + month + " — " + weekday; }
    },
    persona3: {
        prefix: "persona3",
        icon: "mask3.svg",
        boxClass: "p3-box",
        iconClass: "p3-icon",
        decorClass: "p3-decor",
        timeClass: "p3-time",
        dateClass: "p3-date",
        generatedBackground: false,
        weekdays: WEEKDAYS_SHORT_RU,
        months: MONTHS_SHORT_RU,
        formatDate: function (day, month, weekday) { return day + " " + month + " · " + weekday; }
    },
    persona4: {
        prefix: "persona4",
        icon: "mask4.svg",
        boxClass: "p4-box",
        iconClass: "p4-icon",
        decorClass: "p4-decor",
        timeClass: "p4-time",
        dateClass: "p4-date",
        generatedBackground: false,
        weekdays: WEEKDAYS_SHORT_RU,
        months: MONTHS_SHORT_RU,
        formatDate: function (day, month, weekday) { return day + " " + month + " ★ " + weekday; }
    }
};

// Per-style setting suffixes, keyed to how each style's schema fields are named.
const COMMON_STYLE_KEYS = ["accent-color", "show-icon", "icon-size", "time-font-size", "top-decor", "bottom-decor"];
const ANIME_ONLY_KEYS = ["glow-color", "date-color", "bg-color"];
const IMAGE_STYLE_ONLY_KEYS = ["time-color"];

function buildSettingsKeys() {
    let keys = ["style", "use24h", "show-seconds", "anime-character"];
    Object.keys(STYLES).forEach(function (styleName) {
        let style = STYLES[styleName];
        let extra = style.generatedBackground ? ANIME_ONLY_KEYS : IMAGE_STYLE_ONLY_KEYS;
        COMMON_STYLE_KEYS.concat(extra).forEach(function (key) {
            keys.push(style.prefix + "-" + key);
        });
    });
    return keys;
}

const SETTINGS_KEYS = buildSettingsKeys();

function VibeClockDesklet(metadata, desklet_id) {
    this._init(metadata, desklet_id);
}

VibeClockDesklet.prototype = {
    __proto__: Desklet.Desklet.prototype,

    _init: function (metadata, desklet_id) {
        Desklet.Desklet.prototype._init.call(this, metadata, desklet_id);
        this.metadata = metadata;
        this._builtStyle = null;
        this._pulseToken = 0;

        this._bindSettings(desklet_id);

        this.setHeader("");
        this._root = new St.BoxLayout({ vertical: false });
        this.setContent(this._root);

        this._applySettings();
        this._updateLoop();
    },

    _bindSettings: function (desklet_id) {
        this.settings = new Settings.DeskletSettings(this, this.metadata.uuid, desklet_id);

        SETTINGS_KEYS.forEach(Lang.bind(this, function (key) {
            let prop = "_" + key.replace(/-/g, "_");
            this.settings.bindProperty(Settings.BindingDirection.IN, key, prop,
                this._applySettings, null);
        }));
    },

    _get: function (prefix, suffix) {
        return this["_" + prefix + "_" + suffix.replace(/-/g, "_")];
    },

    _resolveIcon: function (def) {
        return typeof def.icon === "function" ? def.icon(this) : def.icon;
    },

    _applySettings: function () {
        let style = STYLES[this._style] ? this._style : "anime";
        let iconPath = this._resolveIcon(STYLES[style]);

        if (style !== this._builtStyle || iconPath !== this._builtIconPath) {
            this._buildStyleUI(style, iconPath);
            this._builtStyle = style;
            this._builtIconPath = iconPath;
        }

        this._applyTheme(style);
        this._update(style);
    },

    _buildStyleUI: function (style, iconPath) {
        this._pulseToken++;
        this._root.destroy_all_children();

        let def = STYLES[style];

        this._icon = new St.Icon({
            gicon: new Gio.FileIcon({ file: Gio.File.new_for_path(this.metadata.path + "/" + iconPath) }),
            style_class: def.iconClass
        });
        this._clockBox = new St.BoxLayout({ vertical: true });
        this._topDecor = new St.Label({ style_class: def.decorClass });
        this._timeLabel = new St.Label({ style_class: def.timeClass });
        this._dateLabel = new St.Label({ style_class: def.dateClass });
        this._bottomDecor = new St.Label({ style_class: def.decorClass });

        this._clockBox.add(this._topDecor, { x_align: St.Align.MIDDLE });
        this._clockBox.add(this._timeLabel, { x_align: St.Align.MIDDLE });
        this._clockBox.add(this._dateLabel, { x_align: St.Align.MIDDLE });
        this._clockBox.add(this._bottomDecor, { x_align: St.Align.MIDDLE });

        this._root.style_class = def.boxClass;
        this._root.add(this._icon, { y_align: St.Align.MIDDLE });
        this._root.add(this._clockBox, { y_align: St.Align.MIDDLE });

        this._startPulse(this._timeLabel, this._pulseToken);
    },

    _startPulse: function (actor, token) {
        let pulseOut = true;
        Mainloop.timeout_add(PULSE_DURATION_MS, Lang.bind(this, function () {
            if (token !== this._pulseToken) return GLib.SOURCE_REMOVE;

            actor.ease({
                opacity: pulseOut ? PULSE_MIN_OPACITY : 255,
                duration: PULSE_DURATION_MS,
                mode: Clutter.AnimationMode.EASE_IN_OUT_SINE
            });
            pulseOut = !pulseOut;

            return GLib.SOURCE_CONTINUE;
        }));
    },

    _applyTheme: function (style) {
        let def = STYLES[style];
        let p = def.prefix;

        this._topDecor.set_text(this._get(p, "top-decor"));
        this._bottomDecor.set_text(this._get(p, "bottom-decor"));
        this._icon.visible = this._get(p, "show-icon");
        this._icon.icon_size = this._get(p, "icon-size");

        let accent = this._get(p, "accent-color");
        let fontSize = this._get(p, "time-font-size");

        if (def.generatedBackground) {
            let glow = this._get(p, "glow-color");
            let dateColor = this._get(p, "date-color");
            let bgColor = this._get(p, "bg-color");

            let bgTop = this._hexToRgba(bgColor, 0.85);
            let bgBottom = this._hexToRgba(this._shadeHex(bgColor, -0.35), 0.9);
            this._root.set_style(
                "background-gradient-direction: vertical;" +
                "background-gradient-start: " + bgTop + ";" +
                "background-gradient-end: " + bgBottom + ";" +
                "border: 2px solid " + accent + ";"
            );

            this._timeLabel.set_style(
                "font-size: " + fontSize + "px;" +
                "color: " + accent + ";" +
                "text-shadow: 0px 0px 12px " + glow + ";"
            );
            this._dateLabel.set_style(
                "color: " + dateColor + ";" +
                "text-shadow: 0px 0px 6px " + glow + ";"
            );
        } else {
            let timeColor = this._get(p, "time-color");

            this._topDecor.set_style("color: " + accent + ";");
            this._bottomDecor.set_style("color: " + accent + ";");
            this._dateLabel.set_style("color: " + accent + ";");
            this._timeLabel.set_style(
                "font-size: " + fontSize + "px;" +
                "color: " + timeColor + ";" +
                "text-shadow: 2px 2px 0px " + accent + ";"
            );
        }
    },

    _hexToRgba: function (hex, alpha) {
        let rgb = this._hexToRgb(hex);
        return "rgba(" + rgb[0] + ", " + rgb[1] + ", " + rgb[2] + ", " + alpha + ")";
    },

    _hexToRgb: function (hex) {
        hex = hex.replace("#", "");
        if (hex.length === 3) {
            hex = hex.split("").map(function (c) { return c + c; }).join("");
        }
        return [
            parseInt(hex.substring(0, 2), 16),
            parseInt(hex.substring(2, 4), 16),
            parseInt(hex.substring(4, 6), 16)
        ];
    },

    _shadeHex: function (hex, percent) {
        let rgb = this._hexToRgb(hex);
        let apply = function (c) {
            let shaded = percent < 0 ? c * (1 + percent) : c + (255 - c) * percent;
            return Math.max(0, Math.min(255, Math.round(shaded)));
        };
        return "#" + rgb.map(apply).map(function (c) {
            return c.toString(16).padStart(2, "0");
        }).join("");
    },

    _update: function (style) {
        let def = STYLES[style];
        let now = GLib.DateTime.new_now_local();

        let hour24 = now.get_hour();
        let suffix = "";
        let h;
        if (this._use24h) {
            h = hour24.toString().padStart(2, "0");
        } else {
            suffix = hour24 >= 12 ? " PM" : " AM";
            let h12 = hour24 % 12;
            if (h12 === 0) h12 = 12;
            h = h12.toString().padStart(2, "0");
        }
        let m = now.get_minute().toString().padStart(2, "0");

        let timeText = h + ":" + m;
        if (this._show_seconds) {
            timeText += ":" + now.get_second().toString().padStart(2, "0");
        }
        timeText += suffix;
        this._timeLabel.set_text(timeText);

        let day = now.get_day_of_month();
        let weekday = def.weekdays[now.get_day_of_week() % 7];
        let month = def.months[now.get_month() - 1];
        this._dateLabel.set_text(def.formatDate(day, month, weekday));
    },

    _updateLoop: function () {
        this._update(STYLES[this._style] ? this._style : "anime");
        this._timeoutId = Mainloop.timeout_add_seconds(1, Lang.bind(this, this._updateLoop));
    },

    on_desklet_removed: function () {
        this._pulseToken++;
        if (this._timeoutId) {
            Mainloop.source_remove(this._timeoutId);
        }
    }
};

function main(metadata, desklet_id) {
    return new VibeClockDesklet(metadata, desklet_id);
}
