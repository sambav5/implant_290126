import React from 'react';
import { cn } from '@/lib/utils';

export default function Panel({ className, ...props }) {
  return <div className={cn('border border-divider bg-champagne p-8 rounded-[2px]', className)} {...props} />;
}
