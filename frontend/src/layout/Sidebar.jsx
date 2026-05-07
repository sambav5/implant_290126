import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, Users, Settings, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Sidebar() {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsCollapsed(true);
      } else {
        setIsCollapsed(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'Cases', icon: FolderKanban, path: '/' },
    { name: 'Templates', icon: FileText, path: '/templates' },
    { name: 'Team', icon: Users, path: '/team' },
    { name: 'Settings', icon: Settings, path: '/clinic-settings' },
  ];

  return (
    <aside className={cn("app-sidebar group", isCollapsed ? "w-20" : "w-64")}>
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-6 bg-white border border-[#E5E7EB] rounded-full p-1 shadow-sm text-[#6B7280] hover:text-[#1F7A63] z-20 hidden md:block"
      >
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {/* For mobile, show the toggle inside the sidebar header */}
      <div className={cn("p-6 flex items-center", isCollapsed ? "justify-center px-0" : "justify-between")}>
        {!isCollapsed && (
          <Link to="/" className="text-xl font-bold tracking-tight text-[#1A1A1A]">
            Seamless
          </Link>
        )}
        {isCollapsed && (
          <Link to="/" className="text-xl font-bold tracking-tight text-[#1A1A1A]">
            S
          </Link>
        )}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="md:hidden text-[#6B7280] hover:text-[#1F7A63]"
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>
      
      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path && item.name === 'Dashboard';
          
          return (
            <Link
              key={item.name}
              to={item.path}
              title={isCollapsed ? item.name : undefined}
              className={cn(
                'flex items-center rounded-lg text-sm font-medium transition-colors',
                isCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2',
                isActive 
                  ? 'bg-[#1F7A63]/10 text-[#1F7A63]' 
                  : 'text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#1A1A1A]'
              )}
            >
              <item.icon className={cn("flex-shrink-0", isCollapsed ? "h-6 w-6" : "h-5 w-5")} />
              {!isCollapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>
      
      <div className="p-4">
        {!isCollapsed ? (
          <div className="bg-[#F3F4F6] rounded-lg p-4">
            <p className="text-xs text-[#6B7280] font-medium uppercase tracking-wider mb-2">Workspace</p>
            <p className="text-sm font-medium text-[#1A1A1A] truncate">My Clinic</p>
          </div>
        ) : (
          <div className="bg-[#F3F4F6] rounded-lg p-2 flex justify-center">
            <div className="h-8 w-8 bg-[#1F7A63] rounded-full flex items-center justify-center text-white font-bold text-xs">
              MC
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
