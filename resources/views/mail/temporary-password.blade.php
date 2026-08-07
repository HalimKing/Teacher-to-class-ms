<x-mail::message>
# Password Reset – {{ $appName }}

Hello {{ $name }},

Your {{ $accountType }} password on **{{ $appName }}** has been reset by {{ $sharedByName }}. Use the temporary credentials below to sign in.

## Login Details

<x-mail::panel>
**Email:** {{ $email }}

**Temporary Password:** {{ $temporaryPassword }}
</x-mail::panel>

For your security, **change this password immediately** after your first login. Do not share these credentials with anyone else.

<x-mail::button :url="$loginUrl">
Login
</x-mail::button>

If you did not expect this reset, contact your system administrator immediately.

Thanks,<br>
{{ $appName }}
</x-mail::message>
