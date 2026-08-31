import type { RoleKey, BranchKey } from './types';

export const ROLES: RoleKey[] = [
  'مشرف العام',
  'مراقب العام',
  'مسؤل الخلية',
  'مراقب القسم',
];

export const BRANCHES: BranchKey[] = ['حي محمدي', 'عين السبع', 'روش نوار'];

export const ROLE_META: Record<RoleKey, { label: string; color: string; bg: string; text: string; border: string }> = {
  'مشرف العام': { label: 'مشرف العام', color: '#7c3aed', bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  'مراقب العام': { label: 'مراقب العام', color: '#2563eb', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  'مسؤل الخلية': { label: 'مسؤل الخلية', color: '#0d9488', bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  'مراقب القسم': { label: 'مراقب القسم', color: '#d97706', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
};

export const BRANCH_META: Record<BranchKey, { label: string; color: string; bg: string; text: string }> = {
  'حي محمدي': { label: 'حي محمدي', color: '#e11d48', bg: 'bg-rose-50', text: 'text-rose-700' },
  'عين السبع': { label: 'عين السبع', color: '#0284c7', bg: 'bg-sky-50', text: 'text-sky-700' },
  'روش نوار': { label: 'روش نوار', color: '#16a34a', bg: 'bg-green-50', text: 'text-green-700' },
};

export const CREATABLE_ROLES: Record<RoleKey, RoleKey[]> = {
  'مشرف العام': ['مشرف العام', 'مراقب العام', 'مسؤل الخلية', 'مراقب القسم'],
  'مراقب العام': ['مسؤل الخلية', 'مراقب القسم'],
  'مسؤل الخلية': ['مراقب القسم'],
  'مراقب القسم': [],
};

export function canCreateUsers(role: RoleKey): boolean {
  return CREATABLE_ROLES[role].length > 0;
}

export function canAddVoters(role: RoleKey): boolean {
  return role !== 'مراقب القسم';
}

export function canViewAllBranches(role: RoleKey): boolean {
  return role === 'مشرف العام';
}
