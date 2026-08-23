<?php

declare(strict_types=1);

final class OAuthDiagnostics
{
    public static function newId(): string
    {
        return strtoupper(bin2hex(random_bytes(4)));
    }

    /**
     * @param array<string, bool|int|string|null> $context
     */
    public static function log(string $diagnosticId, string $stage, array $context = []): void
    {
        $payload = array_merge(['stage' => $stage], $context);
        error_log('[VK-OAUTH ' . $diagnosticId . '] ' . json_encode($payload, JSON_UNESCAPED_UNICODE));
    }

    public static function statePrefix(string $state): string
    {
        if ($state === '') {
            return '';
        }

        return substr($state, 0, 8);
    }
}
