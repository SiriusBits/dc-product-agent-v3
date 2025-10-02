// API-related types
// This file will be populated in later tasks

export interface ApiResponse<T = any> {
  data: T;
  success: boolean;
  message?: string;
}