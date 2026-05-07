import { Search } from 'lucide-react';
import ProfileMenu from '@/components/ProfileMenu';

export default function TopBar({ children }) {
  return (
    <header className="app-header">
      <div className="flex-1 flex items-center min-w-0 mr-4">
        {children}
      </div>
      
      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="hidden md:flex relative items-center">
          <Search className="absolute left-3 h-4 w-4 text-[#6B7280]" />
          <input 
            type="text" 
            placeholder="Search..." 
            className="pl-9 pr-4 py-2 bg-[#F3F4F6] border-transparent rounded-lg text-sm focus:bg-white focus:border-[#1F7A63] focus:ring-1 focus:ring-[#1F7A63] transition-all w-64 outline-none"
          />
        </div>
        <ProfileMenu />
      </div>
    </header>
  );
}
