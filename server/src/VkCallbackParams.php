<?php

declare(strict_types=1);

final class VkCallbackParams
{
    /**
     * @return array{
     *   error: string,
     *   errorDescription: string,
     *   code: string,
     *   state: string,
     *   deviceId: string,
     *   source: string
     * }
     */
    public static function fromQuery(array $query): array
    {
        $error = trim((string) ($query['error'] ?? ''));
        $errorDescription = trim((string) ($query['error_description'] ?? ''));
        $code = trim((string) ($query['code'] ?? ''));
        $state = trim((string) ($query['state'] ?? ''));
        $deviceId = trim((string) ($query['device_id'] ?? ''));
        $source = 'query';

        $payloadRaw = (string) ($query['payload'] ?? '');
        if ($payloadRaw !== '') {
            $payload = json_decode($payloadRaw, true);
            if (is_array($payload)) {
                $source = 'payload';
                if ($code === '' && isset($payload['code'])) {
                    $code = trim((string) $payload['code']);
                }
                if ($state === '' && isset($payload['state'])) {
                    $state = trim((string) $payload['state']);
                }
                if ($deviceId === '' && isset($payload['device_id'])) {
                    $deviceId = trim((string) $payload['device_id']);
                }
            }
        }

        return [
            'error' => $error,
            'errorDescription' => $errorDescription,
            'code' => $code,
            'state' => $state,
            'deviceId' => $deviceId,
            'source' => $source,
        ];
    }
}
