import React from 'react';
import { X, LogOut, User, Mail, ShieldCheck, Cloud, RefreshCw } from 'lucide-react';
import { FirebaseUser, signOutUser, switchGoogleAccount } from '../services/firebase';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: FirebaseUser | null;
  onSignOut: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  user,
  onSignOut,
}) => {
  if (!isOpen || !user) return null;

  const handleSignOutClick = async () => {
    await signOutUser();
    onSignOut();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in select-none">
      <div className="relative w-full max-w-md rounded-3xl bg-[#060b19] border border-cyan-500/40 shadow-[0_25px_70px_rgba(0,0,0,0.9),0_0_50px_rgba(6,182,212,0.2)] p-6 text-slate-100 font-sans">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-cyan-500/20">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-bold tracking-wider font-display text-cyan-300 uppercase">
              SOMYA Account & Profile
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-cyan-950/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Profile Card */}
        <div className="py-6 flex flex-col items-center text-center">
          <div className="relative mb-3">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User'}
                className="w-20 h-20 rounded-full border-2 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.4)] object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-cyan-950 border-2 border-cyan-400 flex items-center justify-center text-2xl font-bold text-cyan-200">
                {user.displayName?.[0] || 'U'}
              </div>
            )}
            <span className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-[#060b19] rounded-full" title="Active" />
          </div>

          <h3 className="text-xl font-bold text-white mb-1">
            {user.displayName || 'SOMYA User'}
          </h3>
          <p className="text-xs font-mono-tech text-cyan-300/80 flex items-center gap-1.5 mb-4">
            <Mail className="w-3.5 h-3.5" />
            <span>{user.email}</span>
          </p>

          <div className="grid grid-cols-2 gap-3 w-full text-left text-xs font-mono-tech">
            <div className="p-3 rounded-2xl bg-cyan-950/30 border border-cyan-500/20">
              <div className="flex items-center gap-1.5 text-cyan-400 mb-1">
                <ShieldCheck className="w-4 h-4" />
                <span className="font-bold uppercase tracking-wider">Account ID</span>
              </div>
              <div className="text-slate-300 truncate" title={user.uid}>
                {user.uid.slice(0, 12)}...
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-cyan-950/30 border border-cyan-500/20">
              <div className="flex items-center gap-1.5 text-emerald-400 mb-1">
                <Cloud className="w-4 h-4" />
                <span className="font-bold uppercase tracking-wider">Cloud Sync</span>
              </div>
              <div className="text-slate-300 flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin text-cyan-400" />
                <span>Active / Secure</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions / Sign Out */}
        <div className="pt-4 border-t border-cyan-500/20 flex flex-col gap-3">
          <button
            onClick={async () => {
              const { user: newUser, error } = await switchGoogleAccount();
              if (!error && newUser) {
                onClose();
              }
            }}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-200 font-semibold transition-all duration-300 active:scale-98 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-cyan-400" />
            <span>Switch Google Account</span>
          </button>

          <button
            onClick={handleSignOutClick}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 font-semibold transition-all duration-300 active:scale-98 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
