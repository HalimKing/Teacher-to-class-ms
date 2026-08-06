<?php

namespace App\Console\Commands;

use App\Services\VenueChangeAuthorizationService;
use Illuminate\Console\Command;

class ExpireVenueChangeAuthorizations extends Command
{
    protected $signature = 'attendance:expire-venue-authorizations';

    protected $description = 'Mark expired venue change authorizations as invalid';

    public function handle(VenueChangeAuthorizationService $service): int
    {
        $count = $service->expireStale();
        $this->info("Expired {$count} venue change authorization(s).");

        return self::SUCCESS;
    }
}
