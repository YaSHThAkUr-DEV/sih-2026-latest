'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const ShaderGradientBackground = dynamic(
  () => import('@/components/auth/ShaderGradientBackground'),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 bg-gradient-to-br from-[#94ffd1]/30 via-[#6bf5ff]/20 to-white -z-10" />
    ),
  }
);

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

  // Dynamic Fleet Organizations
  const [fleetOrgs, setFleetOrgs] = useState<any[]>([]);

  // Load test fleet dynamically from database
  React.useEffect(() => {
    fetch('/api/collaboration/admin/test-fleet')
      .then((res) => res.json())
      .then((data) => {
        if (data.organizations) {
          setFleetOrgs(data.organizations);
        }
      })
      .catch((err) => console.error('Failed to load dynamic test fleet', err));
  }, []);

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
    <div className="h-screen max-h-screen w-screen bg-[#0E1525]/10 text-slate-800 font-sans flex items-center justify-center p-3 sm:p-4 md:p-[1cm] selection:bg-[#F37021] selection:text-white relative overflow-hidden">
      
      {/* 3D WebGL Shader Gradient Animated Background */}
      <ShaderGradientBackground />

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-5 right-5 z-50 animate-fadeIn bg-slate-900/95 backdrop-blur-md text-white px-4 py-2.5 rounded-full shadow-2xl text-xs font-medium flex items-center gap-2 border border-slate-700">
          <span className="material-symbols-outlined text-[16px] text-emerald-400">check_circle</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Embedded Light Beam Keyframe & Glass Card Styles */}
      <style jsx global>{`
        .glass-card {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(5px);
          -webkit-backdrop-filter: blur(5px);
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.3);
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.5),
            inset 0 -1px 0 rgba(255, 255, 255, 0.1),
            inset 0 0 0px 0px rgba(255, 255, 255, 0);
          position: relative;
          overflow: hidden;
        }

        .glass-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.8),
            transparent
          );
          pointer-events: none;
          z-index: 20;
        }

        .glass-card::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 1px;
          height: 100%;
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.8),
            transparent,
            rgba(255, 255, 255, 0.3)
          );
          pointer-events: none;
          z-index: 20;
        }

        .glass-input {
          background: rgba(255, 255, 255, 0.35);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          border: 1px solid rgba(255, 255, 255, 0.5);
          box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.02), inset 0 1px 0 rgba(255, 255, 255, 0.6);
          transition: all 0.2s ease;
        }
        .glass-input:hover {
          background: rgba(255, 255, 255, 0.55);
          border-color: rgba(255, 255, 255, 0.8);
        }
        .glass-input:focus {
          background: rgba(255, 255, 255, 0.85);
          border-color: #F37021;
          box-shadow: 0 0 0 3px rgba(243, 112, 33, 0.15), inset 0 1px 0 #ffffff;
        }

        .glass-pill {
          background: rgba(255, 255, 255, 0.3);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          border: 1px solid rgba(255, 255, 255, 0.4);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02), inset 0 1px 0 rgba(255, 255, 255, 0.5);
          transition: all 0.2s ease;
        }
        .glass-pill:hover {
          background: rgba(255, 255, 255, 0.65);
          border-color: rgba(255, 255, 255, 0.8);
        .shadow-logo-glow {
          box-shadow: 0 25px 50px -10px rgba(243, 112, 33, 0.22), 0 10px 30px -6px rgba(16, 185, 129, 0.18);
        }

        .shadow-btn-shadow {
          box-shadow: 0 10px 24px -4px rgba(12, 17, 29, 0.3), inset 0 1px 1px 0 rgba(255, 255, 255, 0.2);
        }
      `}</style>

      {/* Main Split Container: Glass Card with 60/40 Split, Tight ~1cm Screen Margins, No Scrollbars, Rounded-20px */}
      <main
        className="glass-card w-full max-w-[calc(100vw-2cm)] h-[calc(100vh-2cm)] max-h-[calc(100vh-2cm)] grid grid-cols-1 lg:grid-cols-10 relative z-10"
        data-purpose="auth-container"
      >
        {/* ------------------------------------------------------------------ */}
        {/* LEFT PANEL (60%): Rich Glassmorphic Authentication & Workspace Access */}
        {/* ------------------------------------------------------------------ */}
        <section
          className="lg:col-span-6 xl:col-span-6 flex flex-col justify-center p-4 sm:p-5 md:p-6 lg:p-7 xl:p-8 relative z-10 h-full overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0.22) 100%)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.5), inset 0 -1px 0 rgba(255, 255, 255, 0.1)',
            borderRight: '1px solid rgba(255, 255, 255, 0.3)',
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
                    className="glass-input w-full h-9 pl-8 pr-3 text-slate-900 placeholder-slate-400 text-xs font-mono rounded-lg outline-none"
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
                    className="glass-input w-full h-9 pl-8 pr-3 text-slate-900 placeholder-slate-400 text-xs rounded-lg outline-none"
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
                    className="glass-input w-full h-9 pl-8 pr-9 text-slate-900 placeholder-slate-400 text-xs rounded-lg outline-none"
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
            <div className="mt-2.5 pt-2 border-t border-white/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px] text-[#F37021]">bolt</span>
                  <span>1-Click Test Organizations</span>
                </span>
                <Link
                  href="/federation-admin"
                  className="text-[9.5px] text-[#3f5e93] hover:underline font-bold flex items-center gap-0.5"
                >
                  <span>Open Test Suite</span>
                  <span className="material-symbols-outlined text-[11px]">open_in_new</span>
                </Link>
              </div>

              {/* Dynamic Sovereign Inter-Org Fleet Grid */}
              <div className="grid grid-cols-2 gap-1.5">
                {fleetOrgs.length > 0 ? (
                  fleetOrgs.slice(0, 4).map((org) => {
                    const primaryUser = org.users?.[0] || {
                      email: `admin@${org.code.toLowerCase()}.gov.in`,
                      name: org.name,
                    };
                    const isSelected = tenantId === org.code;
                    return (
                      <button
                        key={org.id}
                        type="button"
                        onClick={() =>
                          setRoleDemo(org.code, primaryUser.email, 'Password@DMS2026!', org.name)
                        }
                        className={`p-1.5 rounded-lg text-left flex items-start gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'border border-[#F37021] bg-orange-50/90 shadow-xs'
                            : 'glass-pill hover:bg-white/80'
                        }`}
                      >
                        <div
                          className="w-5.5 h-5.5 rounded-md flex items-center justify-center shrink-0 border"
                          style={{
                            backgroundColor: org.tierBadgeColor ? `${org.tierBadgeColor}15` : '#6366f115',
                            borderColor: org.tierBadgeColor ? `${org.tierBadgeColor}40` : '#6366f140',
                            color: org.tierBadgeColor || '#6366f1',
                          }}
                        >
                          <span className="material-symbols-outlined text-[13px]">
                            {org.categoryIcon || 'corporate_fare'}
                          </span>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[11px] font-bold text-slate-900 truncate">{org.name}</span>
                          <span className="text-[9px] text-slate-600 truncate font-mono">
                            {org.code} • {org.tierName || 'Tier Sovereign'}
                          </span>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="col-span-2 text-center py-2 text-[10px] text-slate-500 font-mono">
                    Loading sovereign federation fleet...
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* RIGHT PANEL (40%): Clean Showcase with Large Floating Logo */}
        {/* ------------------------------------------------------------------ */}
        <section
          className="lg:col-span-4 xl:col-span-4 p-4 sm:p-6 md:p-8 flex flex-col justify-center items-center relative overflow-hidden h-full"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.06) 100%)',
            backdropFilter: 'blur(5px)',
            WebkitBackdropFilter: 'blur(5px)',
          }}
          data-purpose="hero-showcase-panel"
        >
          {/* Center: Large Floating Brand Logo */}
          <div className="relative z-10 my-auto py-2 flex flex-col items-center justify-center text-center w-full px-4 sm:px-6">
            <img
              alt="NIRMAN DMS - Document Management System"
              className="w-full max-w-[360px] sm:max-w-[440px] md:max-w-[500px] lg:max-w-[560px] xl:max-w-[620px] max-h-[75vh] object-contain select-none pointer-events-none drop-shadow-[0_12px_28px_rgba(0,0,0,0.06)] transition-all duration-300 transform hover:scale-[1.03]"
              src="/nirman-logo.png"
            />
          </div>
        </section>
      </main>
    </div>
  );
}
