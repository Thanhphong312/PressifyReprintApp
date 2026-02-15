<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SsoCode;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * AuthController — Handles all authentication for Pressify Reprint.
 *
 * Consumed by:
 *   - Electron Desktop App (via api-client.js → Bearer token auth)
 *   - Web Browser (via SSO callback → session auth)
 *
 * Desktop app data contract (user object must contain):
 *   { uid: string, username: string, name: string, role: string, role_id: string }
 *
 * See: src/main/ipc-handlers.js lines 308-415
 * See: src/main/api-client.js lines 118-155
 */
class AuthController extends Controller
{
    /**
     * POST /api/auth/login
     *
     * Authenticate user and issue a Sanctum token.
     * Rate limited: 5 attempts per minute (configured in routes).
     *
     * Desktop flow:
     *   api-client.js login() → stores data.token in tokenStore
     *                          → stores data.user in tokenStore
     *   ipc-handlers.js auth:login → returns { ...data, sso: true } to renderer
     *   AuthContext.jsx → setCurrentUser(result.user)
     *
     * Required response: { token: string, user: { uid, username, name, role, role_id } }
     */
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        $user = User::with('role')
            ->where('username', $request->username)
            ->where('status', 'Active')
            ->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json([
                'error'   => 'INVALID_CREDENTIALS',
                'message' => 'Invalid username or password.',
            ], 401);
        }

        // Revoke all existing tokens for this user (single-session)
        $user->tokens()->delete();

        // Create new token with 7-day expiration
        $token = $user->createToken('electron-app', ['*'], now()->addDays(7));

        return response()->json([
            'token' => $token->plainTextToken,
            'user'  => $user->toApiResponse(),
        ]);
    }

    /**
     * POST /api/auth/logout
     *
     * Revoke the current access token.
     *
     * Desktop flow:
     *   api-client.js logout() → calls this, then tokenStore.clearAll()
     *   If this fails, desktop still clears local state (graceful)
     *
     * Required response: { message: string }
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Logged out successfully.',
        ]);
    }

    /**
     * POST /api/auth/refresh
     *
     * Delete current token and issue a new one (token rotation).
     *
     * Desktop flow:
     *   api-client.js refresh() → stores data.token in tokenStore
     *   Called automatically every 30 minutes (AuthContext REFRESH_INTERVAL)
     *   Also called on 401 response (auto-retry mechanism)
     *
     * Required response: { token: string, user: { uid, username, name, role, role_id } }
     */
    public function refresh(Request $request): JsonResponse
    {
        $user = $request->user();

        // Delete current token
        $user->currentAccessToken()->delete();

        // Issue new token with fresh 7-day expiration
        $token = $user->createToken('electron-app', ['*'], now()->addDays(7));

        // Reload user with role for response
        $user->load('role');

        return response()->json([
            'token' => $token->plainTextToken,
            'user'  => $user->toApiResponse(),
        ]);
    }

    /**
     * GET /api/auth/me
     *
     * Return current authenticated user profile.
     *
     * Desktop flow:
     *   api-client.js getMe() → returns raw response
     *   ipc-handlers.js auth:me → returns to renderer
     *
     * Required response: { user: { uid, username, name, role, role_id, ... } }
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->load('role');

        return response()->json([
            'user' => $user->toApiResponse(),
        ]);
    }

    /**
     * POST /api/auth/validate
     *
     * Check if the current token is still valid.
     *
     * Desktop flow:
     *   api-client.js validate() → returns raw response
     *   ipc-handlers.js auth:validate → returns { ...data, sso: true }
     *   AuthContext.jsx restoreSession() → checks validation.valid
     *
     * Required response: { valid: true, user: { ... } }
     * On 401 (invalid token): Sanctum middleware returns { message: "Unauthenticated." }
     *
     * Method named validateToken to avoid conflict with
     * Laravel's ValidatesRequests::validate() trait method.
     */
    public function validateToken(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->load('role');

        return response()->json([
            'valid' => true,
            'user'  => $user->toApiResponse(),
        ]);
    }

    /**
     * POST /api/auth/sso-code
     *
     * Generate a one-time SSO code for web login.
     * Code expires in 5 minutes, single-use.
     *
     * Desktop flow:
     *   api-client.js generateSsoCode() → returns { code }
     *   ipc-handlers.js auth:sso-web → destructures { code }
     *   → opens browser: {baseUrl}/sso/callback?code={code}
     *
     * Required response: { code: string(64) }
     */
    public function ssoCode(Request $request): JsonResponse
    {
        $user = $request->user();

        // Clean up expired codes
        SsoCode::cleanExpired();

        // Generate unique 64-char code
        $code = Str::random(64);

        SsoCode::create([
            'code'       => $code,
            'user_id'    => $user->id,
            'expires_at' => now()->addMinutes(5),
            'used'       => false,
        ]);

        return response()->json([
            'code'       => $code,
            'expires_at' => now()->addMinutes(5)->toIso8601String(),
        ]);
    }

    /**
     * POST /api/auth/sso-exchange
     *
     * Exchange an SSO code for a web session (cookie-based).
     * No Bearer token required — the SSO code itself is the credential.
     *
     * Called by: web route /sso/callback (browser) or direct API call.
     * Not called by desktop app directly.
     *
     * Required response: { message: string, user: { ... } }
     */
    public function ssoExchange(Request $request): JsonResponse
    {
        $request->validate([
            'code' => 'required|string|size:64',
        ]);

        $ssoCode = SsoCode::valid()
            ->where('code', $request->code)
            ->first();

        if (!$ssoCode) {
            return response()->json([
                'error'   => 'INVALID_CODE',
                'message' => 'SSO code is invalid or expired.',
            ], 401);
        }

        // Mark code as used (one-time use)
        $ssoCode->markUsed();

        // Load user with role
        $user = $ssoCode->user;
        $user->load('role');

        if (!$user->isActive()) {
            return response()->json([
                'error'   => 'ACCOUNT_DISABLED',
                'message' => 'User account is disabled.',
            ], 403);
        }

        // Log user into web session (cookie-based)
        auth()->login($user);

        return response()->json([
            'message' => 'SSO login successful.',
            'user'    => $user->toApiResponse(),
        ]);
    }
}
