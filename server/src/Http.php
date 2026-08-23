<?php

declare(strict_types=1);

final class Http
{
    /**
     * @return array{status:int, body:array<string, mixed>, raw:string}
     */
    public static function postForm(string $url, array $fields): array
    {
        if (!function_exists('curl_init')) {
            throw new RuntimeException('cURL extension is required');
        }

        $ch = curl_init($url);
        if ($ch === false) {
            throw new RuntimeException('Failed to initialize HTTP client');
        }

        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query($fields),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
        ]);

        $body = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($body === false) {
            throw new RuntimeException('HTTP request failed: ' . $error);
        }

        $decoded = json_decode($body, true);
        if (!is_array($decoded)) {
            throw new RuntimeException('Invalid JSON response from remote service (HTTP ' . $status . ')');
        }

        return ['status' => $status, 'body' => $decoded, 'raw' => $body];
    }
}
