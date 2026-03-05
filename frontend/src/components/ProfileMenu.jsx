import React, { useState } from 'react';
import { User, Settings, Users, LogOut, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export default function ProfileMenu() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('clinician_auth_session');
    window.location.href = '/login';
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2 h-9 px-3"
          style={{ background: 'transparent', border: 'none' }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'var(--blue-1)', border: '1px solid var(--blue-b)' }}
          >
            <User className="h-4 w-4" style={{ color: 'var(--blue)' }} />
          </div>
          <ChevronDown className="h-4 w-4" style={{ color: 'var(--t2)' }} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem
          onClick={() => navigate('/profile')}
          className="cursor-pointer"
        >
          <User className="mr-2 h-4 w-4" />
          <span>My Profile</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => navigate('/clinic-settings')}
          className="cursor-pointer"
        >
          <Settings className="mr-2 h-4 w-4" />
          <span>Clinic Settings</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => navigate('/team')}
          className="cursor-pointer"
        >
          <Users className="mr-2 h-4 w-4" />
          <span>Team Management</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="cursor-pointer text-red-600"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}