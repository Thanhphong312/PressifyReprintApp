<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SsoCode extends Model
{
    protected $table = 'sso_codes';

    protected $fillable = [
        'code',
        'user_id',
        'expires_at',
        'used',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'used'       => 'boolean',
    ];

    /**
     * Relationship: SsoCode belongs to a User.
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Check if the code is still valid (not expired and not used).
     */
    public function isValid(): bool
    {
        return !$this->used && $this->expires_at->isFuture();
    }

    /**
     * Mark the code as used.
     */
    public function markUsed(): void
    {
        $this->update(['used' => true]);
    }

    /**
     * Scope: only valid (unexpired, unused) codes.
     */
    public function scopeValid($query)
    {
        return $query->where('used', false)
                     ->where('expires_at', '>', now());
    }

    /**
     * Clean up expired codes.
     */
    public static function cleanExpired(): int
    {
        return static::where('expires_at', '<', now())->delete();
    }
}
