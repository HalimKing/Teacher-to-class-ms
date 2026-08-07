/**
 * Build a WhatsApp share URL with an optional Ghana/local phone number.
 */
export function buildWhatsAppShareUrl(message: string, phone?: string | null): string {
    const text = encodeURIComponent(message);
    const digits = normalizeWhatsAppPhone(phone);

    if (digits) {
        return `https://wa.me/${digits}?text=${text}`;
    }

    return `https://wa.me/?text=${text}`;
}

export function normalizeWhatsAppPhone(phone?: string | null): string | null {
    if (!phone) {
        return null;
    }

    const digits = phone.replace(/\D/g, '');
    if (!digits) {
        return null;
    }

    if (digits.startsWith('233') && digits.length >= 12) {
        return digits;
    }

    if (digits.startsWith('0') && digits.length === 10) {
        return `233${digits.slice(1)}`;
    }

    if (digits.length >= 9) {
        return digits;
    }

    return null;
}

export function buildTemporaryPasswordWhatsAppMessage(input: {
    recipientName: string;
    appName: string;
    loginUrl: string;
    email: string;
    temporaryPassword: string;
}): string {
    return [
        `Hello ${input.recipientName},`,
        '',
        `Your password for ${input.appName} has been reset by an administrator.`,
        '',
        `Login: ${input.loginUrl}`,
        `Email: ${input.email}`,
        `Temporary Password: ${input.temporaryPassword}`,
        '',
        'Please change your password immediately after logging in.',
        'Do not share these credentials with anyone else.',
    ].join('\n');
}
