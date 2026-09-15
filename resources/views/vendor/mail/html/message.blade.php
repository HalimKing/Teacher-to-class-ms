@php
    $institutionName = rescue(fn () => \App\Models\SystemSetting::getValue('institution_name'), null, false);
    $supportAddress = config('mail.from.address');
    $logoUrl = \App\Support\MailBranding::logoSrc();
@endphp
<x-mail::layout>
{{-- Header --}}
<x-slot:header>
<x-mail::header :url="config('app.url')" :institution="$institutionName" :logo="$logoUrl">
{{ config('app.name') }}
</x-mail::header>
</x-slot:header>

{{-- Body --}}
{!! $slot !!}

{{-- Subcopy --}}
@isset($subcopy)
<x-slot:subcopy>
<x-mail::subcopy>
{!! $subcopy !!}
</x-mail::subcopy>
</x-slot:subcopy>
@endisset

{{-- Footer --}}
<x-slot:footer>
<x-mail::footer :institution="$institutionName" :support="$supportAddress" />
</x-slot:footer>
</x-mail::layout>
