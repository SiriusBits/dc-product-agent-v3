import type { ComponentType, ReactNode } from 'react';

// Re-export shared types
export type * from '@repo/shared-types';

// Frontend-specific types
export interface NavigationItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  current?: boolean;
}

export interface PageProps {
  title: string;
  description?: string;
  currentPage?: 'chat' | 'browse' | 'docs';
}

export interface ComponentProps {
  className?: string;
  children?: ReactNode;
}

// Product types for frontend (extending shared types)
export type ProductFamily =
  | 'ASA'
  | 'DCA'
  | 'ECA'
  | 'DDSA'
  | 'MHHPA'
  | 'NMA'
  | 'OSA'
  | 'ODSA'
  | 'CG'
  | 'DCE'
  | 'HHPA'
  | 'THPA'
  | 'PI'
  | 'MAHP'
  | 'NSA'
  | 'JP-10'
  | 'AP-6G'
  | 'MC818'
  | 'EH Diol';

export interface Product {
  id: string;
  name: string;
  shortName?: string;
  family?: ProductFamily;
  casNumber?: string;
  chemicalName?: string;
  synonyms?: string[];
  properties?: Array<{
    category: string;
    name: string;
    valueString?: string;
    valueNumeric?: number;
    unit?: string;
    testMethod?: string;
  }>;
  applications?: string[];
  keyBenefits?: string[];
}
