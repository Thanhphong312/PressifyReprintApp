<?php

use App\Http\Controllers\Api\AuthController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes — Auth
|--------------------------------------------------------------------------
|
| All routes are prefixed with /api (by Laravel default).
|
| Public routes:
|   POST /api/auth/login        — Authenticate & get token
|   POST /api/auth/sso-exchange — Exchange SSO code for web session
|
| Protected routes (require Bearer token):
|   POST /api/auth/logout       — Revoke current token
|   POST /api/auth/refresh      — Rotate token (delete old, create new)
|   GET  /api/auth/me           — Get current user profile
|   POST /api/auth/validate     — Check token validity
|   POST /api/auth/sso-code     — Generate SSO code (5 min TTL)
|
*/

Route::prefix('auth')->group(function () {

    // --- Public routes ---
    Route::post('/login', [AuthController::class, 'login'])
        ->middleware('throttle:5,1'); // 5 attempts per minute

    Route::post('/sso-exchange', [AuthController::class, 'ssoExchange']);

    // --- Protected routes (Sanctum) ---
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/logout',   [AuthController::class, 'logout']);
        Route::post('/refresh',  [AuthController::class, 'refresh']);
        Route::get('/me',        [AuthController::class, 'me']);
        Route::post('/validate', [AuthController::class, 'validateToken']);
        Route::post('/sso-code', [AuthController::class, 'ssoCode']);
    });
});
