<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens;

    protected $fillable = [
        'email',
        'username',
        'password',
        'first_name',
        'last_name',
        'phone',
        'role_id',
        'status',
    ];

    protected $hidden = [
        'password',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Relationship: User belongs to a Role.
     */
    public function role()
    {
        return $this->belongsTo(Role::class);
    }

    /**
     * Check if user has a specific role.
     */
    public function hasRole(string $roleName): bool
    {
        return $this->role && $this->role->name === $roleName;
    }

    /**
     * Check if user account is active.
     */
    public function isActive(): bool
    {
        return $this->status === 'Active';
    }

    /**
     * Format user data for Desktop Electron app.
     *
     * Desktop app expects exactly these fields:
     *   uid, username, name, role, role_id
     * (see ipc-handlers.js auth:login MySQL fallback format)
     *
     * Also includes extra fields for web/admin use.
     */
    public function toApiResponse(): array
    {
        $roleName = $this->role ? strtolower($this->role->name) : null;
        $fullName = trim(($this->first_name ?? '') . ' ' . ($this->last_name ?? ''));

        return [
            // === Fields required by Desktop Electron app ===
            'uid'        => (string) $this->id,
            'username'   => $this->username,
            'name'       => $fullName ?: $this->username ?: '',
            'role'       => $roleName,
            'role_id'    => (string) $this->role_id,

            // === Extra fields for web/admin ===
            'id'         => $this->id,
            'email'      => $this->email,
            'first_name' => $this->first_name,
            'last_name'  => $this->last_name,
            'phone'      => $this->phone,
            'role_name'  => $this->role ? $this->role->name : null,
            'status'     => $this->status,
            'created_at' => $this->created_at,
        ];
    }
}
