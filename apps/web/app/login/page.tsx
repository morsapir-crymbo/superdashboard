'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSearchParams } from 'next/navigation';


export default function LoginPage() {
  const [username, setU] = useState('');
  const [password, setP] = useState('');
  const [err, setErr] = useState('');
  const router = useRouter();
  const sp = useSearchParams();
  const urlErr = sp.get('error')

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      const { data } = await api.post('/auth/login', { username, password });
      const token = data?.token;
      if (!token) throw new Error('Missing token');
  
      localStorage.setItem('token', token);
      const isHttps = typeof location !== 'undefined' && location.protocol === 'https:';
      document.cookie =
        `sd_token=${encodeURIComponent(token)}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax${isHttps ? '; Secure' : ''}`;
  
      router.push('/dashboard');
    } catch (e: any) {
      setErr(e?.response?.data?.message || 'Login failed');
    }
  }
  
  {(urlErr || err) && <p className="text-red-600 text-sm">{urlErr || err}</p>}

  return (
    <main className="min-h-screen grid place-items-center bg-gradient-to-b from-slate-50 to-slate-100">
      <Card className="w-full max-w-sm shadow-2xl rounded-2xl">
        <CardHeader>
          <CardTitle className="text-2xl font-extrabold text-center">Login</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={username} onChange={(e) => setU(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setP(e.target.value)} />
            </div>
            {err && <p className="text-red-600 text-sm">{err}</p>}
            <Button className="w-full rounded-xl py-5">Sign in</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
