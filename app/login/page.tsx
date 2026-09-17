'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  // Form states
  const [orgCode, setOrgCode] = useState('DEMO');
  const [email, setEmail] = useState('officer@dms.gov.in');
  const [password, setPassword] = useState('Officer@DMS2026!');
  const [persistSession, setPersistSession] = useState(true);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activePreset, setActivePreset] = useState<'superadmin' | 'cyber' | 'investigator' | 'auditor' | null>('investigator');

  // Alert & Toast states
  const [alert, setAlert] = useState<{ show: boolean; title: string; message: string; type: 'error' | 'warning' } | null>(null);
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

  // Theme & Clock
  const [isSlate, setIsSlate] = useState(false);
  const [utcTime, setUtcTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => {
      setToast({ show: false, message: '' });
    }, 3500);
  };

  // Demo account preset switcher
  const applyPreset = (roleKey: 'superadmin' | 'cyber' | 'investigator' | 'auditor') => {
    setActivePreset(roleKey);
    setAlert(null);
    if (roleKey === 'superadmin') {
      setOrgCode('DEMO');
      setEmail('admin@dms.gov.in');
      setPassword('Admin@DMS2026!');
      showToast('Loaded credentials: Super Administrator (Level 5 Clearance)');
    } else if (roleKey === 'cyber') {
      setOrgCode('DEMO');
      setEmail('depthead@dms.gov.in');
      setPassword('Head@DMS2026!');
      showToast('Loaded credentials: Section Head / Approver (Level 4 Clearance)');
    } else if (roleKey === 'investigator') {
      setOrgCode('DEMO');
      setEmail('officer@dms.gov.in');
      setPassword('Officer@DMS2026!');
      showToast('Loaded credentials: Senior Dealing Officer (Level 3 Clearance)');
    } else if (roleKey === 'auditor') {
      setOrgCode('DEMO');
      setEmail('auditor@dms.gov.in');
      setPassword('Auditor@DMS2026!');
      showToast('Loaded credentials: Compliance Auditor (Level 5 Read-Only)');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          orgCode: orgCode.trim(),
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
          message: data.error || 'Invalid official credentials or organization.',
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
        message: err.message || 'Could not communicate with the authentication cluster. Please try again.',
        type: 'error',
      });
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col justify-between selection:bg-blue-100 selection:text-slate-900 antialiased transition-colors duration-300 ${isSlate ? 'bg-[#080d1a] text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Top Bar */}
      <header className={`w-full border-b px-6 py-2.5 flex items-center justify-between text-xs sticky top-0 z-30 backdrop-blur-md transition-colors duration-300 ${isSlate ? 'border-slate-800/80 bg-[#0c1222]/80 text-slate-400' : 'border-slate-200 bg-white/80 text-slate-600'}`}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-semibold">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span className={isSlate ? 'text-slate-200' : 'text-slate-800'}>CloudDMS Portal</span>
          </div>
          <span className="text-slate-300 hidden sm:inline">|</span>
          <span className="hidden sm:inline text-slate-500">Institutional Document Management System</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-1.5 font-mono text-[11px]">
            <span className="text-slate-400">UTC:</span>
            <span className={isSlate ? 'text-slate-300' : 'text-slate-700'}>{utcTime}</span>
          </div>
          <button
            onClick={() => {
              setIsSlate(!isSlate);
              showToast(isSlate ? 'Light Theme active' : 'Slate Theme active');
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition text-xs font-medium border ${isSlate ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200' : 'border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
          >
            <span className="material-symbols-outlined text-[14px]">{isSlate ? 'light_mode' : 'dark_mode'}</span>
            <span>{isSlate ? 'Light' : 'Slate'}</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 z-10 my-4">
        
        {/* Header Branding */}
        <div className="w-full max-w-md text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-500/25 mb-3.5">
            <span className="material-symbols-outlined text-[24px]">cloud_done</span>
          </div>
          <h1 className={`text-2xl font-bold tracking-tight mb-1 ${isSlate ? 'text-white' : 'text-slate-900'}`}>
            Sign In to DMS
          </h1>
          <p className={`text-xs ${isSlate ? 'text-slate-400' : 'text-slate-500'}`}>
            Secure Electronic Document Management &amp; Audit Custody
          </p>
        </div>

        {/* Form Card */}
        <div className={`w-full max-w-md rounded-2xl border shadow-xl overflow-hidden transition-all duration-300 ${isSlate ? 'bg-[#0f172a] border-slate-800 shadow-black/40' : 'bg-white border-slate-200 shadow-slate-200/50'}`}>
          <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-700"></div>

          <div className="p-6 sm:p-8">
            {/* Alert Banner */}
            {alert && alert.show && (
              <div className={`mb-5 rounded-lg border p-3 text-xs flex items-start gap-2.5 ${alert.type === 'error' ? 'border-rose-300 bg-rose-50 text-rose-800' : 'border-amber-300 bg-amber-50 text-amber-800'}`}>
                <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">
                  {alert.type === 'error' ? 'error' : 'warning'}
                </span>
                <div className="flex-1">
                  <span className="font-bold block">{alert.title}</span>
                  <span className="text-[11px]">{alert.message}</span>
                </div>
                <button onClick={() => setAlert(null)} className="text-slate-400 hover:text-slate-600">
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Organization */}
              <div>
                <label htmlFor="orgCode" className={`block text-xs font-semibold mb-1.5 uppercase tracking-wider ${isSlate ? 'text-slate-300' : 'text-slate-700'}`}>
                  Organization / Directorate
                </label>
                <select
                  id="orgCode"
                  value={orgCode}
                  onChange={(e) => setOrgCode(e.target.value)}
                  className={`w-full px-3.5 py-2.5 border text-xs rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition font-medium cursor-pointer ${isSlate ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800 focus:bg-white'}`}
                >
                  <option value="DEMO">General Administration Department (DEMO)</option>
                  <option value="COLLECTORATE">District Collectorate &amp; Revenue Division</option>
                  <option value="PANCHAYAT">Zilla Parishad &amp; Gram Panchayat Cell</option>
                </select>
              </div>

              {/* Email / Username */}
              <div>
                <label htmlFor="email" className={`block text-xs font-semibold mb-1.5 uppercase tracking-wider ${isSlate ? 'text-slate-300' : 'text-slate-700'}`}>
                  Official Email or Username
                </label>
                <input 
                  type="text" 
                  id="email" 
                  name="email" 
                  required
                  placeholder="officer@dms.gov.in" 
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setActivePreset(null);
                  }}
                  className={`w-full px-3.5 py-2.5 border text-xs rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition font-medium ${isSlate ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white'}`}
                />
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className={`block text-xs font-semibold uppercase tracking-wider ${isSlate ? 'text-slate-300' : 'text-slate-700'}`}>
                    Password
                  </label>
                  <span className="text-[11px] text-slate-400">Institutional Access</span>
                </div>
                <div className="relative rounded-lg">
                  <input 
                    type={passwordVisible ? 'text' : 'password'}
                    id="password" 
                    name="password" 
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setActivePreset(null);
                    }}
                    className={`w-full px-3.5 pr-10 py-2.5 border text-xs rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition font-medium ${isSlate ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white'}`}
                  />
                  <button 
                    type="button" 
                    onClick={() => setPasswordVisible(!passwordVisible)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 transition" 
                    aria-label="Toggle password visibility"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {passwordVisible ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-2.5 px-4 rounded-lg shadow-md shadow-blue-500/20 transition duration-150 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 disabled:opacity-60 text-xs"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="material-symbols-outlined animate-spin text-[16px]">sync</span>
                      <span>Verifying Credentials...</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span>Sign In to Dashboard</span>
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </span>
                  )}
                </button>
              </div>
            </form>

            {/* Account Preset Switcher */}
            <div className={`mt-6 pt-4 border-t ${isSlate ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isSlate ? 'text-slate-400' : 'text-slate-500'}`}>
                  Quick Demo Accounts
                </span>
                <span className="text-[10px] text-slate-400">1-Click Fill</span>
              </div>
              
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {[
                  { id: 'superadmin' as const, label: 'Super Admin', sub: 'Level 5' },
                  { id: 'cyber' as const, label: 'Section Head', sub: 'Level 4' },
                  { id: 'investigator' as const, label: 'Dealing Officer', sub: 'Level 3' },
                  { id: 'auditor' as const, label: 'Auditor', sub: 'Level 5 View' },
                ].map((preset) => {
                  const isSelected = activePreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset.id)}
                      className={`px-2 py-1.5 rounded-lg border text-center transition flex flex-col items-center gap-0.5 active:scale-95 ${
                        isSelected
                          ? isSlate
                            ? 'bg-blue-600/30 border-blue-500 text-blue-200 font-bold'
                            : 'bg-blue-50 border-blue-500 text-blue-900 font-bold ring-1 ring-blue-500'
                          : isSlate
                            ? 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-[10px] font-semibold">{preset.label}</span>
                      <span className="text-[9px] text-slate-400 font-mono">{preset.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        </div>

      </main>

      {/* Clean Footer */}
      <footer className={`w-full border-t px-6 py-4 text-center text-xs transition-colors duration-300 ${isSlate ? 'border-slate-800/80 bg-[#0c1222]/80 text-slate-500' : 'border-slate-200 bg-white text-slate-500'}`}>
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; 2026 CloudDMS — Institutional Document Custody System</span>
          <div className="flex items-center gap-4 text-xs font-medium">
            <span>Role-Based Access Control</span>
            <span>•</span>
            <span>SHA-256 Ledger Verifiable</span>
          </div>
        </div>
      </footer>

      {/* Toast */}
      <div 
        className={`fixed bottom-5 right-5 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-xl text-xs flex items-center gap-2.5 transition-all duration-300 z-50 max-w-sm ${toast.show ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'}`}
      >
        <span className="material-symbols-outlined text-blue-400 text-[18px]">info</span>
        <span>{toast.message}</span>
      </div>

    </div>
  );
}
