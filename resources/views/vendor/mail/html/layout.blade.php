<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
<title>{{ config('app.name') }}</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<style>
/* Client resets */
body {
margin: 0 !important;
padding: 0 !important;
width: 100% !important;
}

table {
border-collapse: collapse;
}

img {
border: 0;
line-height: 100%;
outline: none;
text-decoration: none;
}

/* Small screens: media queries cannot be inlined, so they live here. */
@media only screen and (max-width: 620px) {
.wrapper-cell {
padding: 16px 10px !important;
}

.card {
width: 100% !important;
}

.header-cell {
padding: 26px 20px 22px !important;
}

.content-cell {
padding: 26px 20px !important;
}

.footer-cell {
padding: 22px 20px !important;
}

.button-link {
display: block !important;
width: auto !important;
}

h1 {
font-size: 20px !important;
}
}
</style>
{!! $head ?? '' !!}
</head>
<body>

<table class="wrapper" width="100%" cellpadding="0" cellspacing="0" role="presentation" bgcolor="#f4f6f9">
<tr>
<td class="wrapper-cell" align="center" bgcolor="#f4f6f9">
<table class="card" align="center" width="600" cellpadding="0" cellspacing="0" role="presentation" bgcolor="#ffffff">
{!! $header ?? '' !!}

<!-- Email Body -->
<tr>
<td class="content-cell">
{!! Illuminate\Mail\Markdown::parse($slot) !!}

{!! $subcopy ?? '' !!}
</td>
</tr>

{!! $footer ?? '' !!}
</table>
</td>
</tr>
</table>
</body>
</html>
