<?php

declare(strict_types=1);

require_once __DIR__ . '/src/bootstrap.php';

reizoko_handle_options();
reizoko_cors_headers();

$config = reizoko_bootstrap();
$diagnosticId = OAuthDiagnostics::newId();
$devMode = $config->isDebugMode();
$store = new OAuthSessionStore($config->storagePath, Config::SESSION_TTL_SECONDS);
$oauth = new VkIdOAuth($config);
$params = VkCallbackParams::fromQuery($_GET);

$renderFailure = static function (
    string $errorCode,
    string $safeReason,
    ?string $devDetail,
    string $state,
) use ($store, $diagnosticId, $devMode): void {
    if ($state !== '') {
        $store->markError($state, $safeReason, $errorCode);
    }
    OAuthDiagnostics::log($diagnosticId, 'callback_failed', [
        'error_code' => $errorCode,
    ]);
    OAuthPage::renderError($safeReason, $diagnosticId, $safeReason, $devDetail, $devMode);
};

$error = $params['error'];
$errorDescription = $params['errorDescription'];
$state = $params['state'];
$code = $params['code'];
$deviceId = $params['deviceId'];

OAuthDiagnostics::log($diagnosticId, 'callback_received', [
    'has_code' => $code !== '',
    'has_state' => $state !== '',
    'has_device_id' => $deviceId !== '',
    'has_vk_error' => $error !== '',
    'state_prefix' => OAuthDiagnostics::statePrefix($state),
    'redirect_uri' => $config->redirectUri,
    'param_source' => $params['source'],
    'oauth_app_kind' => $config->oauthAppKind(),
]);

if (!$config->isOAuthConfigured()) {
    $hint = $config->isConfidentialApp()
        ? 'Проверьте VK_APP_ID и VK_SERVICE_TOKEN в .env на хостинге.'
        : 'Проверьте VK_APP_ID в .env на хостинге.';
    $renderFailure('SERVER_CONFIG_MISSING', 'Сервер Reizoko не настроен для OAuth.', $hint, $state);
}

if ($error !== '') {
    $message = $errorDescription !== '' ? $errorDescription : $error;
    OAuthDiagnostics::log($diagnosticId, 'vk_authorization_error', [
        'vk_error' => $error,
        'description' => $errorDescription,
        'state_prefix' => OAuthDiagnostics::statePrefix($state),
    ]);
    if ($state !== '') {
        $store->markError($state, $message, 'VK_AUTHORIZATION_DENIED');
    }
    OAuthPage::renderError(
        'VK отклонил авторизацию.',
        $diagnosticId,
        $message,
        'Этап: vk_authorization',
        $devMode,
        $error,
    );
}

if ($state === '') {
    $renderFailure(
        'OAUTH_STATE_MISSING',
        'Не удалось подтвердить OAuth-сессию.',
        'Этап: callback_received. Параметры state отсутствуют в query и payload.',
        '',
    );
}

if ($code === '') {
    $renderFailure(
        'OAUTH_CODE_MISSING',
        'VK не вернул authorization code.',
        'Этап: callback_received. Проверьте формат redirect (query или payload).',
        $state,
    );
}

if ($deviceId === '') {
    $renderFailure(
        'VK_DEVICE_ID_MISSING',
        'VK не вернул идентификатор устройства (device_id).',
        'Этап: device_id_received. device_id обязателен для VK ID token exchange.',
        $state,
    );
}

$session = $store->get($state);
if ($session === null) {
    $renderFailure(
        'OAUTH_STATE_UNKNOWN',
        'Сессия авторизации не найдена или истекла.',
        'Этап: state_validated. Проверьте storage/oauth и TTL сессии.',
        $state,
    );
}

if (($session['status'] ?? 'pending') !== 'pending') {
    $renderFailure(
        'OAUTH_STATE_ALREADY_USED',
        'OAuth-сессия уже была использована.',
        'Этап: state_validated.',
        $state,
    );
}

if (($session['state'] ?? '') !== $state) {
    $renderFailure(
        'OAUTH_STATE_MISMATCH',
        'Ошибка проверки безопасности (state).',
        'Этап: state_validated. state из callback не совпадает с сохранённым.',
        $state,
    );
}

$codeVerifier = (string) ($session['codeVerifier'] ?? '');
if ($codeVerifier === '') {
    $renderFailure(
        'VK_PKCE_VERIFIER_MISSING',
        'Не найден PKCE code_verifier для этой OAuth-сессии.',
        'Этап: pkce_verifier_loaded.',
        $state,
    );
}

$sessionAppId = trim((string) ($session['appId'] ?? ''));
$sessionRedirectUri = trim((string) ($session['redirectUri'] ?? ''));
if ($sessionAppId === '') {
    $renderFailure(
        'OAUTH_CLIENT_ID_MISSING',
        'В OAuth-сессии не сохранён App ID.',
        'Этап: oauth_session_created. Обновите desktop и server Reizoko.',
        $state,
    );
}
if ($sessionRedirectUri === '') {
    $sessionRedirectUri = $config->redirectUri;
}

OAuthDiagnostics::log($diagnosticId, 'state_validated', [
    'state_prefix' => OAuthDiagnostics::statePrefix($state),
    'has_code_verifier' => true,
    'device_id_prefix' => substr($deviceId, 0, 8),
    'client_id' => $sessionAppId,
    'redirect_uri' => $sessionRedirectUri,
]);

try {
    $token = $oauth->exchangeAuthorizationCode(
        $code,
        $codeVerifier,
        $state,
        $deviceId,
        $diagnosticId,
        $sessionAppId,
        $sessionRedirectUri,
    );
    $store->markSuccess($state, $token);
    OAuthDiagnostics::log($diagnosticId, 'oauth_session_marked_complete', [
        'state_prefix' => OAuthDiagnostics::statePrefix($state),
        'has_user_id' => ($token['userId'] ?? 0) > 0,
    ]);
    OAuthPage::renderSuccess();
} catch (VkTokenExchangeException $exception) {
    $safeReason = 'VK отклонил обмен кода авторизации.';
    $vkHint = $exception->vkError ?? $exception->errorCode;
    if ($exception->vkErrorDescription) {
        $vkHint .= ' — ' . $exception->vkErrorDescription;
    }
    if (
        $exception->vkError === 'invalid_client'
        && str_contains(strtolower((string) $exception->vkErrorDescription), 'deleted')
    ) {
        $safeReason = 'VK не принял App ID при обмене кода. Проверьте, что ID приложения в Reizoko совпадает с VK_APP_ID в .env на сервере.';
    }
    $devDetail = 'Этап: token_exchange'
        . "\nОшибка: " . $exception->errorCode
        . ($exception->vkError ? "\nVK: " . $exception->vkError : '')
        . ($exception->vkErrorDescription ? "\nОписание: " . $exception->vkErrorDescription : '')
        . "\nРежим: " . $config->oauthAppKind();
    $store->markError($state, $safeReason, $exception->errorCode);
    OAuthPage::renderError($safeReason, $diagnosticId, $safeReason, $devDetail, $devMode, $vkHint);
} catch (Throwable $exception) {
    OAuthDiagnostics::log($diagnosticId, 'callback_exception', [
        'message' => $exception->getMessage(),
    ]);
    $store->markError($state, 'Не удалось завершить авторизацию ВКонтакте.', 'VK_CALLBACK_EXCEPTION');
    OAuthPage::renderError(
        'Не удалось завершить авторизацию.',
        $diagnosticId,
        'Внутренняя ошибка сервера Reizoko.',
        $devMode ? ('Этап: token_exchange' . "\n" . $exception->getMessage()) : null,
        $devMode,
    );
}
