'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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

  const ROWS_PER_PAGE = 15;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  const pageRows = useMemo(() => {
    const start = (page - 1) * ROWS_PER_PAGE;
    return rows.slice(start, start + ROWS_PER_PAGE);
  }, [rows, page]);

  const load = async () => {
    try {
      const { data } = await api.get('/envs');
      setRows(data);
      setErr('');
      setPage(1);
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

  const fmt = new Intl.DateTimeFormat('en-GB', {
    year: '2-digit', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });

  return (
    <main className="h-screen overflow-hidden bg-gradient-to-b from-white to-slate-100">
      <div className="mx-auto h-full max-w-5xl px-3">
        <Card className="h-full flex flex-col shadow-xl">
          <CardHeader className="flex-shrink-0 py-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-xl font-bold tracking-tight">Environments & Versions</CardTitle>
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-xl h-8 px-3 text-xs">Add</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add new environment</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-2 py-1">
                    <label className="text-sm font-medium">Environment name</label>
                    <Input
                      placeholder="e.g. production"
                      value={newEnvName}
                      onChange={(e) => setNewEnvName(e.target.value)}
                    />
                  </div>
                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => setCreateOpen(false)} className="h-8 px-3 text-xs">Cancel</Button>
                    <Button onClick={createEnv} disabled={!newEnvName.trim()} className="h-8 px-3 text-xs">Create</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-hidden py-0">
            {loading ? (
              <p className="text-center py-6 text-sm">Loading…</p>
            ) : (
              <div className="h-full flex flex-col">
                <div className="flex-1">
                  <Table className="table-fixed text-xs leading-none">
                    <colgroup>
                      <col className="w-[38%]" />
                      <col className="w-[20%]" />
                      <col className="w-[27%]" />
                      <col className="w-[15%]" />
                    </colgroup>

                    <TableHeader>
                      <TableRow className="h-8">
                        <TableHead className="text-left">Name</TableHead>
                        <TableHead className="text-left">Version</TableHead>
                        <TableHead className="text-left">Updated</TableHead>
                        <TableHead className="text-left">Actions</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {pageRows.map((r) => (
                        <TableRow key={r.id} className="h-12">
                          <TableCell className="text-left font-medium py-1 truncate">{r.name}</TableCell>
                          <TableCell className="text-left tabular-nums py-1">{r.version}</TableCell>
                          <TableCell className="text-left whitespace-nowrap py-1">
                            {fmt.format(new Date(r.updatedAt))}
                          </TableCell>
                          <TableCell className="text-left py-1">
                            <Dialog
                              open={updateOpen && selectedEnv?.id === r.id}
                              onOpenChange={(o) => {
                                setUpdateOpen(o);
                                if (o) { setSelectedEnv(r); setNewVersion(''); } else { setSelectedEnv(null); }
                              }}
                            >
                              <DialogTrigger asChild>
                                <Button variant="secondary" className="rounded-lg h-7 px-2 text-xs">
                                  Update
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                  <DialogTitle className="text-sm">Update version — {r.name}</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-2 py-1">
                                  <label className="text-sm font-medium">Version</label>
                                  <Input
                                    placeholder="e.g. 1.2.3"
                                    value={newVersion}
                                    onChange={(e) => setNewVersion(e.target.value)}
                                  />
                                </div>
                                <DialogFooter className="gap-2 sm:gap-0">
                                  <Button variant="outline" onClick={() => setUpdateOpen(false)} className="h-8 px-3 text-xs">Cancel</Button>
                                  <Button onClick={updateVersion} disabled={!newVersion.trim()} className="h-8 px-3 text-xs">Update</Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {err && <p className="text-red-600 text-center mt-2 text-xs">{err}</p>}
                </div>

                <div className="flex items-center justify-between gap-3 py-2">
                  <span className="text-[11px] text-slate-600">
                    Showing {(page - 1) * ROWS_PER_PAGE + 1}
                    –{Math.min(page * ROWS_PER_PAGE, rows.length)} of {rows.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="h-8 px-2 text-xs"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      Prev
                    </Button>
                    <span className="text-[11px] tabular-nums">
                      {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="h-8 px-2 text-xs"
                    >
                      Next
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
