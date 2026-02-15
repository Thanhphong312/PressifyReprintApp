<?php

use App\Http\Controllers\Api\AuthController;
use App\Models\SsoCode;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| SSO Callback — Web Route
|--------------------------------------------------------------------------
|
| GET /sso/callback?code=xxx
|
| This route is opened in the user's default browser from the Electron app.
| It exchanges the SSO code for a web session and redirects to the dashboard.
|
*/

Route::get('/sso/callback', function () {
    $code = request()->query('code');

    if (!$code) {
        return response()->view('errors.sso', [
            'message' => 'Missing SSO code.',
        ], 400);
    }

    $ssoCode = SsoCode::valid()
        ->where('code', $code)
        ->first();

    if (!$ssoCode) {
        return response()->view('errors.sso', [
            'message' => 'SSO code is invalid or expired.',
        ], 401);
    }

    // Mark code as used
    $ssoCode->markUsed();

    // Load user
    $user = $ssoCode->user;

    if (!$user || !$user->isActive()) {
        return response()->view('errors.sso', [
            'message' => 'User account is disabled.',
        ], 403);
    }

    // Log user into web session
    auth()->login($user);

    // Redirect to dashboard or home page
    return redirect('/dashboard');
});
