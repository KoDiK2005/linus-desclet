const Desklet = imports.ui.desklet;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;

const WEEKDAYS_RU = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
const MONTHS_RU = ["января", "февраля", "марта", "апреля", "мая", "июня",
                    "июля", "августа", "сентября", "октября", "ноября", "декабря"];

function AnimeClockDesklet(metadata, desklet_id) {
    this._init(metadata, desklet_id);
}

AnimeClockDesklet.prototype = {
    __proto__: Desklet.Desklet.prototype,

    _init: function (metadata, desklet_id) {
        Desklet.Desklet.prototype._init.call(this, metadata, desklet_id);
        this.metadata = metadata;

        this._bindSettings(desklet_id);
        this.setHeader("");

        this._buildUI();
        this._applySettings();
        this._updateLoop();
    },

    _bindSettings: function (desklet_id) {
        this.settings = new Settings.DeskletSettings(this, this.metadata.uuid, desklet_id);

        let keys = ["use24h", "show-seconds", "accent-color", "glow-color",
                    "date-color", "bg-color", "time-font-size", "top-decor", "bottom-decor"];
        keys.forEach(Lang.bind(this, function (key) {
            let prop = "_" + key.replace(/-/g, "_");
            this.settings.bindProperty(Settings.BindingDirection.IN, key, prop,
                this._applySettings, null);
        }));
    },

    _buildUI: function () {
        this._mainBox = new St.BoxLayout({
            vertical: true,
            style_class: "anime-clock-box"
        });

        this._topDecor = new St.Label({ style_class: "anime-clock-decor" });
        this._timeLabel = new St.Label({ style_class: "anime-clock-time" });
        this._dateLabel = new St.Label({ style_class: "anime-clock-date" });
        this._bottomDecor = new St.Label({ style_class: "anime-clock-decor" });

        this._mainBox.add(this._topDecor, { x_align: St.Align.MIDDLE });
        this._mainBox.add(this._timeLabel, { x_align: St.Align.MIDDLE });
        this._mainBox.add(this._dateLabel, { x_align: St.Align.MIDDLE });
        this._mainBox.add(this._bottomDecor, { x_align: St.Align.MIDDLE });

        this.setContent(this._mainBox);
    },

    _applySettings: function () {
        this._topDecor.set_text(this._top_decor);
        this._bottomDecor.set_text(this._bottom_decor);

        this._mainBox.set_style(
            "background-color: " + this._hexToRgba(this._bg_color, 0.78) + ";" +
            "border: 2px solid " + this._accent_color + ";"
        );

        this._timeLabel.set_style(
            "font-size: " + this._time_font_size + "px;" +
            "color: " + this._accent_color + ";" +
            "text-shadow: 0px 0px 8px " + this._accent_color + ", 0px 0px 16px " + this._glow_color + ";"
        );

        this._dateLabel.set_style(
            "color: " + this._date_color + ";" +
            "text-shadow: 0px 0px 6px " + this._glow_color + ";"
        );

        this._update();
    },

    _hexToRgba: function (hex, alpha) {
        hex = hex.replace("#", "");
        if (hex.length === 3) {
            hex = hex.split("").map(function (c) { return c + c; }).join("");
        }
        let r = parseInt(hex.substring(0, 2), 16);
        let g = parseInt(hex.substring(2, 4), 16);
        let b = parseInt(hex.substring(4, 6), 16);
        return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
    },

    _update: function () {
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

        let weekday = WEEKDAYS_RU[now.get_day_of_week() % 7];
        let day = now.get_day_of_month();
        let month = MONTHS_RU[now.get_month() - 1];
        this._dateLabel.set_text(day + " " + month + ", " + weekday);
    },

    _updateLoop: function () {
        this._update();
        this._timeoutId = Mainloop.timeout_add_seconds(1, Lang.bind(this, this._updateLoop));
    },

    on_desklet_removed: function () {
        if (this._timeoutId) {
            Mainloop.source_remove(this._timeoutId);
        }
    }
};

function main(metadata, desklet_id) {
    return new AnimeClockDesklet(metadata, desklet_id);
}
