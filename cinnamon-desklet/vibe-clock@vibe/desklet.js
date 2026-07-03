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

const SETTINGS_KEYS = [
    "style", "use24h", "show-seconds",
    "anime-accent-color", "anime-glow-color", "anime-date-color", "anime-bg-color",
    "anime-show-sprite", "anime-sprite-size", "anime-time-font-size",
    "anime-top-decor", "anime-bottom-decor",
    "persona-accent-color", "persona-time-color",
    "persona-show-mask", "persona-mask-size", "persona-time-font-size",
    "persona-top-decor", "persona-bottom-decor"
];

function VibeClockDesklet(metadata, desklet_id) {
    this._init(metadata, desklet_id);
}

VibeClockDesklet.prototype = {
    __proto__: Desklet.Desklet.prototype,

    _init: function (metadata, desklet_id) {
        Desklet.Desklet.prototype._init.call(this, metadata, desklet_id);
        this.metadata = metadata;
        this._builtStyle = null;

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

    _applySettings: function () {
        if (this._style !== this._builtStyle) {
            this._buildStyleUI(this._style);
            this._builtStyle = this._style;
        }

        if (this._style === "persona5") {
            this._applyPersonaTheme();
        } else {
            this._applyAnimeTheme();
        }

        this._update();
    },

    _buildStyleUI: function (style) {
        this._pulseToken = (this._pulseToken || 0) + 1;
        this._root.destroy_all_children();

        if (style === "persona5") {
            this._maskIcon = new St.Icon({
                gicon: new Gio.FileIcon({ file: Gio.File.new_for_path(this.metadata.path + "/mask.svg") }),
                style_class: "p5-mask"
            });
            this._clockBox = new St.BoxLayout({ vertical: true });
            this._topDecor = new St.Label({ style_class: "p5-decor" });
            this._timeLabel = new St.Label({ style_class: "p5-time" });
            this._dateLabel = new St.Label({ style_class: "p5-date" });
            this._bottomDecor = new St.Label({ style_class: "p5-decor" });

            this._clockBox.add(this._topDecor, { x_align: St.Align.MIDDLE });
            this._clockBox.add(this._timeLabel, { x_align: St.Align.MIDDLE });
            this._clockBox.add(this._dateLabel, { x_align: St.Align.MIDDLE });
            this._clockBox.add(this._bottomDecor, { x_align: St.Align.MIDDLE });

            this._root.style_class = "p5-clock-box";
            this._root.add(this._maskIcon, { y_align: St.Align.MIDDLE });
            this._root.add(this._clockBox, { y_align: St.Align.MIDDLE });
        } else {
            this._spriteIcon = new St.Icon({
                gicon: new Gio.FileIcon({ file: Gio.File.new_for_path(this.metadata.path + "/sprite.svg") }),
                style_class: "anime-clock-sprite"
            });
            this._clockBox = new St.BoxLayout({ vertical: true });
            this._topDecor = new St.Label({ style_class: "anime-clock-decor" });
            this._timeLabel = new St.Label({ style_class: "anime-clock-time" });
            this._dateLabel = new St.Label({ style_class: "anime-clock-date" });
            this._bottomDecor = new St.Label({ style_class: "anime-clock-decor" });

            this._clockBox.add(this._topDecor, { x_align: St.Align.MIDDLE });
            this._clockBox.add(this._timeLabel, { x_align: St.Align.MIDDLE });
            this._clockBox.add(this._dateLabel, { x_align: St.Align.MIDDLE });
            this._clockBox.add(this._bottomDecor, { x_align: St.Align.MIDDLE });

            this._root.style_class = "anime-clock-box";
            this._root.add(this._spriteIcon, { y_align: St.Align.MIDDLE });
            this._root.add(this._clockBox, { y_align: St.Align.MIDDLE });
        }

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

    _applyAnimeTheme: function () {
        this._topDecor.set_text(this._anime_top_decor);
        this._bottomDecor.set_text(this._anime_bottom_decor);

        this._spriteIcon.visible = this._anime_show_sprite;
        this._spriteIcon.icon_size = this._anime_sprite_size;

        let bgTop = this._hexToRgba(this._anime_bg_color, 0.85);
        let bgBottom = this._hexToRgba(this._shadeHex(this._anime_bg_color, -0.35), 0.9);
        this._root.set_style(
            "background-gradient-direction: vertical;" +
            "background-gradient-start: " + bgTop + ";" +
            "background-gradient-end: " + bgBottom + ";" +
            "border: 2px solid " + this._anime_accent_color + ";"
        );

        this._timeLabel.set_style(
            "font-size: " + this._anime_time_font_size + "px;" +
            "color: " + this._anime_accent_color + ";" +
            "text-shadow: 0px 0px 12px " + this._anime_glow_color + ";"
        );

        this._dateLabel.set_style(
            "color: " + this._anime_date_color + ";" +
            "text-shadow: 0px 0px 6px " + this._anime_glow_color + ";"
        );
    },

    _applyPersonaTheme: function () {
        this._topDecor.set_text(this._persona_top_decor);
        this._bottomDecor.set_text(this._persona_bottom_decor);

        this._maskIcon.visible = this._persona_show_mask;
        this._maskIcon.icon_size = this._persona_mask_size;

        this._topDecor.set_style("color: " + this._persona_accent_color + ";");
        this._bottomDecor.set_style("color: " + this._persona_accent_color + ";");
        this._dateLabel.set_style("color: " + this._persona_accent_color + ";");

        this._timeLabel.set_style(
            "font-size: " + this._persona_time_font_size + "px;" +
            "color: " + this._persona_time_color + ";" +
            "text-shadow: 2px 2px 0px " + this._persona_accent_color + ";"
        );
    },

    _hexToRgba: function (hex, alpha) {
        let [r, g, b] = this._hexToRgb(hex);
        return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
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
        let [r, g, b] = this._hexToRgb(hex);
        let apply = function (c) {
            let shaded = percent < 0 ? c * (1 + percent) : c + (255 - c) * percent;
            return Math.max(0, Math.min(255, Math.round(shaded)));
        };
        r = apply(r); g = apply(g); b = apply(b);
        return "#" + [r, g, b].map(function (c) {
            return c.toString(16).padStart(2, "0");
        }).join("");
    },

    _update: function () {
        let now = GLib.DateTime.new_now_local();
        let isPersona = this._style === "persona5";

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
        if (isPersona) {
            let weekday = WEEKDAYS_SHORT_RU[now.get_day_of_week() % 7];
            let month = MONTHS_SHORT_RU[now.get_month() - 1];
            this._dateLabel.set_text(day + " " + month + " — " + weekday);
        } else {
            let weekday = WEEKDAYS_FULL_RU[now.get_day_of_week() % 7];
            let month = MONTHS_FULL_RU[now.get_month() - 1];
            this._dateLabel.set_text(day + " " + month + ", " + weekday);
        }
    },

    _updateLoop: function () {
        this._update();
        this._timeoutId = Mainloop.timeout_add_seconds(1, Lang.bind(this, this._updateLoop));
    },

    on_desklet_removed: function () {
        this._pulseToken = (this._pulseToken || 0) + 1;
        if (this._timeoutId) {
            Mainloop.source_remove(this._timeoutId);
        }
    }
};

function main(metadata, desklet_id) {
    return new VibeClockDesklet(metadata, desklet_id);
}
