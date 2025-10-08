import type { ComponentType, ReactNode } from "react";

// Re-export shared types
export type * from "@repo/shared-types";

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
  currentPage?: "chat" | "browse" | "docs";
}

export interface ComponentProps {
  className?: string;
  children?: ReactNode;
}