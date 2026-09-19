'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  // Form states
  const [tenantId, setTenantId] = useState('');
  const [userCredential, setUserCredential] = useState('');
  const [userSecret, setUserSecret] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeRoleName, setActiveRoleName] = useState('');

  // Alert & Toast states
  const [alert, setAlert] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: 'error' | 'warning';
  } | null>(null);
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

  // Theme & Clock
  const [isDark, setIsDark] = useState(false);

  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => {
      setToast({ show: false, message: '' });
    }, 3500);
  };

  // Quick Demo Profiles selector
  const setRoleDemo = (
    tenant: string,
    email: string,
    secret: string,
    roleTitle: string
  ) => {
    setTenantId(tenant);
    setUserCredential(email);
    setUserSecret(secret);
    setActiveRoleName(roleTitle);
    setAlert(null);
    showToast(`Autofilled credentials for ${roleTitle}`);
  };

  // Submit Handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userCredential.trim(),
          password: userSecret,
          orgCode: tenantId.trim(),
        }),
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        data = { error: `Server returned unexpected response (${res.status})` };
      }

      if (!res.ok) {
        setAlert({
          show: true,
          title:
            res.status === 403
              ? 'Access Restricted'
              : res.status === 429
              ? 'Rate Limit Exceeded'
              : 'Authentication Failed',
          message: data.error || 'Invalid credentials or organization code.',
          type: res.status === 403 ? 'warning' : 'error',
        });
        setLoading(false);
        return;
      }

      showToast(`Access Granted: Welcome, ${data.user.fullName}`);
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 500);
    } catch (err: any) {
      setAlert({
        show: true,
        title: 'Connection Error',
        message: err.message || 'Could not communicate with the authentication server. Please try again.',
        type: 'error',
      });
      setLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col justify-between selection:bg-[#83A2DB] selection:text-white transition-colors duration-300 ${
        isDark
          ? 'bg-[#0b101b] text-slate-100'
          : 'bg-gradient-to-br from-[#E9ECF4] to-[#DCE3F2] text-[#10141A]'
      }`}
    >
      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-6 right-6 z-50 animate-fade-in bg-[#10141A] text-white px-4 py-2.5 rounded-full shadow-lg text-xs font-medium flex items-center gap-2 border border-slate-700">
          <span className="material-symbols-outlined text-[16px] text-[#83A2DB]">info</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <header
        className={`w-full h-14 px-6 sm:px-10 border-b backdrop-blur-xl flex items-center justify-between transition-all z-30 ${
          isDark
            ? 'bg-[#121927]/85 border-slate-800 shadow-sm shadow-slate-950/20'
            : 'bg-white/80 border-[#D8DEEA]/80 shadow-[0_1px_3px_rgba(16,20,26,0.04)]'
        }`}
      >
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#83A2DB]/15 flex items-center justify-center p-1.5 shadow-xs text-[#83A2DB]">
            <svg className="w-full h-full" fill="none" viewBox="0 0 40 40">
              <rect fill="#83A2DB" height="40" rx="10" width="40"></rect>
              <path
                d="M12 14C12 12.8954 12.8954 12 14 12H22L28 18V26C28 27.1046 27.1046 28 26 28H14C12.8954 28 12 27.1046 12 26V14Z"
                stroke="white"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
              ></path>
              <path
                d="M22 12V18H28"
                stroke="white"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
              ></path>
              <path d="M16 22H24" stroke="white" strokeLinecap="round" strokeWidth="2.5"></path>
              <path d="M16 25H21" stroke="white" strokeLinecap="round" strokeWidth="2.5"></path>
            </svg>
          </div>
          <span className={`font-semibold text-[16px] tracking-tight ${isDark ? 'text-white' : 'text-[#10141A]'}`}>
            CloudDMS
          </span>
          <span
            className={`hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
              isDark
                ? 'bg-slate-800 text-slate-300 border-slate-700'
                : 'bg-[#F3F5FA] text-[#6B7280] border-[#D8DEEA]/60'
            }`}
          >
            Enterprise v2.4
          </span>
        </div>

        {/* Quick Actions / Theme Switcher */}
        <div className="flex items-center gap-2">
          <button
            aria-label="Toggle theme"
            onClick={() => {
              setIsDark(!isDark);
              showToast(isDark ? 'Light mode enabled' : 'Dark mode enabled');
            }}
            className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all shadow-xs cursor-pointer ${
              isDark
                ? 'bg-slate-800 border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white'
                : 'bg-white border-[#D8DEEA]/60 hover:border-[#D8DEEA] text-[#6B7280] hover:text-[#10141A]'
            }`}
            type="button"
          >
            <span className="material-symbols-outlined text-[19px]">
              {isDark ? 'light_mode' : 'dark_mode'}
            </span>
          </button>
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center shadow-md ml-1 ${
              isDark ? 'bg-[#83A2DB] text-[#10141A]' : 'bg-[#10141A] text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">person</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full flex-1 flex flex-col items-center justify-center px-4 py-8 relative z-10">
        <div className="w-full max-w-[460px] mx-auto">
          {/* Primary Floating Card */}
          <div
            className={`rounded-[26px] p-7 sm:p-9 border relative transition-all ${
              isDark
                ? 'bg-[#121927] border-slate-800 shadow-2xl shadow-slate-950/60'
                : 'bg-white border-[#D8DEEA]/80 shadow-[0_4px_12px_rgba(16,20,26,0.04),0_16px_40px_rgba(16,20,26,0.06)]'
            }`}
          >
            {/* Header / Title */}
            <div className="flex flex-col items-start mb-6">
              <div className="w-12 h-12 rounded-2xl bg-[#83A2DB]/15 text-[#83A2DB] flex items-center justify-center mb-3 shadow-inner">
                <span className="material-symbols-outlined text-[24px]">folder_managed</span>
              </div>
              <h1 className={`text-[24px] sm:text-[26px] font-semibold tracking-tight ${isDark ? 'text-white' : 'text-[#10141A]'}`}>
                Sign in to your workspace
              </h1>
              <p className={`text-[13px] mt-1 leading-normal ${isDark ? 'text-slate-400' : 'text-[#6B7280]'}`}>
                Enter your organization credentials to access the secure document cloud.
              </p>
            </div>

            {/* Error / Feedback Banner */}
            {alert && alert.show && (
              <div
                className={`mb-5 p-3.5 rounded-[14px] border flex items-start gap-3 relative transition-all duration-200 ${
                  alert.type === 'error'
                    ? 'bg-[#CE6969]/10 border-[#CE6969]/30 text-[#CE6969]'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                }`}
              >
                <span className="material-symbols-outlined text-[19px] mt-0.5 shrink-0">
                  {alert.type === 'error' ? 'error' : 'warning'}
                </span>
                <div className="flex-1 pr-4">
                  <h4 className="text-[12px] font-semibold text-[#10141A] dark:text-slate-100">{alert.title}</h4>
                  <p className="text-[12px] text-[#6B7280] dark:text-slate-400 mt-0.5 leading-snug">{alert.message}</p>
                </div>
                <button
                  aria-label="Dismiss alert"
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-0.5"
                  onClick={() => setAlert(null)}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            )}

            {/* Login Form */}
            <form className="flex flex-col gap-4" onSubmit={handleLogin}>
              {/* Organization Code Input */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label
                    className={`text-[13px] font-medium ${isDark ? 'text-slate-200' : 'text-[#10141A]'}`}
                    htmlFor="tenantId"
                  >
                    Organization code
                  </label>
                  <span
                    className={`text-[11px] font-medium font-mono px-2 py-0.5 rounded-full border ${
                      isDark
                        ? 'bg-slate-800 text-slate-300 border-slate-700'
                        : 'bg-[#F3F5FA] text-[#6B7280] border-[#D8DEEA]/60'
                    }`}
                  >
                    Tenant ID
                  </span>
                </div>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3.5 text-slate-400 pointer-events-none text-[19px]">
                    domain
                  </span>
                  <input
                    id="tenantId"
                    type="text"
                    required
                    value={tenantId}
                    onChange={(e) => {
                      setTenantId(e.target.value.toUpperCase());
                    }}
                    placeholder="DEMO"
                    className={`w-full h-11 pl-10 pr-3.5 text-[13px] font-mono rounded-[14px] border placeholder:text-slate-400 focus:outline-none focus:border-[#83A2DB] focus:ring-2 focus:ring-[#83A2DB]/30 transition-all ${
                      isDark
                        ? 'bg-[#182234] text-white border-slate-700'
                        : 'bg-white text-[#10141A] border-[#D8DEEA] shadow-[0_1px_3px_rgba(16,20,26,0.03)]'
                    }`}
                  />
                </div>
              </div>

              {/* Email or Username Input */}
              <div className="flex flex-col gap-1.5">
                <label
                  className={`text-[13px] font-medium ${isDark ? 'text-slate-200' : 'text-[#10141A]'}`}
                  htmlFor="userCredential"
                >
                  Email or username
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3.5 text-slate-400 pointer-events-none text-[19px]">
                    alternate_email
                  </span>
                  <input
                    id="userCredential"
                    type="text"
                    required
                    value={userCredential}
                    onChange={(e) => {
                      setUserCredential(e.target.value);
                      if (activeRoleName) setActiveRoleName('');
                    }}
                    placeholder="name@organization.gov.in"
                    className={`w-full h-11 pl-10 pr-3.5 text-[13px] rounded-[14px] border placeholder:text-slate-400 focus:outline-none focus:border-[#83A2DB] focus:ring-2 focus:ring-[#83A2DB]/30 transition-all ${
                      isDark
                        ? 'bg-[#182234] text-white border-slate-700'
                        : 'bg-white text-[#10141A] border-[#D8DEEA] shadow-[0_1px_3px_rgba(16,20,26,0.03)]'
                    }`}
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label
                    className={`text-[13px] font-medium ${isDark ? 'text-slate-200' : 'text-[#10141A]'}`}
                    htmlFor="userSecret"
                  >
                    Password
                  </label>
                </div>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3.5 text-slate-400 pointer-events-none text-[19px]">
                    lock
                  </span>
                  <input
                    id="userSecret"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={userSecret}
                    onChange={(e) => {
                      setUserSecret(e.target.value);
                      if (activeRoleName) setActiveRoleName('');
                    }}
                    placeholder="••••••••••••"
                    className={`w-full h-11 pl-10 pr-10 text-[13px] rounded-[14px] border placeholder:text-slate-400 focus:outline-none focus:border-[#83A2DB] focus:ring-2 focus:ring-[#83A2DB]/30 transition-all ${
                      isDark
                        ? 'bg-[#182234] text-white border-slate-700'
                        : 'bg-white text-[#10141A] border-[#D8DEEA] shadow-[0_1px_3px_rgba(16,20,26,0.03)]'
                    }`}
                  />
                  <button
                    aria-label="Toggle password visibility"
                    className="absolute right-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[19px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center justify-between py-1">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded-sm border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                    type="checkbox"
                  />
                  <span className={`text-[12.5px] ${isDark ? 'text-slate-400' : 'text-[#6B7280]'}`}>
                    Remember me on this workstation
                  </span>
                </label>
              </div>

              {/* Primary Submit Button */}
              <button
                disabled={loading}
                className={`w-full h-11 text-[13.5px] font-medium rounded-full flex items-center justify-center gap-2 active:scale-[0.99] transition-all shadow-md mt-1 cursor-pointer ${
                  isDark
                    ? 'bg-[#83A2DB] hover:bg-[#9cb6e5] text-[#10141A]'
                    : 'bg-[#10141A] hover:bg-[#1a212b] text-white'
                } ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                type="submit"
              >
                {loading ? (
                  <>
                    <span className="inline-block animate-spin material-symbols-outlined text-[18px]">
                      progress_activity
                    </span>
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>{activeRoleName ? `Sign in as ${activeRoleName}` : 'Sign In'}</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center my-6">
              <div className={`flex-1 h-[1px] ${isDark ? 'bg-slate-800' : 'bg-[#D8DEEA]'}`}></div>
              <span className={`px-3 text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-[#6B7280]'}`}>
                or quick demo profiles
              </span>
              <div className={`flex-1 h-[1px] ${isDark ? 'bg-slate-800' : 'bg-[#D8DEEA]'}`}></div>
            </div>

            {/* Demo Profiles 2x2 Grid */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[12px] font-medium ${isDark ? 'text-slate-400' : 'text-[#6B7280]'}`}>
                  Click to auto-fill credentials
                </span>
                <span className="text-[11px] text-[#83A2DB] font-medium">1-Click Test</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  className={`p-2.5 rounded-[14px] border transition-all text-left flex items-start gap-2.5 focus:outline-none focus:ring-2 focus:ring-[#83A2DB]/30 cursor-pointer ${
                    activeRoleName === 'Administrator'
                      ? 'border-[#83A2DB] bg-[#83A2DB]/10'
                      : isDark
                      ? 'bg-slate-800/60 hover:bg-slate-800 border-slate-700'
                      : 'bg-[#F3F5FA]/80 hover:bg-[#F3F5FA] border-[#D8DEEA]/60 hover:border-[#83A2DB]/40'
                  }`}
                  onClick={() =>
                    setRoleDemo('DEMO', 'admin@dms.gov.in', 'Admin@DMS2026!', 'Administrator')
                  }
                  type="button"
                >
                  <div className={`p-1 rounded-full shadow-xs border ${isDark ? 'bg-slate-700 text-slate-200 border-slate-600' : 'bg-white text-[#6B7280] border-[#D8DEEA]/40'}`}>
                    <span className="material-symbols-outlined text-[15px]">admin_panel_settings</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className={`text-[12px] font-medium truncate ${isDark ? 'text-white' : 'text-[#10141A]'}`}>
                      Administrator
                    </span>
                    <span className={`text-[10.5px] truncate ${isDark ? 'text-slate-400' : 'text-[#6B7280]'}`}>
                      Tier 0 root
                    </span>
                  </div>
                </button>

                <button
                  className={`p-2.5 rounded-[14px] border transition-all text-left flex items-start gap-2.5 focus:outline-none focus:ring-2 focus:ring-[#83A2DB]/30 cursor-pointer ${
                    activeRoleName === 'Department Head'
                      ? 'border-[#83A2DB] bg-[#83A2DB]/10'
                      : isDark
                      ? 'bg-slate-800/60 hover:bg-slate-800 border-slate-700'
                      : 'bg-[#F3F5FA]/80 hover:bg-[#F3F5FA] border-[#D8DEEA]/60 hover:border-[#83A2DB]/40'
                  }`}
                  onClick={() =>
                    setRoleDemo('DEMO', 'depthead@dms.gov.in', 'Head@DMS2026!', 'Department Head')
                  }
                  type="button"
                >
                  <div className={`p-1 rounded-full shadow-xs border ${isDark ? 'bg-slate-700 text-slate-200 border-slate-600' : 'bg-white text-[#6B7280] border-[#D8DEEA]/40'}`}>
                    <span className="material-symbols-outlined text-[15px]">folder_shared</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className={`text-[12px] font-medium truncate ${isDark ? 'text-white' : 'text-[#10141A]'}`}>
                      Dept head
                    </span>
                    <span className={`text-[10.5px] truncate ${isDark ? 'text-slate-400' : 'text-[#6B7280]'}`}>
                      Approval sign-off
                    </span>
                  </div>
                </button>

                <button
                  className={`p-2.5 rounded-[14px] border transition-all text-left flex items-start gap-2.5 focus:outline-none focus:ring-2 focus:ring-[#83A2DB]/30 cursor-pointer ${
                    activeRoleName === 'Dealing Officer'
                      ? 'border-[#83A2DB] bg-[#83A2DB]/10'
                      : isDark
                      ? 'bg-slate-800/60 hover:bg-slate-800 border-slate-700'
                      : 'bg-[#F3F5FA]/80 hover:bg-[#F3F5FA] border-[#D8DEEA]/60 hover:border-[#83A2DB]/40'
                  }`}
                  onClick={() =>
                    setRoleDemo('DEMO', 'officer@dms.gov.in', 'Officer@DMS2026!', 'Dealing Officer')
                  }
                  type="button"
                >
                  <div className={`p-1 rounded-full shadow-xs border ${isDark ? 'bg-slate-700 text-slate-200 border-slate-600' : 'bg-white text-[#6B7280] border-[#D8DEEA]/40'}`}>
                    <span className="material-symbols-outlined text-[15px]">assignment_turned_in</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className={`text-[12px] font-medium truncate ${isDark ? 'text-white' : 'text-[#10141A]'}`}>
                      Dealing officer
                    </span>
                    <span className={`text-[10.5px] truncate ${isDark ? 'text-slate-400' : 'text-[#6B7280]'}`}>
                      Full read / write
                    </span>
                  </div>
                </button>

                <button
                  className={`p-2.5 rounded-[14px] border transition-all text-left flex items-start gap-2.5 focus:outline-none focus:ring-2 focus:ring-[#83A2DB]/30 cursor-pointer ${
                    activeRoleName === 'Auditor'
                      ? 'border-[#83A2DB] bg-[#83A2DB]/10'
                      : isDark
                      ? 'bg-slate-800/60 hover:bg-slate-800 border-slate-700'
                      : 'bg-[#F3F5FA]/80 hover:bg-[#F3F5FA] border-[#D8DEEA]/60 hover:border-[#83A2DB]/40'
                  }`}
                  onClick={() =>
                    setRoleDemo('DEMO', 'auditor@dms.gov.in', 'Auditor@DMS2026!', 'Auditor')
                  }
                  type="button"
                >
                  <div className={`p-1 rounded-full shadow-xs border ${isDark ? 'bg-slate-700 text-slate-200 border-slate-600' : 'bg-white text-[#6B7280] border-[#D8DEEA]/40'}`}>
                    <span className="material-symbols-outlined text-[15px]">visibility</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className={`text-[12px] font-medium truncate ${isDark ? 'text-white' : 'text-[#10141A]'}`}>
                      Auditor
                    </span>
                    <span className={`text-[10.5px] truncate ${isDark ? 'text-slate-400' : 'text-[#6B7280]'}`}>
                      Read-only audit
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Micro status footer within card */}
            <div className={`mt-6 pt-4 border-t flex items-center justify-between text-[11.5px] font-mono ${isDark ? 'border-slate-800 text-slate-400' : 'border-[#D8DEEA]/80 text-[#6B7280]'}`}>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#83A2DB] animate-pulse"></span>
                <span>Gateway: ap-northeast-1</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-slate-400">lock</span>
                <span>TLS 1.3 strict</span>
              </div>
            </div>
          </div>

          {/* Outside Subtitle info */}
          <div className="mt-4 text-center">
            <p className={`text-[12px] ${isDark ? 'text-slate-400' : 'text-[#6B7280]'}`}>
              Protected by multi-tenant authentication protocol.
            </p>
          </div>
        </div>
      </main>

      {/* Clean Footer Bar */}
      <footer className="w-full py-4 px-6 relative z-10">
        <div className={`max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] ${isDark ? 'text-slate-400' : 'text-[#6B7280]'}`}>
          <p>© 2026 CloudDMS Systems Inc. All rights reserved.</p>
          <nav className="flex items-center gap-6">
            <a className={`transition-colors ${isDark ? 'hover:text-white' : 'hover:text-[#10141A]'}`} href="#">
              Privacy policy
            </a>
            <a className={`transition-colors ${isDark ? 'hover:text-white' : 'hover:text-[#10141A]'}`} href="#">
              Terms of service
            </a>
            <a className={`transition-colors ${isDark ? 'hover:text-white' : 'hover:text-[#10141A]'}`} href="#">
              Security &amp; compliance
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
