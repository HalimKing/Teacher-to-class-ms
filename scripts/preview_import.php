<?php
require __DIR__ . '/../vendor/autoload.php';

$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Http\UploadedFile;
use Illuminate\Http\Request;

$filePath = storage_path('app/faculties_test.csv');
if (!file_exists($filePath)) {
    echo "Test CSV not found: $filePath\n";
    exit(1);
}

$file = new UploadedFile($filePath, 'faculties_test.csv', 'text/csv', null, true);
$request = Request::create('/', 'POST', [], [], ['file' => $file]);

$controller = new \App\Http\Controllers\Admin\SchoolManagement\FacultyController();
try {
    $res = $controller->preview($request);
    echo json_encode($res->getData(), JSON_PRETTY_PRINT);
} catch (\Exception $e) {
    echo "Preview failed: " . $e->getMessage() . "\n";
}
