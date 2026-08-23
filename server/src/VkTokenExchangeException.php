<?php

declare(strict_types=1);

final class VkTokenExchangeException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly string $errorCode,
        public readonly int $httpStatus = 0,
        public readonly ?string $vkError = null,
        public readonly ?string $vkErrorDescription = null,
    ) {
        parent::__construct($message);
    }
}
