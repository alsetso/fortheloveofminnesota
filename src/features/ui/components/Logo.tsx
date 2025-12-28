'use client';

import React from 'react';
import Image from 'next/image';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  variant?: 'default' | 'light';
}

const sizeToHeightClass: Record<NonNullable<LogoProps['size']>, string> = {
  sm: 'h-6',
  md: 'h-8',
  lg: 'h-12',
};

export default function Logo({ size = 'md', className = '', variant = 'default' }: LogoProps) {
  const heightClass = sizeToHeightClass[size];
  
  return (
    <div className={`relative ${heightClass} ${className}`} style={{ width: 'auto' }}>
      <Image
        src="/heart.png"
        alt="For the Love of Minnesota Logo"
        width={50}
        height={50}
        className={`h-full w-auto object-contain ${variant === 'light' ? 'opacity-90' : ''}`}
        priority
      />
    </div>
  );
}


