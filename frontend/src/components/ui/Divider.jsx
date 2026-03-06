import React from 'react';
import { cn } from '@/lib/utils';

export default function Divider({ className }) {
  return <div className={cn('h-px w-full bg-divider', className)} />;
}
