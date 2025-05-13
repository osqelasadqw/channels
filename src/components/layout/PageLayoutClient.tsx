"use client";

import { usePathname } from 'next/navigation';
import React from 'react';

interface PageLayoutClientProps {
  children: React.ReactNode;
}

export default function PageLayoutClient({ children }: PageLayoutClientProps) {
  return (
    <>
      <main className="flex-grow">
        {children}
      </main>
    </>
  );
} 