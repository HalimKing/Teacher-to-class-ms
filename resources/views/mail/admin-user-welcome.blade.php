<x-mail::message>
# Welcome to {{ $appName }}

Hello {{ $name }},

An administrator account has been created for you on **{{ $appName }}**. Use the login details below to sign in for the first time.

## Login Details

<x-mail::panel>
**Email:** {{ $email }}

**Temporary Password:** {{ $temporaryPassword }}
</x-mail::panel>

Log in with these credentials, then **change your password immediately** after your first login. You will be prompted to set a new password for security.

Assigned roles: {{ $roles }}  
Account created by: {{ $createdByName }}

<x-mail::button :url="$loginUrl">
Login
</x-mail::button>

If you did not expect this account, contact your system administrator immediately.

Thanks,<br>
{{ $appName }}
</x-mail::message>
