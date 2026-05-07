import { cn } from '@/lib/utils';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function AppLayout({ children, headerContent, footerActions, contentClassName }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <TopBar>{headerContent}</TopBar>
        <main className={cn('app-content', contentClassName)}>
          <div className="max-w-6xl mx-auto w-full">
            {children}
          </div>
        </main>
        {footerActions && <footer className="app-footer">{footerActions}</footer>}
      </div>
    </div>
  );
}
