# Reizoko Server (shared hosting)

PHP-сервер для OAuth VK ID и вспомогательных endpoint'ов Reizoko desktop.

## Деплой

1. Откройте файловый менеджер или FTP хостинга.
2. Найдите **web-root** домена `zasian.ru` (корневая папка сайта).
3. Загрузите **содержимое** локальной папки:

   `D:\_APP\Reizoko\server\`

4. **Не создавайте** на сервере дополнительную папку `reizoko`.
5. **Не создавайте** дополнительную папку `server`.

Связь путей:

```text
D:\_APP\Reizoko\server\vk-callback.php  →  https://zasian.ru/vk-callback.php
D:\_APP\Reizoko\server\vk-status.php    →  https://zasian.ru/vk-status.php
D:\_APP\Reizoko\server\reizoko-health.php → https://zasian.ru/reizoko-health.php
```

Итоговая структура в web-root:

```text
zasian.ru web-root/
├── vk-callback.php
├── vk-status.php
├── vk-session.php
├── vk-diagnostics.php
├── reizoko-health.php
├── .htaccess
├── .env                 ← создать на хостинге из .env.example
├── src/                 ← недоступен по HTTP
├── storage/             ← недоступен по HTTP
│   └── oauth/           ← PHP должен иметь право записи
└── api/                 ← при необходимости (пока пусто)
```

Публичный базовый URL: `https://zasian.ru`

## Настройка production secrets

1. Скопируйте `.env.example` → `.env` **на хостинге** (в web-root рядом с `vk-callback.php`).
2. Заполните **только на сервере** (не коммитьте в Git):

```env
VK_APP_ID=ваш_id_приложения
VK_CLIENT_SECRET=ваш_защищённый_ключ
VK_SERVICE_TOKEN=ваш_сервисный_ключ
REIZOKO_SERVER_URL=https://zasian.ru
VK_REDIRECT_URI=https://zasian.ru/vk-callback.php
```

**`VK_APP_ID` на сервере должен совпадать** с ID приложения VK в настройках Reizoko desktop. Если они различаются, VK покажет `invalid_client — app is deleted` при обмене кода, хотя экран разрешения откроется нормально.

3. Убедитесь, что PHP может писать в `storage/oauth/` (права `755` или `775` на каталог).

**Важно для VK ID token exchange:**

- По умолчанию приложение считается **публичным** (`VK_OAUTH_APP_KIND` не задан или `public`). В этом режиме сервер обменивает code на token **только через PKCE**, без `service_token` — как в [официальном примере VK ID](https://id.vk.com/about/business/go/docs/ru/vkid/latest/vk-id/connection/start-integration/auth-without-sdk/auth-without-sdk-web).
- Если в кабинете VK ID приложение отмечено как **конфиденциальное**, добавьте в `.env`:

```env
VK_OAUTH_APP_KIND=confidential
```

Тогда при обмене кода будет отправляться `VK_SERVICE_TOKEN` (сервисный ключ), а не `VK_CLIENT_SECRET`.

`VK_CLIENT_SECRET` используется только в desktop Reizoko и не участвует в server-side exchange.

4. В кабинете VK ID добавьте Redirect URI:

| Поле | Значение |
|------|----------|
| Базовый домен | `zasian.ru` |
| Доверенный Redirect URI | `https://zasian.ru/vk-callback.php` |

## Проверка после деплоя

- Health: `https://zasian.ru/reizoko-health.php` — JSON с `"ok": true`
- Diagnostics: `https://zasian.ru/vk-diagnostics.php` — `configured.appIdConfigured: true`, корректный `redirectUri`

## Публичные endpoint'ы

| URL | Назначение |
|-----|------------|
| `/reizoko-health.php` | Проверка доступности сервера (desktop «Проверить настройки») |
| `/vk-diagnostics.php` | Диагностика конфигурации (без секретов) |
| `/vk-session.php` | Регистрация OAuth-сессии (POST, desktop) |
| `/vk-callback.php` | Redirect URI VK ID |
| `/vk-status.php` | Polling статуса OAuth (desktop) |

## Безопасность

- Секреты только в `.env` на хостинге.
- Каталоги `src/` и `storage/` закрыты через `.htaccess`.
- Directory listing отключён (`Options -Indexes`).
- Access token **не** передаётся в URL браузера.
- Desktop получает token один раз через `vk-status.php`, после чего session удаляется.
- TTL сессии: 10 минут.

## Требования хостинга

- PHP 8.0+
- Расширение `curl`
- Возможность записи в `storage/oauth/`
- Apache с `mod_rewrite` (рекомендуется) или эквивалентная защита

Не требуются: Node.js, Redis, Docker, systemd, постоянные фоновые процессы.
