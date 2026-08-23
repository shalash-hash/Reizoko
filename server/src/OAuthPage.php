<?php

declare(strict_types=1);

final class OAuthPage
{
    public static function renderSuccess(): void
    {
        self::render(
            'ВКонтакте подключён',
            'Авторизация завершена.<br>Можно вернуться в Reizoko.<br><br>Это окно можно закрыть.',
            false,
        );
    }

    public static function renderError(
        string $safeMessage,
        string $diagnosticId,
        ?string $safeReason = null,
        ?string $devDetail = null,
        bool $devMode = false,
        ?string $vkErrorHint = null,
    ): void {
        $body = 'Авторизация в VK была разрешена,<br>но Reizoko не смог завершить подключение.';
        if ($safeReason !== null && $safeReason !== '') {
            $body .= '<br><br>' . htmlspecialchars($safeReason, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        }
        if ($vkErrorHint !== null && $vkErrorHint !== '') {
            $body .= '<br><br><span style="color:#9aa3b2;">VK: '
                . htmlspecialchars($vkErrorHint, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
                . '</span>';
        }
        $body .= '<br><br>Код диагностики: <strong>' . htmlspecialchars($diagnosticId, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</strong>';
        if ($devMode && $devDetail !== null && $devDetail !== '') {
            $body .= '<br><br><span style="color:#9aa3b2;font-size:.92rem;">'
                . htmlspecialchars($devDetail, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
                . '</span>';
        }
        self::render('Не удалось подключить ВКонтакте', $body, true);
    }

    private static function render(string $title, string $body, bool $isError): void
    {
        $accent = $isError ? '#e5484d' : '#0077ff';
        header('Content-Type: text/html; charset=utf-8');
        header('Cache-Control: no-store');
        echo '<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">';
        echo '<title>' . htmlspecialchars($title, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . ' — Reizoko</title>';
        echo '<style>
          :root { color-scheme: light dark; }
          body { margin:0; min-height:100vh; display:grid; place-items:center; font-family:Segoe UI,system-ui,sans-serif; background:#0f1115; color:#f2f4f8; }
          .card { max-width:480px; padding:32px 28px; border-radius:16px; background:#171a21; border:1px solid #2a3140; box-shadow:0 12px 40px rgba(0,0,0,.35); }
          .logo { width:44px; height:44px; border-radius:12px; display:grid; place-items:center; font-weight:700; background:' . $accent . '; color:#fff; margin-bottom:16px; }
          h1 { margin:0 0 12px; font-size:1.35rem; }
          p { margin:0; line-height:1.55; color:#c5cad3; }
        </style></head><body><main class="card"><div class="logo">R</div><h1>' . htmlspecialchars($title, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</h1><p>' . $body . '</p></main></body></html>';
        exit;
    }
}
