'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, GitBranch, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  {
    href: '/dashboard/stats',
    label: 'Stats',
    icon: BarChart3,
  },
  {
    href: '/dashboard/vertion',
    label: 'Vertion',
    icon: GitBranch,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  const handleLogout = () => {
    localStorage.removeItem('token');
    document.cookie = 'sd_token=; Path=/; Max-Age=0';
    window.location.href = '/login';
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-white border-r border-slate-200 shadow-lg flex flex-col">
      <div className="p-4 border-b border-slate-200">
        <h1 className="text-lg font-bold text-slate-800">SuperDashboard</h1>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-200">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors w-full"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
