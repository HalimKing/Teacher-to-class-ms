import AuthAlert from '@/components/auth/auth-alert';
import AuthFormField from '@/components/auth/auth-form-field';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import AuthLayout from '@/layouts/auth-layout';
import { Form, Head } from '@inertiajs/react';
import { LoaderCircle, Mail } from 'lucide-react';

export default function ForgotPassword({ status }: { status?: string }) {
    return (
        <AuthLayout
            title="Forgot password"
            description="Enter the email linked to your admin, lecturer, or administrator account. We will send a reset link if it exists."
        >
            <Head title="Forgot password" />

            <div className="flex flex-col gap-6">
                {status && <AuthAlert variant="success" message={status} />}

                <Form method="post" action={route('password.email')} className="flex flex-col gap-6">
                    {({ processing, errors }) => (
                        <>
                            <AuthFormField
                                id="email"
                                name="email"
                                type="email"
                                label="Email address"
                                icon={Mail}
                                required
                                autoFocus
                                autoComplete="email"
                                placeholder="you@school.edu"
                                error={errors.email}
                            />

                            <Button type="submit" className="h-11 w-full text-sm font-medium" disabled={processing} aria-busy={processing}>
                                {processing ? (
                                    <>
                                        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                                        Sending reset link...
                                    </>
                                ) : (
                                    'Email password reset link'
                                )}
                            </Button>
                        </>
                    )}
                </Form>

                <p className="text-center text-sm text-muted-foreground">
                    Remember your password?{' '}
                    <TextLink href={route('login')} className="font-medium text-primary no-underline hover:underline">
                        Back to sign in
                    </TextLink>
                </p>
            </div>
        </AuthLayout>
    );
}
