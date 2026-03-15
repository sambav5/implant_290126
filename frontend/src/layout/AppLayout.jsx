import { cn } from '@/lib/utils';

export default function AppLayout({ children, headerContent, footerActions, contentClassName }) {
  return (
    <div className={cn('app-layout', footerActions && 'has-footer')}>
      {headerContent && <header className="app-header">{headerContent}</header>}
      <main className={cn('app-content', contentClassName)}>{children}</main>
      {footerActions && <footer className="app-footer">{footerActions}</footer>}
    </div>
  );
}
