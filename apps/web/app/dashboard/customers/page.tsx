'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react';

type Customer = {
  id: number;
  name: string;
  version: string;
  customerType: string | null;
  status: string;
  signedDate: string | null;
  goLiveDate: string | null;
  openRequests: number;
  comment: string | null;
  updatedAt: string;
  createdAt: string;
};

type FormData = {
  name: string;
  version: string;
  customerType: string;
  status: string;
  signedDate: string;
  goLiveDate: string;
  openRequests: string;
  comment: string;
};

const STATUS_OPTIONS = [
  { value: 'live', label: 'Live' },
  { value: 'uat', label: 'UAT' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'block', label: 'Block' },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'live':
      return 'bg-green-100 text-green-800';
    case 'uat':
      return 'bg-blue-100 text-blue-800';
    case 'onboarding':
      return 'bg-yellow-100 text-yellow-800';
    case 'block':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const emptyForm: FormData = {
  name: '',
  version: '0.0.0',
  customerType: '',
  status: 'onboarding',
  signedDate: '',
  goLiveDate: '',
  openRequests: '0',
  comment: '',
};

export default function CustomersPage() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  const ROWS_PER_PAGE = 10;
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
    } catch {
      setErr('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openAddModal = () => {
    setEditingCustomer(null);
    setFormData(emptyForm);
    setModalOpen(true);
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      version: customer.version,
      customerType: customer.customerType || '',
      status: customer.status,
      signedDate: customer.signedDate ? customer.signedDate.split('T')[0] : '',
      goLiveDate: customer.goLiveDate ? customer.goLiveDate.split('T')[0] : '',
      openRequests: String(customer.openRequests),
      comment: customer.comment || '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingCustomer(null);
    setFormData(emptyForm);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;
    
    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        version: formData.version.trim() || '0.0.0',
        customerType: formData.customerType.trim() || null,
        status: formData.status,
        signedDate: formData.signedDate || null,
        goLiveDate: formData.goLiveDate || null,
        openRequests: parseInt(formData.openRequests) || 0,
        comment: formData.comment.trim() || null,
      };

      if (editingCustomer) {
        await api.put(`/envs/${editingCustomer.id}`, payload);
      } else {
        await api.post('/envs', payload);
      }
      
      closeModal();
      load();
    } catch (error) {
      setErr(editingCustomer ? 'Failed to update customer' : 'Failed to create customer');
    } finally {
      setSaving(false);
    }
  };

  const openDeleteDialog = (customer: Customer) => {
    setCustomerToDelete(customer);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!customerToDelete) return;
    
    setDeleting(true);
    try {
      await api.delete(`/envs/${customerToDelete.id}`);
      setDeleteDialogOpen(false);
      setCustomerToDelete(null);
      load();
    } catch {
      setErr('Failed to delete customer');
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div className="h-screen overflow-hidden p-4">
      <Card className="h-full flex flex-col shadow-xl">
        <CardHeader className="flex-shrink-0 py-4 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold tracking-tight">Customers</CardTitle>
            <Button onClick={openAddModal} className="rounded-xl h-9 px-4 text-sm gap-2">
              <Plus className="h-4 w-4" />
              Add Customer
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden py-0">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-gray-500">Loading...</p>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              <div className="flex-1 overflow-auto">
                <Table className="text-sm">
                  <TableHeader>
                    <TableRow className="h-12 bg-gray-50">
                      <TableHead className="font-semibold">Name</TableHead>
                      <TableHead className="font-semibold">Version</TableHead>
                      <TableHead className="font-semibold">Customer Type</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold">Signed Date</TableHead>
                      <TableHead className="font-semibold">Go Live Date</TableHead>
                      <TableHead className="font-semibold text-center">Open Requests</TableHead>
                      <TableHead className="font-semibold">Comment</TableHead>
                      <TableHead className="font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {pageRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                          No customers found. Click "Add Customer" to create one.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pageRows.map((customer) => (
                        <TableRow key={customer.id} className="h-14 hover:bg-gray-50">
                          <TableCell className="font-medium">{customer.name}</TableCell>
                          <TableCell className="tabular-nums text-gray-600">{customer.version}</TableCell>
                          <TableCell className="text-gray-600">{customer.customerType || '-'}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(customer.status)}`}>
                              {customer.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-gray-600">{formatDate(customer.signedDate)}</TableCell>
                          <TableCell className="text-gray-600">{formatDate(customer.goLiveDate)}</TableCell>
                          <TableCell className="text-center">
                            {customer.openRequests > 0 ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-800 text-xs font-medium">
                                {customer.openRequests}
                              </span>
                            ) : (
                              <span className="text-gray-400">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-gray-600 max-w-[200px] truncate" title={customer.comment || ''}>
                            {customer.comment || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditModal(customer)}
                                className="h-8 w-8 p-0 hover:bg-gray-100"
                              >
                                <Pencil className="h-4 w-4 text-gray-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDeleteDialog(customer)}
                                className="h-8 w-8 p-0 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>

                {err && <p className="text-red-600 text-center mt-4 text-sm">{err}</p>}
              </div>

              {rows.length > 0 && (
                <div className="flex items-center justify-between gap-3 py-4 border-t border-gray-100">
                  <span className="text-sm text-gray-600">
                    Showing {(page - 1) * ROWS_PER_PAGE + 1}–{Math.min(page * ROWS_PER_PAGE, rows.length)} of {rows.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="h-9 px-3 text-sm"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <span className="text-sm tabular-nums px-2">
                      {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="h-9 px-3 text-sm"
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="Customer name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="version">Version</Label>
                <Input
                  id="version"
                  placeholder="0.0.0"
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerType">Customer Type</Label>
                <Input
                  id="customerType"
                  placeholder="e.g. Enterprise, SMB"
                  value={formData.customerType}
                  onChange={(e) => setFormData({ ...formData, customerType: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  id="status"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="signedDate">Signed Date</Label>
                <Input
                  id="signedDate"
                  type="date"
                  value={formData.signedDate}
                  onChange={(e) => setFormData({ ...formData, signedDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goLiveDate">Go Live Date</Label>
                <Input
                  id="goLiveDate"
                  type="date"
                  value={formData.goLiveDate}
                  onChange={(e) => setFormData({ ...formData, goLiveDate: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="openRequests">Open Requests</Label>
              <Input
                id="openRequests"
                type="number"
                min="0"
                value={formData.openRequests}
                onChange={(e) => setFormData({ ...formData, openRequests: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="comment">Comment</Label>
              <Textarea
                id="comment"
                placeholder="Add any notes or comments..."
                value={formData.comment}
                onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!formData.name.trim() || saving}>
              {saving ? 'Saving...' : editingCustomer ? 'Save Changes' : 'Create Customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{customerToDelete?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
