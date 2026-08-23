<?php

declare(strict_types=1);

require_once __DIR__ . '/src/bootstrap.php';

reizoko_handle_options();
reizoko_cors_headers();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    reizoko_json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
}

$config = reizoko_bootstrap();
if (!$config->canAcceptOAuthSessions()) {
    reizoko_json_response(['ok' => false, 'error' => 'OAuth session storage is not writable'], 503);
}

$raw = file_get_contents('php://input');
$payload = json_decode($raw ?: '[]', true);
if (!is_array($payload)) {
    reizoko_json_response(['ok' => false, 'error' => 'Invalid JSON body'], 400);
}

$sessionId = trim((string) ($payload['sessionId'] ?? ''));
$state = trim((string) ($payload['state'] ?? ''));
$codeVerifier = trim((string) ($payload['codeVerifier'] ?? ''));
$appId = trim((string) ($payload['appId'] ?? ''));
$redirectUri = trim((string) ($payload['redirectUri'] ?? ''));

if ($sessionId === '' || $state === '' || $codeVerifier === '') {
    reizoko_json_response(['ok' => false, 'error' => 'sessionId, state and codeVerifier are required'], 400);
}

if ($appId === '' || !preg_match('/^\d{5,12}$/', $appId)) {
    reizoko_json_response(['ok' => false, 'error' => 'Valid appId is required'], 400);
}

if ($redirectUri === '') {
    $redirectUri = $config->redirectUri;
}

if ($redirectUri !== $config->redirectUri) {
    reizoko_json_response(['ok' => false, 'error' => 'redirectUri does not match server configuration'], 400);
}

if ($config->appId !== '' && $config->appId !== $appId) {
    reizoko_json_response([
        'ok' => false,
        'error' => 'VK_APP_ID on server does not match desktop App ID. Update server .env or Reizoko settings.',
        'errorCode' => 'OAUTH_CLIENT_ID_MISMATCH',
    ], 409);
}

if (!preg_match('/^[a-f0-9\-]{16,64}$/i', $sessionId)) {
    reizoko_json_response(['ok' => false, 'error' => 'Invalid sessionId format'], 400);
}

if ($sessionId !== $state) {
    reizoko_json_response(['ok' => false, 'error' => 'state must match sessionId'], 400);
}

if (strlen($codeVerifier) < 43 || strlen($codeVerifier) > 128) {
    reizoko_json_response(['ok' => false, 'error' => 'Invalid codeVerifier length'], 400);
}

$store = new OAuthSessionStore($config->storagePath, Config::SESSION_TTL_SECONDS);
$existing = $store->get($sessionId);
if ($existing !== null && ($existing['status'] ?? 'pending') !== 'pending') {
    reizoko_json_response(['ok' => false, 'error' => 'Session already finalized'], 409);
}

$store->createPending($sessionId, $state, $codeVerifier, $appId, $redirectUri);

OAuthDiagnostics::log(OAuthDiagnostics::newId(), 'oauth_session_created', [
    'session_prefix' => OAuthDiagnostics::statePrefix($sessionId),
    'redirect_uri' => $redirectUri,
    'client_id' => $appId,
    'storage_writable' => $config->isStorageWritable(),
]);

reizoko_json_response([
    'ok' => true,
    'sessionId' => $sessionId,
    'expiresIn' => Config::SESSION_TTL_SECONDS,
    'redirectUri' => $redirectUri,
    'appId' => $appId,
]);
