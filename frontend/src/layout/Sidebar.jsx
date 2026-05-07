import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, Users, Settings, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Sidebar() {
  const location = useLocation();
  
  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'Cases', icon: FolderKanban, path: '/' },
    { name: 'Templates', icon: FileText, path: '/templates' },
    { name: 'Team', icon: Users, path: '/team' },
    { name: 'Settings', icon: Settings, path: '/clinic-settings' },
  ];

  return (
    <aside className="app-sidebar">
      <div className="p-6">
        <Link to="/" className="text-xl font-bold tracking-tight text-[#1A1A1A]">
          Seamless
        </Link>
      </div>
      
      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => {
          // Simplistic active check
          const isActive = location.pathname === item.path && item.name === 'Dashboard';
          // Cases can map to Dashboard for now if no dedicated Cases route
          
          return (
            <Link
              key={item.name}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive 
                  ? 'bg-[#1F7A63]/10 text-[#1F7A63]' 
                  : 'text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#1A1A1A]'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>
      
      <div className="p-4">
        <div className="bg-[#F3F4F6] rounded-lg p-4">
          <p className="text-xs text-[#6B7280] font-medium uppercase tracking-wider mb-2">Workspace</p>
          <p className="text-sm font-medium text-[#1A1A1A] truncate">My Clinic</p>
        </div>
      </div>
    </aside>
  );
}
