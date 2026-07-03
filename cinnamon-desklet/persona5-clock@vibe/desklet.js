const Desklet = imports.ui.desklet;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;

const WEEKDAYS_RU = ["ВС", "ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ"];
const MONTHS_RU = ["ЯНВ", "ФЕВ", "МАР", "АПР", "МАЙ", "ИЮН",
                    "ИЮЛ", "АВГ", "СЕН", "ОКТ", "НОЯ", "ДЕК"];

function Persona5ClockDesklet(metadata, desklet_id) {
    this._init(metadata, desklet_id);
}

Persona5ClockDesklet.prototype = {
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

        let keys = ["use24h", "show-seconds", "accent-color", "time-color",
                    "show-mask", "mask-size", "time-font-size", "top-decor", "bottom-decor"];
        keys.forEach(Lang.bind(this, function (key) {
            let prop = "_" + key.replace(/-/g, "_");
            this.settings.bindProperty(Settings.BindingDirection.IN, key, prop,
                this._applySettings, null);
        }));
    },

    _buildUI: function () {
        this._mainBox = new St.BoxLayout({
            vertical: false,
            style_class: "p5-clock-box"
        });

        let maskPath = this.metadata.path + "/mask.svg";
        this._maskIcon = new St.Icon({
            gicon: new Gio.FileIcon({ file: Gio.File.new_for_path(maskPath) }),
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

        this._mainBox.add(this._maskIcon, { y_align: St.Align.MIDDLE });
        this._mainBox.add(this._clockBox, { y_align: St.Align.MIDDLE });

        this.setContent(this._mainBox);
    },

    _applySettings: function () {
        this._topDecor.set_text(this._top_decor);
        this._bottomDecor.set_text(this._bottom_decor);

        this._maskIcon.visible = this._show_mask;
        this._maskIcon.icon_size = this._mask_size;

        this._topDecor.set_style("color: " + this._accent_color + ";");
        this._bottomDecor.set_style("color: " + this._accent_color + ";");

        this._timeLabel.set_style(
            "font-size: " + this._time_font_size + "px;" +
            "color: " + this._time_color + ";" +
            "text-shadow: 2px 2px 0px " + this._accent_color + ";"
        );

        this._dateLabel.set_style("color: " + this._accent_color + ";");

        this._update();
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
        this._dateLabel.set_text(day + " " + month + " — " + weekday);
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
    return new Persona5ClockDesklet(metadata, desklet_id);
}
