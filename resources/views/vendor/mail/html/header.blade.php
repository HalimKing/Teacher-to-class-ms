@props([
    'url',
    'institution' => null,
    'logo' => null,
])
<tr>
<td class="header-cell" align="center" bgcolor="#0b2a4a">
@if ($logo)
<table cellpadding="0" cellspacing="0" role="presentation" align="center" style="margin: 0 auto;">
<tr>
<td class="logo-tile" align="center" bgcolor="#ffffff">
<a href="{{ $url }}" target="_blank" rel="noopener" style="display: inline-block; text-decoration: none;">
<img src="{{ $logo }}" class="logo" alt="{{ strip_tags($slot) }}" width="64" height="64" style="display: block; border: 0;">
</a>
</td>
</tr>
</table>
@endif
<a href="{{ $url }}" class="brand-name" target="_blank" rel="noopener">{!! $slot !!}</a>
@if ($institution)
<p class="brand-institution">{{ $institution }}</p>
@endif
</td>
</tr>
<tr>
<td class="accent-rule" bgcolor="#c8a24a" height="4" style="height: 4px; line-height: 4px; font-size: 0;">&nbsp;</td>
</tr>
