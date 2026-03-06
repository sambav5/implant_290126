import React from 'react';
import { cn } from '@/lib/utils';

export default function Section({ className, ...props }) {
  return <section className={cn('py-24', className)} {...props} />;
}
