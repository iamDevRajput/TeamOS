'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { AuthMeResponseDto, OrgDto } from '@teamos/contracts';

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
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white font-black text-lg shadow-sm">
              T
            </span>
            <div>
              <span className="text-lg font-black tracking-tight text-slate-900">
                TeamOS
              </span>
              <span className="hidden sm:inline-block ml-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 rounded-full">
                Delivery Risk
              </span>
            </div>
          </div>

          {/* Organization Switcher Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <div className="flex h-5 w-5 items-center justify-center rounded bg-slate-300 text-[10px] font-bold text-slate-700">
                {activeOrg ? activeOrg.name.slice(0, 1).toUpperCase() : 'O'}
              </div>
              <span className="max-w-[130px] sm:max-w-[180px] truncate">
                {activeOrg ? activeOrg.name : 'Select Organization'}
              </span>
              {activeOrg && (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-slate-200 text-slate-700">
                  {activeOrg.role}
                </span>
              )}
              <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {dropdownOpen && (
              <div className="absolute left-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl ring-1 ring-black/5 z-50">
                <div className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Your Organizations
                </div>
                <div className="space-y-1 max-h-56 overflow-y-auto">
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
                            ? 'bg-blue-50 font-semibold text-blue-900'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <div className="flex h-5 w-5 items-center justify-center rounded bg-slate-200 text-[10px] font-bold text-slate-700">
                            {org.name.slice(0, 1).toUpperCase()}
                          </div>
                          <span className="truncate">{org.name}</span>
                        </div>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                            org.role === 'OWNER'
                              ? 'bg-purple-100 text-purple-700'
                              : org.role === 'ADMIN'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {org.role}
                        </span>
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
                    <span>+</span> Create New Organization
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* User Profile & Sign Out */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            {sessionData.user.avatarUrl ? (
              <img
                src={sessionData.user.avatarUrl}
                alt={sessionData.user.login}
                className="w-8 h-8 rounded-full border border-slate-200"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs">
                {sessionData.user.login.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="hidden sm:block text-left text-xs leading-tight">
              <div className="font-semibold text-slate-900">
                {sessionData.user.displayName || sessionData.user.login}
              </div>
              <div className="text-slate-400">@{sessionData.user.login}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}

