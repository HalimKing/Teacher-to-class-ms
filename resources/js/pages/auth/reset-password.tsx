import AuthAlert from '@/components/auth/auth-alert';
import PasswordInput from '@/components/auth/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthLayout from '@/layouts/auth-layout';
import { Form, Head } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';

interface ResetPasswordProps {
    token: string;
    email: string;
    accountType: 'admin' | 'teacher';
}

export default function ResetPassword({ token, email, accountType }: ResetPasswordProps) {
    const accountLabel = accountType === 'teacher' ? 'lecturer / administrator' : 'admin';

    return (
        <AuthLayout
            title="Reset password"
            description={`Choose a new password for your ${accountLabel} account.`}
        >
            <Head title="Reset password" />

            <Form
                method="post"
                action={route('password.store')}
                resetOnSuccess={['password', 'password_confirmation']}
                className="flex flex-col gap-6"
            >
                {({ processing, errors }) => (
                    <>
                        <input type="hidden" name="token" value={token} />
                        <input type="hidden" name="account_type" value={accountType} />

                        <div className="grid gap-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" name="email" value={email} readOnly className="bg-muted/40" />
                        </div>

                        {errors.email && <AuthAlert message={errors.email} />}

                        <PasswordInput
                            id="password"
                            name="password"
                            label="New password"
                            required
                            autoFocus
                            autoComplete="new-password"
                            placeholder="Enter a strong password"
                            error={errors.password}
                        />

                        <PasswordInput
                            id="password_confirmation"
                            name="password_confirmation"
                            label="Confirm password"
                            required
                            autoComplete="new-password"
                            placeholder="Confirm your password"
                            error={errors.password_confirmation}
                        />

                        <Button type="submit" className="h-11 w-full text-sm font-medium" disabled={processing} aria-busy={processing}>
                            {processing ? (
                                <>
                                    <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                                    Resetting password...
                                </>
                            ) : (
                                'Reset password'
                            )}
                        </Button>

                        <p className="text-center text-sm text-muted-foreground">
                            <TextLink href={route('login')} className="font-medium text-primary no-underline hover:underline">
                                Return to sign in
                            </TextLink>
                        </p>
                    </>
                )}
            </Form>
        </AuthLayout>
    );
}
