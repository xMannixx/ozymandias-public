"""Domain exceptions for business services."""


class ServiceError(Exception):
    """Base class for service-layer errors."""


class NotFoundError(ServiceError):
    """Raised when an entity is not found."""


class ValidationError(ServiceError):
    """Raised when input or state validation fails."""


class ConflictError(ServiceError):
    """Raised for conflict or illegal state transitions."""


class CircuitBreakerTrippedError(ServiceError):
    """Raised when circuit breaker denies an operation."""


class LocalProviderUnavailableError(ServiceError):
    """Raised when local-only processing cannot run due to provider outage."""

    def __init__(
        self,
        *,
        provider: str,
        sensitivity: str,
        fallback_allowed: bool,
        detail: str | None = None,
    ) -> None:
        message = detail or f"Local provider '{provider}' is unavailable"
        super().__init__(message)
        self.provider = provider
        self.sensitivity = sensitivity
        self.fallback_allowed = fallback_allowed


class LiveWebPermissionRequiredError(ServiceError):
    """Raised when S3 live web access requires explicit user confirmation."""

    def __init__(
        self,
        *,
        sensitivity: str,
        detail: str | None = None,
    ) -> None:
        message = detail or "Live web access for S3 requires explicit confirmation"
        super().__init__(message)
        self.sensitivity = sensitivity
