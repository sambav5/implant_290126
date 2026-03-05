import React from 'react';
import { cn } from '@/lib/utils';

export default function SecondaryButton({ className, ...props }) {
  return (
    <button
      className={cn('inline-flex items-center justify-center rounded-[2px] border border-forest bg-transparent px-8 py-[18px] font-sans text-[12px] uppercase tracking-[0.12em] text-forest transition-colors hover:bg-forest hover:text-champagne disabled:opacity-50', className)}
      {...props}
    />
  );
}
