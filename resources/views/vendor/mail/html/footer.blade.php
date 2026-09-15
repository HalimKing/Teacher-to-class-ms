@props([
    'institution' => null,
    'support' => null,
])
<tr>
<td class="footer-cell" align="center" bgcolor="#f7f9fc">
<p class="footer-brand"><strong>{{ config('app.name') }}</strong>@if ($institution) · {{ $institution }}@endif</p>
@if ($support)
<p class="footer-support">{{ __('Need help? Contact') }} <a href="mailto:{{ $support }}">{{ $support }}</a></p>
@endif
<p class="footer-legal">© {{ date('Y') }} {{ config('app.name') }}. {{ __('All rights reserved.') }}</p>
@if (trim($slot) !== '')
{{ Illuminate\Mail\Markdown::parse($slot) }}
@endif
</td>
</tr>
