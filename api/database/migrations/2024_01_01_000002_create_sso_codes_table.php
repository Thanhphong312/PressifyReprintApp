<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * SSO codes table for Electron → Web single sign-on.
 *
 * Flow:
 * 1. Electron app requests POST /api/auth/sso-code (authenticated)
 * 2. Backend creates a random 64-char code with 5-minute TTL
 * 3. Electron opens browser: {baseUrl}/sso/callback?code=xxx
 * 4. Web route exchanges code for session (marks code as used)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sso_codes', function (Blueprint $table) {
            $table->id();
            $table->string('code', 64)->unique()->index();
            $table->unsignedBigInteger('user_id');
            $table->timestamp('expires_at');
            $table->boolean('used')->default(false);
            $table->timestamps();

            $table->foreign('user_id')
                  ->references('id')
                  ->on('users')
                  ->onDelete('cascade');

            // Index for cleanup queries
            $table->index(['used', 'expires_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sso_codes');
    }
};
