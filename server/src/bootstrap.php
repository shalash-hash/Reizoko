<?php

declare(strict_types=1);

require_once __DIR__ . '/Config.php';
require_once __DIR__ . '/Http.php';
require_once __DIR__ . '/OAuthDiagnostics.php';
require_once __DIR__ . '/OAuthSessionStore.php';
require_once __DIR__ . '/VkCallbackParams.php';
require_once __DIR__ . '/VkIdOAuth.php';
require_once __DIR__ . '/VkTokenExchangeException.php';
require_once __DIR__ . '/OAuthPage.php';

function reizoko_bootstrap(): Config
{
    static $config = null;
    if ($config === null) {
        $config = Config::load(dirname(__DIR__));
    }
    return $config;
}

function reizoko_json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function reizoko_cors_headers(): void
{
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
}

function reizoko_handle_options(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
        reizoko_cors_headers();
        http_response_code(204);
        exit;
    }
}
