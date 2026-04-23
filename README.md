# IronLog

**MVP** фитнес-трекера на **React + TypeScript + Vite** + опционально **[Supabase](https://supabase.com/)**. Макет: узкая колонка (~430px), нижняя навигация.

## Данные: Supabase и localStorage

- Слой **`src/lib/db.ts`** ходит в Supabase, при ошибке или отсутствии ключей — **fallback на localStorage** (`src/lib/localData.ts`).
- При первом запуске с настроенным Supabase **`migrateFromLocalStorage()`** (`src/lib/migration.ts`) переносит старые данные из браузера в БД и выставляет флаг `ironlog_migrated` в localStorage.
- Схема таблиц: **`supabase/schema.sql`** — выполни в SQL Editor проекта Supabase, затем настрой **RLS** (или политики доступа) под свою модель безопасности.

### Переменные окружения

Скопируй **`.env.example`** → **`.env`** и задай:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Без `.env` приложение работает **только из localStorage**, как раньше.

## Что в приложении

- Библиотека упражнений (поиск, фильтры), свои упражнения, карточка упражнения
- Конструктор тренировки, корзина, суперсеты
- Активная тренировка: таймеры, отдых, правка выполненных сетов
- Завершение: проверка результатов, PR
- Дашборд прогресса: стрик, тоннаж, вехи, 7 дней, ачивки

## Ключи localStorage (в т.ч. fallback и служебные)

| Ключ | Назначение |
|------|------------|
| `ironlog_workouts` | Шаблоны тренировок |
| `ironlog_logs` | Логи (есть legacy `ironlog_workout_logs`) |
| `ironlog_prs` | PR (есть legacy `ironlog_exercise_prs`) |
| `ironlog_custom_exercises` | Свои упражнения |
| `ironlog_active_workout` | Незавершённая сессия |
| `ironlog_migrated` | Однократная миграция в Supabase выполнена |
| `ironlog_progress_*` | Снимки достижений для toast на экране прогресса |

## Команды

```bash
npm install
npm run dev
npm run build
```
