<?php

declare(strict_types=1);

require_once __DIR__ . '/src/bootstrap.php';

reizoko_handle_options();
reizoko_cors_headers();

$config = reizoko_bootstrap();

reizoko_json_response([
    'ok' => true,
    'service' => 'reizoko',
    'version' => Config::VERSION,
    'serverUrl' => $config->serverUrl,
]);
