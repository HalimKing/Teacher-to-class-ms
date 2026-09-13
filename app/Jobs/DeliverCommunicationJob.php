<?php

namespace App\Jobs;

use App\Models\Communication;
use App\Services\CommunicationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class DeliverCommunicationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(public int $communicationId) {}

    public function handle(CommunicationService $communications): void
    {
        $communication = Communication::query()->find($this->communicationId);

        if (! $communication instanceof Communication) {
            return;
        }

        $communications->deliver($communication);
    }
}
