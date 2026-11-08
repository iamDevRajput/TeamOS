'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { AuthMeResponseDto, OrgDto } from '@teamos/contracts';
import { BuildingIcon, ChevronDownIcon, CheckCircleIcon, PlusIcon, ShieldIcon } from './ui/icons';

interface NavbarProps {
  sessionData: AuthMeResponseDto;
  orgs: OrgDto[];
  activeOrg: OrgDto | null;
  onSelectOrg: (org: OrgDto) => void;
  onOpenCreateOrg: () => void;
  onLogout: () => void;
}

export function Navbar({
  sessionData,
  orgs,
  activeOrg,
  onSelectOrg,
  onOpenCreateOrg,
  onLogout,
}: NavbarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/90 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 sm:gap-6">
          {/* Brand Logo */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-sm shadow-xs border border-blue-700/30">
              <span className="tracking-tighter">OS</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-base font-bold tracking-tight text-slate-900">
                TeamOS
              </span>
              <span className="hidden md:inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200/80 rounded-full">
                Delivery Risk Intelligence
              </span>
            </div>
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          {/* Organization Switcher Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen((prev) => !prev)}
              aria-haspopup="true"
              aria-expanded={dropdownOpen}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-xs focus-visible:outline-2 focus-visible:outline-blue-500"
            >
              <BuildingIcon className="w-3.5 h-3.5 text-slate-400" />
              <span className="max-w-[120px] sm:max-w-[160px] truncate text-slate-800 font-medium">
                {activeOrg ? activeOrg.name : 'Select Organization'}
              </span>
              {activeOrg && (
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wide ${
                    activeOrg.role === 'OWNER'
                      ? 'bg-purple-50 text-purple-700 border border-purple-200/80'
                      : activeOrg.role === 'ADMIN'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200/80'
                      : 'bg-slate-100 text-slate-600 border border-slate-200/80'
                  }`}
                >
                  {activeOrg.role}
                </span>
              )}
              <ChevronDownIcon className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
            </button>

            {dropdownOpen && (
              <div className="absolute left-0 mt-1.5 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-dropdown z-50 animate-in fade-in duration-100">
                <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Your Organizations</span>
                  <span className="font-mono text-[10px] text-slate-400">{orgs.length}</span>
                </div>
                <div className="space-y-1 max-h-56 overflow-y-auto pt-1">
                  {orgs.map((org) => {
                    const isSelected = activeOrg?.id === org.id;
                    return (
                      <button
                        key={org.id}
                        type="button"
                        onClick={() => {
                          onSelectOrg(org);
                          setDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors ${
                          isSelected
                            ? 'bg-blue-50/80 text-blue-900 font-semibold border border-blue-200/60'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <div className="flex h-5 w-5 items-center justify-center rounded bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-700">
                            {org.name.slice(0, 1).toUpperCase()}
                          </div>
                          <span className="truncate">{org.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                              org.role === 'OWNER'
                                ? 'bg-purple-100 text-purple-700'
                                : org.role === 'ADMIN'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {org.role}
                          </span>
                          {isSelected && <CheckCircleIcon className="w-3.5 h-3.5 text-blue-600" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-2 border-t border-slate-100 pt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      onOpenCreateOrg();
                    }}
                    className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    <span>Create Organization</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right side: Security badge & User profile */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200/90 rounded-md">
            <ShieldIcon className="w-3.5 h-3.5 text-emerald-600" />
            <span>RLS Active</span>
          </div>

          <div className="flex items-center gap-2.5">
            {sessionData.user.avatarUrl ? (
              <img
                src={sessionData.user.avatarUrl}
                alt={sessionData.user.login}
                className="w-7 h-7 rounded-full border border-slate-200 object-cover"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs">
                {sessionData.user.login.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="hidden sm:block text-left text-xs leading-tight">
              <div className="font-semibold text-slate-900 truncate max-w-[120px]">
                {sessionData.user.displayName || sessionData.user.login}
              </div>
              <div className="text-[10px] text-slate-400">@{sessionData.user.login}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-blue-500"
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
