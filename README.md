# Anime Vibe Clock — Cinnamon Desklet

Неоновый десклет часов и даты в аниме/вейпорвейв-стиле для Cinnamon (Linux Mint).

## Возможности

- Часы (12/24ч, с секундами или без) и дата на русском языке
- Спрайт аниме-персонажа (chibi, SVG) рядом с часами — можно включить/выключить и менять размер
- Настраиваемые цвета: акцент, свечение, дата, фон
- Настраиваемый размер шрифта часов
- Настраиваемые декоративные надписи сверху/снизу

Все настройки доступны через правый клик по десклету → «Настроить десклет».

## Установка

```bash
git clone https://github.com/<your-user>/linus-desclet.git
ln -s "$(pwd)/linus-desclet/cinnamon-desklet/anime-clock@vibe" ~/.local/share/cinnamon/desklets/anime-clock@vibe
cinnamon --replace &
```

Затем: правый клик на рабочем столе → «Добавить десклеты» → **Anime Vibe Clock**.

## Структура

```
cinnamon-desklet/anime-clock@vibe/
├── metadata.json          # метаданные десклета
├── desklet.js              # логика (часы, дата, применение настроек)
├── stylesheet.css           # базовая геометрия/раскладка
├── settings-schema.json     # UI настроек в панели десклета
└── sprite.svg                # chibi-спрайт персонажа
```
