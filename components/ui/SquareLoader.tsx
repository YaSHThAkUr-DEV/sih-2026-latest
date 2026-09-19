'use client';

import React from 'react';

interface SquareLoaderProps {
  size?: 'sm' | 'md' | 'lg' | number;
  color?: string;
  label?: string;
  subLabel?: string;
  fullScreen?: boolean;
  className?: string;
}

export function SquareLoader({
  size = 'md',
  color = '#2563EB',
  label,
  subLabel,
  fullScreen = false,
  className = '',
}: SquareLoaderProps) {
  let squareSize = 22;
  let offsetSize = 26;

  if (typeof size === 'number') {
    squareSize = size;
    offsetSize = Math.round(size * 1.2);
  } else if (size === 'sm') {
    squareSize = 14;
    offsetSize = 18;
  } else if (size === 'lg') {
    squareSize = 28;
    offsetSize = 34;
  }

  const spinner = (
    <div className={`flex flex-col items-center justify-center gap-3.5 ${className}`}>
      <div
        className="loadingspinner"
        style={
          {
            '--square': `${squareSize}px`,
            '--offset': `${offsetSize}px`,
            '--spinner-color': color,
          } as React.CSSProperties
        }
      >
        <div id="square1" />
        <div id="square2" />
        <div id="square3" />
        <div id="square4" />
        <div id="square5" />
      </div>

      {(label || subLabel) && (
        <div className="flex flex-col items-center text-center">
          {label && (
            <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 tracking-wide">
              {label}
            </p>
          )}
          {subLabel && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {subLabel}
            </p>
          )}
        </div>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-2xl max-w-xs w-full flex flex-col items-center">
          {spinner}
        </div>
      </div>
    );
  }

  return spinner;
}

export default SquareLoader;
