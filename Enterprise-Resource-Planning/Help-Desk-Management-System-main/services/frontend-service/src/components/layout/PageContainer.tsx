'use client';

import React from 'react';
import { THEME } from '../../lib/theme';

interface PageContainerProps {
  children: React.ReactNode;
  /** Remove max-width constraint — useful for wide tables */
  fluid?: boolean;
  className?: string;
}

/**
 * Standard padded container for all non-fullscreen pages.
 * Replaces the old Layout inner wrapper.
 * Use this in: dashboards, list pages, forms, profile, settings.
 *
 * For the ticket detail split layout, do NOT use this — build your own
 * full-height wrapper directly in the page.
 */
export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  fluid = false,
  className = '',
}) => {
  return (
    <div
      className={`min-h-screen p-4 md:p-6 lg:p-8 ${fluid ? '' : 'max-w-7xl mx-auto'} ${className}`}
      style={{ backgroundColor: THEME.colors.background }}
    >
      {children}
    </div>
  );
};

export default PageContainer;
