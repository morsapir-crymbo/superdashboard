'use client';

import { Suspense, useEffect } from 'react';
import { useState } from 'react';
import api from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { BarChart3 } from 'lucide-react';

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

const ERROR_MESSAGES: Record<string, string> = {
  google_error: 'Google sign-in failed. Please try again.',
  invalid_state: 'Invalid request. Please try signing in again.',
  domain_mismatch: 'Your email domain is not authorized for this application.',
  no_email: 'Could not retrieve email from Google. Please try again.',
  auth_failed: 'Authentication failed. Please try again.',
  missing_code: 'Authorization code missing. Please try again.',
};

function LoginInner() {
  const [username, setU] = useState('');
  const [password, setP] = useState('');
  const [err, setErr] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const errorCode = searchParams.get('error');
    const email = searchParams.get('email');
    if (errorCode) {
      let message = ERROR_MESSAGES[errorCode] || 'An error occurred. Please try again.';
      if (errorCode === 'domain_mismatch' && email) {
        message = `The email ${email} is not authorized for this application.`;
      }
      setErr(message);
    }
  }, [searchParams]);

  async function handleCredentialLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setIsLoading(true);
    try {
      const body = new URLSearchParams({ username, password });

      const { data } = await api.post('/auth/login', body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      const token = data?.token;
      if (!token) throw new Error('Missing token');
      localStorage.setItem('token', token);

      const isHttps = typeof location !== 'undefined' && location.protocol === 'https:';
      document.cookie = `sd_token=${encodeURIComponent(token)}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax${isHttps ? '; Secure' : ''}`;

      router.push('/dashboard');
    } catch (e: any) {
      setErr(e?.response?.data?.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  }

  function handleGoogleLogin() {
    const returnTo = searchParams.get('returnTo') || '/dashboard';
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    window.location.href = `${apiUrl}/auth/google?returnTo=${encodeURIComponent(returnTo)}`;
  }

  return (
    <main className="min-h-screen grid place-items-center bg-gradient-to-b from-slate-50 to-slate-100">
      <Card className="w-full max-w-sm shadow-2xl rounded-2xl">
        <CardHeader className="text-center space-y-4">
          <CardTitle className="text-xl">
            <div className="flex items-center justify-center gap-2 text-foreground">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <BarChart3 className="size-5" />
              </div>
              <span className="text-xl font-semibold tracking-tight">Super Dashboard</span>
            </div>
          </CardTitle>
          <CardDescription>Sign in to access the dashboard</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {err && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">
              {err}
            </div>
          )}

          <Button
            variant="outline"
            className="w-full cursor-pointer gap-2 h-11"
            onClick={handleGoogleLogin}
            type="button"
          >
            <GoogleIcon className="size-5" />
            Sign in with Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <form onSubmit={handleCredentialLogin} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setU(e.target.value)}
                placeholder="Enter username"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setP(e.target.value)}
                placeholder="Enter password"
              />
            </div>
            <Button className="w-full rounded-xl py-5" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
