#!/usr/bin/env bash
set -euo pipefail

OUT_FILE="PROMPTS.md"
: > "$OUT_FILE"

cat << EOF >> "$OUT_FILE"
==== user ====
нужно написать фреймворк для быстрого создания REST API:
- bun, typescript
- PostgreSQL (через Knex.js)
- Hono
- convention over configuration для типовых CRUD-сервисов

==== assistant ====

## Архитектура

\`\`\`
TheAPI (оркестратор)
├── Hono (HTTP-сервер, RegExpRouter)
├── Db (PostgreSQL, read/write splitting, миграции)
├── Middlewares (цепочка: begin → roles → relations → [пользовательские] → end)
├── Email (nodemailer + Handlebars шаблоны)
└── Files (локальная FS + MinIO)
\`\`\`

## Ключевые компоненты

### \`TheAPI\` — точка входа
- Собирает маршруты, ошибки, email-шаблоны из всех переданных \`Routings\`
- Инициализирует БД (ожидание соединения, миграции)
- Формирует цепочку middleware: \`begin → roles → relations → [user routes] → end\`
- JWT-авторизация из заголовка \`Authorization\`
- Стандартизированный формат ответа: \`{ result, relations, meta, error, requestTime, serverTime, logId }\`

### \`Db\` — база данных
- **Read/Write splitting**: отдельные пулы для чтения (\`DB_*\`) и записи (\`DB_WRITE_*\`)
- Автомиграции при старте (собирает \`migrationDirs\` из всех routings)
- Интроспекция таблиц: получает схему, колонки, foreign keys
- Поддержка pg_trgm (полнотекстовый поиск)
- Переподключение каждые 5 сек при недоступности БД

### \`Email\` — отправка почты
- nodemailer-транспорт, конфигурация через \`.env\`
- Handlebars-шаблонизация (\`subject\`, \`text\`, \`html\`)
- Именованные шаблоны, передаваемые через \`routesEmailTemplates\`

### \`Files\` — работа с файлами
- Локальная файловая система (стриминговая запись)
- MinIO (частично реализовано — upload закомментирован, delete работает)

## Система middlewares

| Middleware | Назначение |
|------------|-----------|
| **default** (\`beginRoute\`/\`endRoute\`) | JWT-парсинг, формирование JSON-ответа, базовые ошибки (404, 403, 401, 500) |
| **errors** | Перехват исключений → структурированный error-ответ с \`code\`, \`status\`, \`description\`, \`stack\` |
| **logs** | Логирование запросов/ответов, уникальный \`logId\`, скрытие sensitive-полей (\`password\`, \`token\`, \`refresh\`, \`authorization\`) |
| **status** | \`GET /status\` → \`{ ok: 1 }\` (healthcheck) |
| **info** | \`GET /info\` → uptime, totalRequests, name, version |
| **email** | Инжектирует \`c.var.email()\` для отправки писем из обработчиков |
| **files** | Инжектирует \`c.var.files\` (экземпляр \`Files\`) |
| **relations** | Post-processing: подгружает связанные сущности по foreign keys через \`flattening\` |

## Система ошибок

- \`throw new Error('ERROR_CODE')\` → автоматическая трансформация в структурированный ответ
- \`throw new Error('ERROR_CODE: дополнительная информация')\` — с additional
- Пользовательские ошибки регистрируются через \`router.errors({ ... })\`
- Все ошибки агрегируются из всех routings при инициализации

## Тестовое покрытие (17+ spec-файлов)

- CRUD: фильтрация, пагинация, сортировка, поиск, join, relations, soft-delete
- Permissions: роли, hidden/readonly поля, защищённые методы
- Инфраструктура: DB, email, files, errors, info/status, langs
- Docker Compose для тестовой PostgreSQL

## Характерные особенности

1. **Convention over configuration** — минимум кода для типовых REST API
2. **Декларативный CRUD** через \`CrudBuilder\` (внешний пакет \`the-api-routings\`)
3. **Read/Write splitting** из коробки
4. **Plug-in архитектура** — middlewares подключаются как \`Routings\`
5. **Единый формат ответа** для всех эндпоинтов (включая ошибки)
6. **Автоскрытие чувствительных данных** в логах

---

EOF

write_user() {
  local text="$1"
  {
    echo "==== user ===="
    echo "$text"
    echo ""
  } >> "$OUT_FILE"
}

write_assistant_header() {
  {
    echo "==== assistant ===="
    echo ""
  } >> "$OUT_FILE"
}

append_file() {
  local file="$1"
  local lang="$2"

  if [[ ! -f "$file" ]]; then
    return
  fi

  {
    echo "### $file"
    echo "\`\`\`$lang"
    cat "$file"
    echo "\`\`\`"
    echo ""
  } >> "$OUT_FILE"
}

write_user "Покажи структуру проекта и ключевые файлы."
write_assistant_header
{
  echo "## Project Structure"
  echo ""

  if command -v tree >/dev/null 2>&1; then
    tree -a -L 3 src test 2>/dev/null || true
  else
    find src test -maxdepth 3 -print 2>/dev/null | sort || true
  fi

  echo ""
  echo "## Key Files"
  echo ""
} >> "$OUT_FILE"

append_file "README.md" "markdown"
append_file "package.json" "json"
append_file "tsconfig.json" "json"
append_file ".env.example" "env"
append_file ".gitignore" "gitignore"

write_user "Теперь приложи исходники из src и test."
write_assistant_header
{
  echo "## Source Code"
  echo ""
} >> "$OUT_FILE"

while IFS= read -r file; do
  append_file "$file" "ts"
done < <(find src -type f -name "*.ts" | sort)

while IFS= read -r file; do
  append_file "$file" "ts"
done < <(find test -type f -name "*.ts" | sort)

wc -l "$OUT_FILE"
