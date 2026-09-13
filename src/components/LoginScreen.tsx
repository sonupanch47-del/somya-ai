import React, { useState } from 'react';
import { Sparkles, Shield, Cpu, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { signInWithGoogle, FirebaseUser } from '../services/firebase';

interface LoginScreenProps {
  onLoginSuccess: (user: FirebaseUser) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [welcomeUser, setWelcomeUser] = useState<FirebaseUser | null>(null);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const { user, error } = await signInWithGoogle();
    
    if (error) {
      setIsLoading(false);
      setErrorMessage(error);
      return;
    }

    if (user) {
      // Show first-time welcome greeting briefly before entering main interface
      setWelcomeUser(user);
      setTimeout(() => {
        setIsLoading(false);
        onLoginSuccess(user);
      }, 1500);
    } else {
      setIsLoading(false);
      setErrorMessage('Google sign-in could not be completed. Please try again.');
    }
  };

  return (
    <main className="fixed inset-0 z-50 flex items-center justify-center bg-[#030712] text-slate-100 overflow-hidden select-none font-sans">
      {/* Background Holographic Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-500/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.06)_0,transparent_70%)] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md mx-4 p-8 rounded-3xl bg-[#040816]/85 border border-cyan-500/30 shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_40px_rgba(6,182,212,0.15)] backdrop-blur-2xl text-center">
        {/* Top Specular Accent */}
        <div className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent pointer-events-none" />

        {/* AI Core Hologram Emblem */}
        <div className="relative mx-auto w-24 h-24 mb-6 flex items-center justify-center rounded-full bg-cyan-950/40 border border-cyan-400/50 shadow-[0_0_35px_rgba(6,182,212,0.3)] animate-pulse">
          <Cpu className="w-10 h-10 text-cyan-400" />
          <div className="absolute inset-0 rounded-full border border-cyan-400/30 animate-ping opacity-60 pointer-events-none" />
        </div>

        {/* Branding */}
        <h1 className="text-3xl font-black tracking-widest bg-gradient-to-r from-cyan-300 via-sky-200 to-indigo-300 bg-clip-text text-transparent font-display uppercase mb-2">
          SOMYA AI
        </h1>
        <p className="text-sm font-mono-tech text-cyan-400/70 uppercase tracking-wider mb-8">
          Your Personal AI Companion
        </p>

        {welcomeUser ? (
          <div className="space-y-4 py-4 animate-fade-in">
            <div className="flex items-center justify-center gap-3">
              {welcomeUser.photoURL ? (
                <img 
                  src={welcomeUser.photoURL} 
                  alt={welcomeUser.displayName || 'User'} 
                  className="w-14 h-14 rounded-full border-2 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-cyan-900 border-2 border-cyan-400 flex items-center justify-center text-cyan-200 font-bold text-xl">
                  {welcomeUser.displayName?.[0] || 'U'}
                </div>
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center justify-center gap-2">
                Welcome, {welcomeUser.displayName || 'Traveler'}
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </h2>
              <p className="text-xs text-slate-400 mt-1">{welcomeUser.email}</p>
            </div>
            <p className="text-xs font-mono-tech text-cyan-300 bg-cyan-950/40 border border-cyan-500/30 py-2 rounded-xl">
              SOMYA Account Loaded Successfully...
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs text-left">
                {errorMessage}
              </div>
            )}

            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-cyan-600 via-sky-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold shadow-[0_0_25px_rgba(6,182,212,0.35)] hover:shadow-[0_0_35px_rgba(6,182,212,0.5)] transition-all duration-300 active:scale-98 disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-cyan-200" />
                  <span>Connecting to Google...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.3 8.9 5 12 5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.3 14.7c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.6 7.2C.6 9.2 0 11.5 0 14s.6 4.8 1.6 6.8l3.7-2.9c-.6-.9-1-2-1-3.2z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.3-6.7-5.3L1.6 15.9C3.5 19.7 7.4 23 12 23z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                  <ArrowRight className="w-4 h-4 ml-auto text-cyan-200" />
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 text-[11px] font-mono-tech text-slate-400 pt-2">
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
              <span>Secure Cloud Data Isolation & Encryption</span>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};
