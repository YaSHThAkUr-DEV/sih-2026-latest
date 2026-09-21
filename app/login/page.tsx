'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  // Form states
  const [tenantId, setTenantId] = useState('DEMO');
  const [userCredential, setUserCredential] = useState('');
  const [userSecret, setUserSecret] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
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

  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => {
      setToast({ show: false, message: '' });
    }, 3200);
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
      }, 400);
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
    <div className="h-screen max-h-screen w-screen bg-[#EBF0F7] text-slate-800 font-sans flex items-center justify-center p-3 sm:p-4 md:p-[1cm] selection:bg-[#F37021] selection:text-white relative overflow-hidden">
      
      {/* Dynamic Ambient Background Color Orbs for High-Refraction Glassmorphism */}
      <div className="absolute -top-32 -left-32 w-[540px] h-[540px] bg-gradient-to-br from-[#F37021]/25 via-amber-500/15 to-transparent rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute top-1/3 -left-20 w-[440px] h-[440px] bg-gradient-to-tr from-[#10B981]/20 via-emerald-400/10 to-transparent rounded-full blur-[90px] pointer-events-none"></div>
      <div className="absolute -bottom-24 left-1/4 w-[500px] h-[500px] bg-gradient-to-tr from-[#3f5e93]/20 via-[#83A2DB]/15 to-transparent rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute top-10 right-10 w-[520px] h-[520px] bg-gradient-to-bl from-indigo-500/15 via-purple-500/10 to-transparent rounded-full blur-[110px] pointer-events-none"></div>

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-5 right-5 z-50 animate-fadeIn bg-slate-900/95 backdrop-blur-md text-white px-4 py-2.5 rounded-full shadow-2xl text-xs font-medium flex items-center gap-2 border border-slate-700">
          <span className="material-symbols-outlined text-[16px] text-emerald-400">check_circle</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Embedded Light Beam Keyframe & Styles */}
      <style jsx global>{`
        .hero-light-beam {
          position: absolute;
          width: 220%;
          height: 90px;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.05) 30%, rgba(255, 255, 255, 0.12) 50%, transparent 70%);
          transform: rotate(-36deg);
          top: 15%;
          left: -50%;
          pointer-events: none;
        }
        
        .hero-light-beam-thin {
          position: absolute;
          width: 200%;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(243, 112, 33, 0.35) 35%, rgba(16, 185, 129, 0.35) 65%, transparent);
          transform: rotate(-36deg);
          top: 24%;
          left: -40%;
          pointer-events: none;
        }

        .shadow-container-card {
          box-shadow: 0 20px 60px -15px rgba(15, 23, 42, 0.12), 0 0 1px 1px rgba(255, 255, 255, 0.8);
        }

        .shadow-logo-glow {
          box-shadow: 0 25px 50px -10px rgba(243, 112, 33, 0.22), 0 10px 30px -6px rgba(16, 185, 129, 0.18);
        }

        .shadow-btn-shadow {
          box-shadow: 0 10px 24px -4px rgba(12, 17, 29, 0.3), inset 0 1px 1px 0 rgba(255, 255, 255, 0.2);
        }
      `}</style>

      {/* Main Split Container: 60/40 Split, Tight ~1cm Screen Margins, No Scrollbars, Rounded-2xl */}
      <main
        className="w-full max-w-[calc(100vw-2cm)] h-[calc(100vh-2cm)] max-h-[calc(100vh-2cm)] rounded-2xl shadow-container-card border border-white/60 overflow-hidden grid grid-cols-1 lg:grid-cols-10 relative backdrop-blur-2xl"
        data-purpose="auth-container"
      >
        {/* ------------------------------------------------------------------ */}
        {/* LEFT PANEL (60%): Rich Glassmorphic Authentication & Workspace Access */}
        {/* ------------------------------------------------------------------ */}
        <section
          className="lg:col-span-6 xl:col-span-6 flex flex-col justify-center p-4 sm:p-5 md:p-6 lg:p-7 xl:p-8 relative z-10 h-full overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.72) 0%, rgba(255, 255, 255, 0.46) 100%)',
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
            boxShadow: 'inset 0 1px 2px 0 rgba(255, 255, 255, 0.95), inset -1px 0 2px 0 rgba(255, 255, 255, 0.6), 0 20px 40px -15px rgba(0, 0, 0, 0.03)',
            borderRight: '1px solid rgba(255, 255, 255, 0.6)',
          }}
        >
          <div className="w-full max-w-[500px] mx-auto flex flex-col justify-center">
            {/* Brand Header */}
            <div className="flex items-center gap-2 mb-2.5 sm:mb-3" data-purpose="brand-header">
              <div className="w-8 h-8 rounded-lg bg-white/80 backdrop-blur-md border border-white/90 p-1 flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.04)] shrink-0">
                <img
                  alt="NIRMAN DMS Icon"
                  className="w-full h-full object-contain"
                  src="/nirman-logo.png"
                />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center tracking-tight leading-tight">
                  <span className="text-base sm:text-lg font-extrabold text-slate-900 font-sans">NIRMAN</span>
                  <span className="text-base sm:text-lg font-black text-[#F37021] ml-1.5 font-sans">DMS</span>
                </div>
                <span className="text-[8.5px] font-extrabold text-emerald-700 tracking-wider uppercase">
                  Organise • Secure • Progress
                </span>
              </div>
            </div>

            {/* Greeting Headings */}
            <div className="mb-2 sm:mb-3">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight mb-0.5">
                Welcome back
              </h1>
              <p className="text-[11.5px] text-slate-600">
                National Sovereign Repository — authenticate to access institutional records.
              </p>
            </div>

            {/* Error Banner */}
            {alert && alert.show && (
              <div
                className={`mb-2.5 p-2 rounded-lg border flex items-start gap-2 text-xs animate-fadeIn backdrop-blur-md ${
                  alert.type === 'error'
                    ? 'bg-rose-50/90 border-rose-200/90 text-rose-800'
                    : 'bg-amber-50/90 border-amber-200/90 text-amber-800'
                }`}
              >
                <span className="material-symbols-outlined text-[16px] mt-0.5 shrink-0 text-rose-600">
                  {alert.type === 'error' ? 'error' : 'warning'}
                </span>
                <div className="flex-1 pr-1">
                  <h4 className="font-semibold text-slate-900 text-[11.5px]">{alert.title}</h4>
                  <p className="text-slate-600 text-[10.5px] leading-snug">{alert.message}</p>
                </div>
                <button
                  onClick={() => setAlert(null)}
                  className="text-slate-400 hover:text-slate-700 transition p-0.5"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </div>
            )}

            {/* Credentials Form */}
            <form className="space-y-2 sm:space-y-2.5" onSubmit={handleLogin}>
              {/* Organization / Tenant ID Field */}
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <label className="block text-[10.5px] font-semibold uppercase tracking-wider text-slate-700" htmlFor="tenantId">
                    Organization / Tenant ID
                  </label>
                  <span className="text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-white/70 backdrop-blur-md text-slate-600 border border-white/80 shadow-2xs">
                    Org Code
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    <span className="material-symbols-outlined text-[16px]">domain</span>
                  </div>
                  <input
                    id="tenantId"
                    type="text"
                    required
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value.toUpperCase())}
                    placeholder="DEMO"
                    className="w-full h-9 pl-8 pr-3 bg-white/60 hover:bg-white/80 focus:bg-white/95 backdrop-blur-md text-slate-900 placeholder-slate-400 text-xs font-mono rounded-lg border border-white/80 focus:border-[#F37021] focus:ring-2 focus:ring-orange-500/15 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] outline-none transition duration-200"
                  />
                </div>
              </div>

              {/* Work Email / Username Field */}
              <div>
                <label className="block text-[10.5px] font-semibold uppercase tracking-wider text-slate-700 mb-0.5" htmlFor="workEmail">
                  Work Email or Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    <span className="material-symbols-outlined text-[16px]">alternate_email</span>
                  </div>
                  <input
                    id="workEmail"
                    name="email"
                    type="text"
                    required
                    value={userCredential}
                    onChange={(e) => {
                      setUserCredential(e.target.value);
                      if (activeRoleName) setActiveRoleName('');
                    }}
                    placeholder="officer@dms.gov.in"
                    className="w-full h-9 pl-8 pr-3 bg-white/60 hover:bg-white/80 focus:bg-white/95 backdrop-blur-md text-slate-900 placeholder-slate-400 text-xs rounded-lg border border-white/80 focus:border-[#F37021] focus:ring-2 focus:ring-orange-500/15 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] outline-none transition duration-200"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <label className="block text-[10.5px] font-semibold uppercase tracking-wider text-slate-700" htmlFor="loginPassword">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    <span className="material-symbols-outlined text-[16px]">lock</span>
                  </div>
                  <input
                    id="loginPassword"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={userSecret}
                    onChange={(e) => {
                      setUserSecret(e.target.value);
                      if (activeRoleName) setActiveRoleName('');
                    }}
                    placeholder="••••••••••••"
                    className="w-full h-9 pl-8 pr-9 bg-white/60 hover:bg-white/80 focus:bg-white/95 backdrop-blur-md text-slate-900 placeholder-slate-400 text-xs rounded-lg border border-white/80 focus:border-[#F37021] focus:ring-2 focus:ring-orange-500/15 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] outline-none transition duration-200"
                  />
                  <button
                    aria-label="Toggle password visibility"
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none transition cursor-pointer"
                    onClick={() => setShowPassword(!showPassword)}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[17px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Remember & Forgot Password Links */}
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    id="rememberMe"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-[#F37021] focus:ring-orange-500/30 transition cursor-pointer"
                  />
                  <span className="text-[11.5px] font-medium text-slate-600">Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => showToast('Please contact your System Administrator to reset your credentials.')}
                  className="text-[11.5px] font-semibold text-[#F37021] hover:text-[#DE5D10] transition-colors cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>

              {/* Primary Sign In Button */}
              <div className="pt-0.5">
                <button
                  disabled={loading}
                  className="w-full h-9.5 px-5 bg-slate-900 hover:bg-black active:scale-[0.99] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-btn-shadow transition-all duration-200 flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-60"
                  type="submit"
                >
                  {loading ? (
                    <>
                      <span className="material-symbols-outlined text-[16px] animate-spin text-orange-400">sync</span>
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>{activeRoleName ? `Sign in as ${activeRoleName}` : 'Sign In'}</span>
                      <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">
                        arrow_forward
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Quick Demo Profiles Section */}
            <div className="mt-2.5 pt-2 border-t border-white/70">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px] text-[#F37021]">bolt</span>
                  <span>Quick 1-Click Demo Profiles</span>
                </span>
                <span className="text-[9.5px] text-emerald-800 font-semibold bg-emerald-500/10 backdrop-blur-md px-1.5 py-0.2 rounded border border-emerald-500/20">
                  Auto-Fill
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {/* 1. Administrator */}
                <button
                  type="button"
                  onClick={() =>
                    setRoleDemo('DEMO', 'admin@dms.gov.in', 'Admin@DMS2026!', 'Administrator')
                  }
                  className={`p-1.5 rounded-lg border text-left flex items-start gap-1.5 transition-all cursor-pointer backdrop-blur-md ${
                    activeRoleName === 'Administrator'
                      ? 'border-[#F37021] bg-orange-50/80 shadow-xs'
                      : 'border-white/80 bg-white/50 hover:bg-white/80 hover:border-white shadow-[0_2px_8px_rgba(0,0,0,0.02)]'
                  }`}
                >
                  <div className="w-5.5 h-5.5 rounded-md bg-orange-50 text-[#F37021] border border-orange-200/60 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[13px]">admin_panel_settings</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-bold text-slate-900 truncate">Administrator</span>
                    <span className="text-[9px] text-slate-600 truncate">SuperAdmin • Tier 5</span>
                  </div>
                </button>

                {/* 2. Department Head */}
                <button
                  type="button"
                  onClick={() =>
                    setRoleDemo('DEMO', 'depthead@dms.gov.in', 'Head@DMS2026!', 'Department Head')
                  }
                  className={`p-1.5 rounded-lg border text-left flex items-start gap-1.5 transition-all cursor-pointer backdrop-blur-md ${
                    activeRoleName === 'Department Head'
                      ? 'border-[#F37021] bg-orange-50/80 shadow-xs'
                      : 'border-white/80 bg-white/50 hover:bg-white/80 hover:border-white shadow-[0_2px_8px_rgba(0,0,0,0.02)]'
                  }`}
                >
                  <div className="w-5.5 h-5.5 rounded-md bg-blue-50 text-blue-600 border border-blue-200/60 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[13px]">corporate_fare</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-bold text-slate-900 truncate">Dept Head</span>
                    <span className="text-[9px] text-slate-600 truncate">Approvals • Tier 4</span>
                  </div>
                </button>

                {/* 3. Dealing Officer */}
                <button
                  type="button"
                  onClick={() =>
                    setRoleDemo('DEMO', 'officer@dms.gov.in', 'Officer@DMS2026!', 'Dealing Officer')
                  }
                  className={`p-1.5 rounded-lg border text-left flex items-start gap-1.5 transition-all cursor-pointer backdrop-blur-md ${
                    activeRoleName === 'Dealing Officer'
                      ? 'border-[#F37021] bg-orange-50/80 shadow-xs'
                      : 'border-white/80 bg-white/50 hover:bg-white/80 hover:border-white shadow-[0_2px_8px_rgba(0,0,0,0.02)]'
                  }`}
                >
                  <div className="w-5.5 h-5.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[13px]">badge</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-bold text-slate-900 truncate">Dealing Officer</span>
                    <span className="text-[9px] text-slate-600 truncate">Upload • Read/Write</span>
                  </div>
                </button>

                {/* 4. Auditor */}
                <button
                  type="button"
                  onClick={() =>
                    setRoleDemo('DEMO', 'auditor@dms.gov.in', 'Auditor@DMS2026!', 'Auditor')
                  }
                  className={`p-1.5 rounded-lg border text-left flex items-start gap-1.5 transition-all cursor-pointer backdrop-blur-md ${
                    activeRoleName === 'Auditor'
                      ? 'border-[#F37021] bg-orange-50/80 shadow-xs'
                      : 'border-white/80 bg-white/50 hover:bg-white/80 hover:border-white shadow-[0_2px_8px_rgba(0,0,0,0.02)]'
                  }`}
                >
                  <div className="w-5.5 h-5.5 rounded-md bg-purple-50 text-purple-600 border border-purple-200/60 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[13px]">policy</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-bold text-slate-900 truncate">Auditor</span>
                    <span className="text-[9px] text-slate-600 truncate">Audit 360 • Sec 65B</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* RIGHT PANEL (40%): Visual Showcase & Brand Ambient Spotlight */}
        {/* ------------------------------------------------------------------ */}
        <section
          className="lg:col-span-4 xl:col-span-4 bg-[#0B0F19] p-3 sm:p-4 lg:p-6 flex flex-col justify-center relative overflow-hidden h-full"
          data-purpose="hero-showcase-panel"
        >
          {/* Inner Dark Card Frame */}
          <div className="relative w-full h-full rounded-xl bg-gradient-to-b from-[#111827] via-[#0D121F] to-[#080C14] border border-slate-800/80 p-4 sm:p-6 md:p-8 flex flex-col overflow-hidden justify-center items-center">
            
            {/* Ambient Geometric Facet Accents & Light Beams */}
            <div className="hero-light-beam"></div>
            <div className="hero-light-beam-thin"></div>

            {/* Soft ambient diffuse glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-orange-500/20 via-emerald-500/15 to-transparent blur-3xl pointer-events-none rounded-full"></div>

            {/* Center: Framed White Logo Showcase with Ambient Glow */}
            <div className="relative z-10 my-auto py-2 flex flex-col items-center justify-center text-center w-full px-2">
              {/* Purpose-built pristine white display card with warm ambient glow */}
              <div className="relative group w-full flex justify-center">
                <div className="absolute -inset-2 bg-gradient-to-r from-orange-500/40 via-emerald-500/30 to-orange-500/40 rounded-2xl blur-xl opacity-85 group-hover:opacity-100 transition duration-700"></div>
                <div className="relative bg-white rounded-2xl p-6 sm:p-8 md:p-10 shadow-logo-glow border border-white/90 w-full max-w-[320px] sm:max-w-[360px] md:max-w-[400px] lg:max-w-[440px] flex flex-col items-center justify-center transition duration-300 transform group-hover:scale-[1.02]">
                  <img
                    alt="NIRMAN DMS - Document Management System"
                    className="w-full max-w-[260px] sm:max-w-[300px] md:max-w-[340px] lg:max-w-[370px] h-auto object-contain select-none pointer-events-none drop-shadow-sm"
                    src="/nirman-logo.png"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
