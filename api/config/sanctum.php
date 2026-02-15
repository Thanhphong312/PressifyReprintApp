<?php

/**
 * Sanctum Configuration
 *
 * Drop this into your Laravel project's config/ folder,
 * or merge these values into your existing config/sanctum.php.
 */

return [

    /*
    |--------------------------------------------------------------------------
    | Stateful Domains
    |--------------------------------------------------------------------------
    |
    | Domains that should use Sanctum's cookie-based (stateful) authentication.
    | The Electron app uses token-based auth, so this is only for the web SSO.
    |
    */
    'stateful' => explode(',', env(
        'SANCTUM_STATEFUL_DOMAINS',
        sprintf(
            '%s%s',
            'localhost,localhost:3000,localhost:8000,127.0.0.1,127.0.0.1:8000,::1',
            env('APP_URL') ? ',' . parse_url(env('APP_URL'), PHP_URL_HOST) : ''
        )
    )),

    /*
    |--------------------------------------------------------------------------
    | Sanctum Guards
    |--------------------------------------------------------------------------
    |
    | Guards used for authenticating Sanctum requests.
    |
    */
    'guard' => ['web'],

    /*
    |--------------------------------------------------------------------------
    | Token Expiration (Minutes)
    |--------------------------------------------------------------------------
    |
    | Tokens will expire after this many minutes of being issued.
    | Set to null for tokens that never expire.
    |
    | Default: 7 days = 10080 minutes
    | The Electron app also creates tokens with explicit expires_at,
    | but this acts as a global safety net.
    |
    */
    'expiration' => env('SANCTUM_TOKEN_EXPIRATION', 10080),

    /*
    |--------------------------------------------------------------------------
    | Token Prefix
    |--------------------------------------------------------------------------
    */
    'token_prefix' => env('SANCTUM_TOKEN_PREFIX', ''),

    /*
    |--------------------------------------------------------------------------
    | Sanctum Middleware
    |--------------------------------------------------------------------------
    |
    | Middleware applied to Sanctum's API routes.
    |
    */
    'middleware' => [
        'authenticate_session' => Laravel\Sanctum\Http\Middleware\AuthenticateSession::class,
        'encrypt_cookies'      => Illuminate\Cookie\Middleware\EncryptCookies::class,
        'validate_csrf_token'  => Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class,
    ],

];
