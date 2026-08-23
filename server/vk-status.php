<?php

declare(strict_types=1);

require_once __DIR__ . '/src/bootstrap.php';

reizoko_handle_options();
reizoko_cors_headers();

$config = reizoko_bootstrap();
$sessionId = trim((string) ($_GET['session'] ?? ''));

if ($sessionId === '' || !preg_match('/^[a-f0-9\-]{16,64}$/i', $sessionId)) {
    reizoko_json_response(['ok' => false, 'error' => 'Invalid session parameter'], 400);
}

$store = new OAuthSessionStore($config->storagePath, Config::SESSION_TTL_SECONDS);
$result = $store->consumeResult($sessionId);

if ($result === null) {
    reizoko_json_response(['ok' => false, 'status' => 'expired', 'error' => 'Session not found or expired'], 404);
}

if (($result['status'] ?? '') === 'pending') {
    reizoko_json_response(['ok' => true, 'status' => 'pending']);
}

if (($result['status'] ?? '') === 'error') {
    reizoko_json_response([
        'ok' => false,
        'status' => 'error',
        'error' => (string) ($result['error'] ?? 'OAuth failed'),
        'errorCode' => isset($result['errorCode']) ? (string) $result['errorCode'] : null,
    ]);
}

$tokenResult = is_array($result['result'] ?? null) ? $result['result'] : [];

reizoko_json_response([
    'ok' => true,
    'status' => 'success',
    'userId' => (int) ($tokenResult['userId'] ?? 0),
    'accessToken' => (string) ($tokenResult['accessToken'] ?? ''),
    'expiresIn' => $tokenResult['expiresIn'] ?? null,
    'scope' => isset($tokenResult['scope']) ? (string) $tokenResult['scope'] : null,
]);
