import React from 'react';
import { cn } from '@/lib/utils';

export default function ContentContainer({ className, ...props }) {
  return <div className={cn('w-full max-w-[1100px] mx-auto px-6', className)} {...props} />;
}
