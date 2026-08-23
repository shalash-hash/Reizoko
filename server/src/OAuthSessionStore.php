<?php

declare(strict_types=1);

final class OAuthSessionStore
{
    public function __construct(
        private readonly string $directory,
        private readonly int $ttlSeconds,
    ) {
    }

    public function createPending(
        string $sessionId,
        string $state,
        string $codeVerifier,
        string $appId,
        string $redirectUri,
    ): void {
        $this->write($sessionId, [
            'sessionId' => $sessionId,
            'state' => $state,
            'codeVerifier' => $codeVerifier,
            'appId' => $appId,
            'redirectUri' => $redirectUri,
            'status' => 'pending',
            'createdAt' => time(),
            'expiresAt' => time() + $this->ttlSeconds,
            'consumed' => false,
        ]);
    }

    public function get(string $sessionId): ?array
    {
        $path = $this->pathFor($sessionId);
        if (!is_file($path)) {
            return null;
        }
        $raw = file_get_contents($path);
        if ($raw === false) {
            return null;
        }
        $data = json_decode($raw, true);
        if (!is_array($data)) {
            return null;
        }
        if (($data['expiresAt'] ?? 0) < time()) {
            $this->delete($sessionId);
            return null;
        }
        return $data;
    }

    public function markSuccess(string $sessionId, array $result): void
    {
        $existing = $this->get($sessionId);
        if ($existing === null) {
            return;
        }
        $existing['status'] = 'success';
        $existing['result'] = $result;
        $this->write($sessionId, $existing);
    }

    public function markError(string $sessionId, string $message, ?string $errorCode = null): void
    {
        $existing = $this->get($sessionId);
        if ($existing === null) {
            $existing = [
                'sessionId' => $sessionId,
                'state' => '',
                'codeVerifier' => '',
                'createdAt' => time(),
                'expiresAt' => time() + $this->ttlSeconds,
            ];
        }
        $existing['status'] = 'error';
        $existing['error'] = $message;
        if ($errorCode !== null && $errorCode !== '') {
            $existing['errorCode'] = $errorCode;
        }
        $this->write($sessionId, $existing);
    }

    /**
     * @return array{status:string,result?:array,error?:string}|null
     */
    public function consumeResult(string $sessionId): ?array
    {
        $data = $this->get($sessionId);
        if ($data === null) {
            return null;
        }
        if (!empty($data['consumed'])) {
            return null;
        }

        $status = (string) ($data['status'] ?? 'pending');
        if ($status === 'pending') {
            return ['status' => 'pending'];
        }

        $data['consumed'] = true;
        $this->write($sessionId, $data);

        if ($status === 'error') {
            $this->delete($sessionId);
            return [
                'status' => 'error',
                'error' => (string) ($data['error'] ?? 'OAuth failed'),
                'errorCode' => isset($data['errorCode']) ? (string) $data['errorCode'] : null,
            ];
        }

        if ($status === 'success') {
            $result = is_array($data['result'] ?? null) ? $data['result'] : [];
            $this->delete($sessionId);
            return [
                'status' => 'success',
                'result' => $result,
            ];
        }

        return ['status' => 'pending'];
    }

    public function delete(string $sessionId): void
    {
        $path = $this->pathFor($sessionId);
        if (is_file($path)) {
            unlink($path);
        }
    }

    private function write(string $sessionId, array $data): void
    {
        if (!preg_match('/^[a-f0-9\-]{16,64}$/i', $sessionId)) {
            throw new InvalidArgumentException('Invalid session id');
        }
        $path = $this->pathFor($sessionId);
        file_put_contents($path, json_encode($data, JSON_UNESCAPED_UNICODE), LOCK_EX);
        chmod($path, 0600);
    }

    private function pathFor(string $sessionId): string
    {
        return $this->directory . '/' . $sessionId . '.json';
    }
}
