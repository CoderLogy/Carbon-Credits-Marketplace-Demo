'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { Settings2 } from 'lucide-react';

export type UserRole = 'Admin' | 'Auditor' | 'Project Developer' | 'Market Buyer';

export default function DemoRoleSwitcher({
  currentRole,
  onRoleChange
}: {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
}) {
  return (
    <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-full pl-4 pr-1.5 py-1.5 backdrop-blur-md shadow-lg shadow-black/20">
      <div className="hidden sm:flex items-center gap-2 text-slate-400">
        <Settings2 className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wider">Demo Role:</span>
      </div>
      <Select value={currentRole} onValueChange={(val) => onRoleChange(val as UserRole)}>
        <SelectTrigger id="role-select" className="w-[180px] h-8 bg-black/40 border-white/10 text-emerald-400 text-sm focus:ring-1 focus:ring-emerald-500 rounded-full rounded-l-none sm:rounded-l-full">
          <SelectValue placeholder="Select a role" />
        </SelectTrigger>
        <SelectContent className="bg-slate-900 border-white/10 text-slate-200">
          {currentRole === 'Admin' && <SelectItem value="Admin" className="focus:bg-emerald-500/20 focus:text-emerald-300">Admin (EclimAi Bridge)</SelectItem>}
          <SelectItem value="Auditor" className="focus:bg-emerald-500/20 focus:text-emerald-300">Auditor (VVB)</SelectItem>
          <SelectItem value="Project Developer" className="focus:bg-emerald-500/20 focus:text-emerald-300">Project Developer</SelectItem>
          <SelectItem value="Market Buyer" className="focus:bg-emerald-500/20 focus:text-emerald-300">Market Buyer</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
