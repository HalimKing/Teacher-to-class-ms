<?php

use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('returns a fresh csrf token for the active session', function () {
    $response = $this->getJson('/csrf-token');

    $response->assertOk()
        ->assertJsonStructure(['token', 'session_id']);

    expect($response->json('token'))->toBe(session()->token());
});

it('accepts api requests after refreshing csrf token', function () {
    $staleToken = 'stale-token-value';

    $this->withSession(['_token' => session()->token()]);

    $refresh = $this->getJson('/csrf-token');
    $freshToken = $refresh->json('token');

    expect($freshToken)->not->toBe($staleToken);

    $this->withHeader('X-CSRF-TOKEN', $freshToken)
        ->getJson('/csrf-token')
        ->assertOk();
});
