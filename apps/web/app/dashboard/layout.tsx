import { Sidebar } from '@/components/dashboard/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-100">
      <Sidebar />
      <main className="ml-56 min-h-screen">
        {children}
      </main>
    </div>
  );
}
