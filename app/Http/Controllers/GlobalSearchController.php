<?php

namespace App\Http\Controllers;

use App\Services\GlobalSearchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GlobalSearchController extends Controller
{
    public function __construct(
        private GlobalSearchService $search,
    ) {}

    public function __invoke(Request $request): JsonResponse
    {
        $data = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'category' => ['nullable', 'string', 'max:50'],
        ]);

        $result = $this->search->search(
            $data['q'] ?? '',
            $data['category'] ?? 'all',
        );

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }
}
