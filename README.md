# Vibe Clock Desklets — Cinnamon

Набор тематических десклетов часов/даты для Cinnamon (Linux Mint). Два стиля на выбор, оба ставятся независимо друг от друга.

## Anime Vibe Clock

Неоновый десклет в аниме/вейпорвейв-стиле: `cinnamon-desklet/anime-clock@vibe/`

- Часы (12/24ч, с секундами или без) и дата на русском языке
- Спрайт аниме-персонажа (chibi, SVG) рядом с часами — можно включить/выключить и менять размер
- Настраиваемые цвета: акцент, свечение, дата, фон
- Настраиваемый размер шрифта часов
- Настраиваемые декоративные надписи сверху/снизу

## Persona 5 Style Clock

Контрастный чёрно-красно-белый десклет в стиле UI игры Persona 5: `cinnamon-desklet/persona5-clock@vibe/`

- Диагональная рваная графика фона (SVG), полутоновые точки, водяной знак
- Стилизованная маска вместо персонажа
- Жирный курсивный шрифт часов с красной тенью
- Настраиваемые цвета (акцент/время), размер маски, шрифта, тексты-декор (по умолчанию «PHANTOM THIEVES» / «TAKE YOUR TIME»)

Все настройки для обоих десклетов доступны через правый клик по десклету → «Настроить десклет».

## Установка

```bash
git clone https://github.com/<your-user>/linus-desclet.git
cd linus-desclet

# Anime Vibe Clock
ln -s "$(pwd)/cinnamon-desklet/anime-clock@vibe" ~/.local/share/cinnamon/desklets/anime-clock@vibe

# Persona 5 Style Clock
ln -s "$(pwd)/cinnamon-desklet/persona5-clock@vibe" ~/.local/share/cinnamon/desklets/persona5-clock@vibe

cinnamon --replace &
```

Затем: правый клик на рабочем столе → «Добавить десклеты» → выбрать нужный вариант.

## Структура

```
cinnamon-desklet/
├── anime-clock@vibe/
│   ├── metadata.json          # метаданные десклета
│   ├── desklet.js              # логика (часы, дата, применение настроек)
│   ├── stylesheet.css           # базовая геометрия/раскладка
│   ├── settings-schema.json     # UI настроек в панели десклета
│   └── sprite.svg                # chibi-спрайт персонажа
└── persona5-clock@vibe/
    ├── metadata.json
    ├── desklet.js
    ├── stylesheet.css
    ├── settings-schema.json
    ├── background.svg            # диагональная рваная графика фона
    └── mask.svg                  # стилизованная маска
```
