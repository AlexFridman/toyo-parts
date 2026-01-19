# 4Runner Разбор — каталог на GitHub Pages

Это статический сайт (GitHub Pages) с поиском по:
- номеру позиции (`Номер`)
- номеру запчасти (`Номер запчасти`)
- всем текстовым полям (название, раздел, категории, описание и т.д.)

## Структура

```
/
  index.html
  style.css
  app.js
  data.json
  photos/
    250/
      1.jpg
      2.jpg
    251/
      1.jpg
```

## Как опубликовать на GitHub Pages

1. Создайте репозиторий, например: `4runner-parts`
2. Загрузите в корень репозитория файлы из этого архива.
3. В GitHub откройте **Settings → Pages**
4. Source: **Deploy from a branch**
5. Branch: **main** (или master), Folder: **/** (root)
6. Сохраните — GitHub выдаст ссылку сайта.

## Как добавить фото

GitHub Pages не даёт “прочитать список файлов папки”, поэтому сайт пробует стандартные имена:
`1.jpg ... 8.jpg` и `01.jpg ... 08.jpg` (также поддерживает png/webp/jpeg).

Рекомендуемый формат:
- Папка = номер позиции: `photos/<Номер>/`
- Файлы: `1.jpg`, `2.jpg`, ...

## Обновление каталога

Если вы меняете CSV, нужно заново сгенерировать `data.json`.
Я могу сделать это за вас в этом чате, если вы загрузите обновлённый CSV.


## Индекс фотографий (рекомендуется)

Вместо подбора стандартных имён файлов сайт использует файл `photos_index.json`.

1) Сложите фото в `photos/<Номер>/` (имена файлов любые)

2) Сгенерируйте индекс:

```bash
python3 scripts/generate_photos_index.py --photos-dir photos --out photos_index.json
```

3) Закоммитьте `photos_index.json` вместе с фото.

Сайт автоматически покажет первое фото и количество фото для каждой позиции.


## Кнопка позвонить
В шапке сайта добавлена кнопка: `tel:+37441153113`.

## Ссылки вида /part/250
Сайт поддерживает прямые ссылки `/part/<id>`.
Для GitHub Pages добавлен `404.html`, чтобы такие ссылки открывались напрямую.

## Галерея
Клик по изображению открывает галерею всех фото по позиции.

## Превью (рекомендуется при больших фото)
Если фото большие, сделайте превью:
```bash
pip install pillow
python3 scripts/generate_thumbnails.py --photos-dir photos --out-dir photos_thumb --max-size 900 --quality 80
python3 scripts/generate_photos_index.py --photos-dir photos --thumbs-dir photos_thumb --out photos_index.json
```


## Языки (RU/HY)

Добавлен переключатель языка UI (русский по умолчанию).

- Русская версия: `/` и `/part/<id>`
- Армянский UI: `/hy/` и `/hy/part/<id>`

Пока переводится только интерфейс (кнопки/подписи/статусы). Данные из `data.json` остаются на русском.

## Фото в S3 (когда фото не помещаются в репозиторий)

Если фото хранятся в AWS S3, сайт может работать по абсолютным URL.

### 1) Заполните `config.json`

Откройте `config.json` в корне репозитория и укажите:

- `s3.bucket` — имя бакета
- `s3.region` — регион (например `eu-central-1`)

Либо можно указать готовый `s3.base_url`.

### 2) Залейте фото в S3 (вы делаете это через sync)

Рекомендуемая структура в бакете:

- `photos/<Номер>/...` (полные)
- `photos_thumb/<Номер>/...` (превью)

### 3) Сгенерируйте `photos_index.json` с S3 ссылками

```bash
python3 scripts/generate_photos_index.py \
  --photos-dir photos --thumbs-dir photos_thumb \
  --config config.json \
  --out photos_index.json
```

Можно также передать параметры прямо в CLI (переопределяют config):

```bash
python3 scripts/generate_photos_index.py --bucket YOUR_BUCKET --region eu-central-1 --out photos_index.json
```

### 4) Сгенерируйте `data.json` (подтянет S3 ссылки автоматически)

```bash
python3 scripts/csv_to_data_json.py \
  --csv "YOUR_PARTS.csv" \
  --photos photos_index.json \
  --config config.json \
  --out data.json
```

Если есть отдельный `thumbs_index.json`:

```bash
python3 scripts/generate_thumbs_index.py --thumbs-dir photos_thumb --config config.json --out thumbs_index.json
python3 scripts/csv_to_data_json.py --csv "YOUR_PARTS.csv" --photos photos_index.json --thumbs thumbs_index.json --config config.json --out data.json
```
