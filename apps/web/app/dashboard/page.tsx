'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type Env = { id: number; name: string; version: string; updatedAt: string };

export default function Dashboard() {
  const [rows, setRows] = useState<Env[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [newEnvName, setNewEnvName] = useState('');

  const [updateOpen, setUpdateOpen] = useState(false);
  const [selectedEnv, setSelectedEnv] = useState<Env | null>(null);
  const [newVersion, setNewVersion] = useState('');

  const load = async () => {
    try {
      const { data } = await api.get('/envs');
      setRows(data);
      setErr('');
    } catch {
      setErr('Failed to load environments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  async function createEnv() {
    if (!newEnvName.trim()) return;
    await api.post('/envs', { name: newEnvName.trim() });
    setNewEnvName('');
    setCreateOpen(false);
    load();
  }

  async function updateVersion() {
    if (!selectedEnv || !newVersion.trim()) return;
    await api.post('/versions/update', { name: selectedEnv.name, version: newVersion.trim() });
    setNewVersion('');
    setUpdateOpen(false);
    setSelectedEnv(null);
    load();
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-slate-100">
      <div className="container mx-auto max-w-5xl py-10">
        <Card className="shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-3xl font-extrabold tracking-tight">Environments & Versions</CardTitle>

            {/* Add Environment button + dialog */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-2xl px-5">Add Environment</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add new environment</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Environment name</label>
                    <Input
                      placeholder="e.g. production"
                      value={newEnvName}
                      onChange={(e) => setNewEnvName(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                  <Button onClick={createEnv} disabled={!newEnvName.trim()}>Create</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>

          <CardContent>
  {loading ? (
    <p className="text-center py-10">Loading…</p>
  ) : (
    <div className="mx-auto max-w-4xl">
      <Table className="table-fixed">   {/* חשוב: table-fixed */}
        <colgroup>
          <col className="w-[40%]" />   {/* Name */}
          <col className="w-[20%]" />   {/* Version */}
          <col className="w-[25%]" />   {/* Updated */}
          <col className="w-[15%]" />   {/* Actions */}
        </colgroup>

        <TableHeader>
          <TableRow>
            <TableHead className="text-left">Name</TableHead>
            <TableHead className="text-left">Version</TableHead>
            <TableHead className="text-left">Updated</TableHead>
            <TableHead className="text-left">Actions</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="text-left font-medium">{r.name}</TableCell>
              <TableCell className="text-left tabular-nums">{r.version}</TableCell>
              <TableCell className="text-left">
                {new Date(r.updatedAt).toLocaleString('en-US')}
              </TableCell>
              <TableCell className="text-left">
                <Dialog
                  open={updateOpen && selectedEnv?.id === r.id}
                  onOpenChange={(o) => {
                    setUpdateOpen(o);
                    if (o) { setSelectedEnv(r); setNewVersion(''); } else { setSelectedEnv(null); }
                  }}
                >
                  <DialogTrigger asChild>
                              <Button variant="secondary" className="rounded-xl">Update version</Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                              <DialogHeader>
                                <DialogTitle>Update version — {r.name}</DialogTitle>
                              </DialogHeader>
                              <div className="grid gap-3 py-4">
                                <div className="grid gap-2">
                                  <label className="text-sm font-medium">Version</label>
                                  <Input
                                    placeholder="e.g. 1.2.3"
                                    value={newVersion}
                                    onChange={(e) => setNewVersion(e.target.value)}
                                  />
                                </div>
                              </div>
                              <DialogFooter className="gap-2 sm:gap-0">
                                <Button variant="outline" onClick={() => setUpdateOpen(false)}>Cancel</Button>
                                <Button onClick={updateVersion} disabled={!newVersion.trim()}>Update</Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {err && <p className="text-red-600 text-center mt-4">{err}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
