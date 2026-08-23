<?php

declare(strict_types=1);

final class Config
{
    public const VERSION = '0.1.0';
    public const SESSION_TTL_SECONDS = 600;

    private const DEFAULT_SERVER_URL = 'https://zasian.ru';
    private const DEFAULT_REDIRECT_URI = 'https://zasian.ru/vk-callback.php';

    public function __construct(
        public readonly string $appId,
        public readonly string $clientSecret,
        public readonly string $serviceToken,
        public readonly string $redirectUri,
        public readonly string $serverUrl,
        public readonly string $storagePath,
    ) {
    }

    public static function load(string $rootDir): self
    {
        self::loadEnvFile($rootDir . '/.env');

        $redirectUri = trim((string) getenv('VK_REDIRECT_URI'));
        if ($redirectUri === '') {
            $redirectUri = self::DEFAULT_REDIRECT_URI;
        }

        $serverUrl = rtrim(trim((string) getenv('REIZOKO_SERVER_URL')), '/');
        if ($serverUrl === '') {
            $serverUrl = self::DEFAULT_SERVER_URL;
        }

        $storagePath = $rootDir . '/storage/oauth';
        if (!is_dir($storagePath)) {
            mkdir($storagePath, 0700, true);
        }

        return new self(
            appId: trim((string) getenv('VK_APP_ID')),
            clientSecret: trim((string) getenv('VK_CLIENT_SECRET')),
            serviceToken: trim((string) getenv('VK_SERVICE_TOKEN')),
            redirectUri: $redirectUri,
            serverUrl: $serverUrl,
            storagePath: $storagePath,
        );
    }

    public function isOAuthConfigured(): bool
    {
        if ($this->appId === '') {
            return false;
        }

        if ($this->isConfidentialApp()) {
            return $this->serviceToken !== '';
        }

        return true;
    }

    public function isConfidentialApp(): bool
    {
        $kind = strtolower(trim((string) getenv('VK_OAUTH_APP_KIND')));
        return $kind === 'confidential';
    }

    public function oauthAppKind(): string
    {
        return $this->isConfidentialApp() ? 'confidential' : 'public';
    }

    public function hasServiceToken(): bool
    {
        return $this->serviceToken !== '';
    }

    public function isDebugMode(): bool
    {
        return trim((string) getenv('REIZOKO_DEBUG')) === '1';
    }

    /**
     * @return array<string, bool>
     */
    public function configPresence(): array
    {
        return [
            'vkAppIdPresent' => $this->appId !== '',
            'vkClientSecretPresent' => $this->clientSecret !== '',
            'vkServiceTokenPresent' => $this->serviceToken !== '',
            'reizokoServerUrlPresent' => $this->serverUrl !== '',
            'vkRedirectUriPresent' => $this->redirectUri !== '',
        ];
    }

    public function isStorageWritable(): bool
    {
        return is_dir($this->storagePath) && is_writable($this->storagePath);
    }

    public function canAcceptOAuthSessions(): bool
    {
        return $this->isStorageWritable();
    }

    public function diagnostics(): array
    {
        return [
            'appIdConfigured' => $this->appId !== '',
            'appId' => $this->appId !== '' ? $this->appId : null,
            'clientSecretConfigured' => $this->clientSecret !== '',
            'serviceTokenConfigured' => $this->serviceToken !== '',
            'redirectUri' => $this->redirectUri,
            'serverUrl' => $this->serverUrl,
            'oauthAppKind' => $this->oauthAppKind(),
            'storageWritable' => $this->isStorageWritable(),
            'configPresence' => $this->configPresence(),
        ];
    }

    private static function loadEnvFile(string $path): void
    {
        if (!is_file($path)) {
            return;
        }
        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines === false) {
            return;
        }
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }
            $parts = explode('=', $line, 2);
            if (count($parts) !== 2) {
                continue;
            }
            $name = trim($parts[0]);
            $value = trim($parts[1]);
            if ($name === '') {
                continue;
            }
            if (!array_key_exists($name, $_ENV)) {
                putenv($name . '=' . $value);
                $_ENV[$name] = $value;
            }
        }
    }
}
