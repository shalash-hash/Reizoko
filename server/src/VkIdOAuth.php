<?php

declare(strict_types=1);

final class VkIdOAuth
{
    private const TOKEN_URL = 'https://id.vk.ru/oauth2/auth';

    public function __construct(private readonly Config $config)
    {
    }

    public function exchangeAuthorizationCode(
        string $code,
        string $codeVerifier,
        string $state,
        string $deviceId,
        string $diagnosticId,
        string $clientId,
        string $redirectUri,
    ): array {
        if (!$this->config->isOAuthConfigured()) {
            throw new VkTokenExchangeException(
                'VK OAuth is not configured on the server',
                'SERVER_CONFIG_MISSING',
            );
        }

        if ($codeVerifier === '') {
            throw new VkTokenExchangeException('PKCE code_verifier is missing', 'VK_PKCE_VERIFIER_MISSING');
        }

        if ($deviceId === '') {
            throw new VkTokenExchangeException('device_id is missing', 'VK_DEVICE_ID_MISSING');
        }

        $baseFields = [
            'grant_type' => 'authorization_code',
            'code' => $code,
            'code_verifier' => $codeVerifier,
            'redirect_uri' => $redirectUri,
            'client_id' => $clientId,
            'state' => $state,
            'device_id' => $deviceId,
        ];

        OAuthDiagnostics::log($diagnosticId, 'token_exchange_started', [
            'redirect_uri' => $redirectUri,
            'client_id' => $clientId,
            'oauth_app_kind' => $this->config->oauthAppKind(),
            'uses_service_token' => $this->config->isConfidentialApp(),
            'has_device_id' => true,
            'has_code_verifier' => true,
            'state_prefix' => OAuthDiagnostics::statePrefix($state),
        ]);

        if ($this->config->isConfidentialApp()) {
            return $this->postTokenExchange($baseFields, true, $diagnosticId);
        }

        try {
            return $this->postTokenExchange($baseFields, false, $diagnosticId);
        } catch (VkTokenExchangeException $exception) {
            if (
                $exception->vkError === 'invalid_client'
                && $this->config->hasServiceToken()
            ) {
                OAuthDiagnostics::log($diagnosticId, 'token_exchange_retry_confidential', [
                    'reason' => 'invalid_client_on_public_exchange',
                ]);
                return $this->postTokenExchange($baseFields, true, $diagnosticId);
            }
            throw $exception;
        }
    }

    /**
     * @param array<string, string> $baseFields
     * @return array<string, mixed>
     */
    private function postTokenExchange(array $baseFields, bool $withServiceToken, string $diagnosticId): array
    {
        $fields = $baseFields;
        if ($withServiceToken) {
            if (!$this->config->hasServiceToken()) {
                throw new VkTokenExchangeException(
                    'VK_SERVICE_TOKEN is required for confidential app token exchange',
                    'SERVER_CONFIG_MISSING',
                );
            }
            $fields['service_token'] = $this->config->serviceToken;
        }

        $response = Http::postForm(self::TOKEN_URL, $fields);
        $body = $response['body'];
        $httpStatus = $response['status'];

        if (isset($body['error'])) {
            $vkError = is_string($body['error']) ? $body['error'] : (string) $body['error'];
            $description = is_string($body['error_description'] ?? null)
                ? $body['error_description']
                : $vkError;

            OAuthDiagnostics::log($diagnosticId, 'token_exchange_failed', [
                'http' => $httpStatus,
                'error' => $vkError,
                'description' => $description,
                'uses_service_token' => $withServiceToken,
            ]);

            throw new VkTokenExchangeException(
                'VK token exchange failed: ' . $description,
                'VK_TOKEN_EXCHANGE_FAILED',
                $httpStatus,
                $vkError,
                $description,
            );
        }

        $accessToken = (string) ($body['access_token'] ?? '');
        if ($accessToken === '') {
            OAuthDiagnostics::log($diagnosticId, 'token_exchange_failed', [
                'http' => $httpStatus,
                'error' => 'empty_access_token',
                'uses_service_token' => $withServiceToken,
            ]);
            throw new VkTokenExchangeException(
                'VK token exchange returned empty access token',
                'VK_TOKEN_EXCHANGE_EMPTY',
                $httpStatus,
            );
        }

        OAuthDiagnostics::log($diagnosticId, 'token_exchange_succeeded', [
            'http' => $httpStatus,
            'has_user_id' => isset($body['user_id']),
            'has_refresh_token' => isset($body['refresh_token']),
            'uses_service_token' => $withServiceToken,
        ]);

        return [
            'accessToken' => $accessToken,
            'userId' => isset($body['user_id']) ? (int) $body['user_id'] : 0,
            'expiresIn' => isset($body['expires_in']) ? (int) $body['expires_in'] : null,
            'refreshToken' => isset($body['refresh_token']) ? (string) $body['refresh_token'] : null,
            'tokenType' => isset($body['token_type']) ? (string) $body['token_type'] : null,
            'scope' => isset($body['scope']) ? (string) $body['scope'] : null,
        ];
    }

    public static function buildAuthorizeUrl(
        string $clientId,
        string $redirectUri,
        string $state,
        string $codeChallenge,
        string $scope,
    ): string {
        $params = http_build_query([
            'response_type' => 'code',
            'client_id' => $clientId,
            'redirect_uri' => $redirectUri,
            'state' => $state,
            'code_challenge' => $codeChallenge,
            'code_challenge_method' => 'S256',
            'scope' => $scope,
        ]);

        return 'https://id.vk.ru/authorize?' . $params;
    }
}
