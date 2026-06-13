import AuthAlert from '@/components/auth/auth-alert';
import AuthFormField from '@/components/auth/auth-form-field';
import PasswordInput from '@/components/auth/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import AuthLayout from '@/layouts/auth-layout';
import { Form, Head } from '@inertiajs/react';
import { Github, LoaderCircle, Mail } from 'lucide-react';

interface LoginProps {
    status?: string;
    canResetPassword: boolean;
}

export default function Login({ status, canResetPassword }: LoginProps) {
    return (
        <AuthLayout
            title="Sign in to your account"
            description="Enter your credentials to access your dashboard."
        >
            <Head title="Log in" />

            <div className="flex flex-col gap-6">
                {status && <AuthAlert variant="success" message={status} />}

                <Form method="post" action={route('login')} resetOnSuccess={['password']} className="flex flex-col gap-6">
                    {({ processing, errors }) => {
                        const authError =
                            errors.email === 'Invalid email or password.' ? errors.email : undefined;
                        const emailFieldError =
                            errors.email && errors.email !== authError ? errors.email : undefined;

                        return (
                        <>
                            {authError && <AuthAlert message={authError} />}

                            <div className="grid gap-5">
                                <AuthFormField
                                    id="email"
                                    name="email"
                                    type="email"
                                    label="Email address"
                                    icon={Mail}
                                    required
                                    autoFocus
                                    tabIndex={1}
                                    autoComplete="email"
                                    placeholder="you@school.edu"
                                    error={emailFieldError}
                                />

                                <PasswordInput
                                    id="password"
                                    name="password"
                                    label="Password"
                                    required
                                    tabIndex={2}
                                    autoComplete="current-password"
                                    placeholder="Enter your password"
                                    error={errors.password}
                                    labelAction={
                                        canResetPassword ? (
                                            <TextLink
                                                href={route('password.request')}
                                                className="text-xs font-medium text-primary no-underline hover:underline"
                                                tabIndex={5}
                                            >
                                                Forgot password?
                                            </TextLink>
                                        ) : undefined
                                    }
                                />

                                <div className="flex items-center gap-3">
                                    <Checkbox id="remember" name="remember" tabIndex={3} />
                                    <Label
                                        htmlFor="remember"
                                        className="cursor-pointer text-sm font-normal text-muted-foreground"
                                    >
                                        Remember me for 30 days
                                    </Label>
                                </div>

                                <Button
                                    type="submit"
                                    className="h-11 w-full text-sm font-medium transition-all duration-200"
                                    tabIndex={4}
                                    disabled={processing}
                                    aria-busy={processing}
                                >
                                    {processing ? (
                                        <>
                                            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                                            Signing in...
                                        </>
                                    ) : (
                                        'Sign in'
                                    )}
                                </Button>
                            </div>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-border" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-10 w-full"
                                    disabled
                                    aria-disabled="true"
                                    title="Coming soon"
                                >
                                    <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
                                        <path
                                            fill="currentColor"
                                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                                        />
                                        <path
                                            fill="currentColor"
                                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                        />
                                        <path
                                            fill="currentColor"
                                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                        />
                                        <path
                                            fill="currentColor"
                                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                        />
                                    </svg>
                                    Google
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-10 w-full"
                                    disabled
                                    aria-disabled="true"
                                    title="Coming soon"
                                >
                                    <Github className="size-4" aria-hidden="true" />
                                    GitHub
                                </Button>
                            </div>

                            <p className="text-center text-xs text-muted-foreground">
                                Social sign-in is not enabled yet. Use your email and password above.
                            </p>
                        </>
                        );
                    }}
                </Form>
            </div>
        </AuthLayout>
    );
}
