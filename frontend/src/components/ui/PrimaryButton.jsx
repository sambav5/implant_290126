import React from 'react';
import { cn } from '@/lib/utils';

export default function PrimaryButton({ className, ...props }) {
  return (
    <button
      className={cn('inline-flex items-center justify-center rounded-[2px] bg-forest px-8 py-[18px] font-sans text-[12px] uppercase tracking-[0.12em] text-champagne transition-colors hover:bg-[#142A22] disabled:opacity-50', className)}
      {...props}
    />
  );
}
