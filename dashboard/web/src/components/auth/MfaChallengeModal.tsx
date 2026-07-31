import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { ShieldAlert, AlertCircle } from 'lucide-react';


interface MfaChallengeModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

export const MfaChallengeModal: React.FC<MfaChallengeModalProps> = ({ isOpen, onSuccess, onCancel }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (!isOpen || !supabase) return;
    supabase.auth.mfa.listFactors().then(({ data, error: listError }) => {
      const hasVerified = data?.totp?.some((f) => f.status === 'verified');
      if (listError || !hasVerified) {
        // Fail closed: never bypass the challenge on a lookup error or
        // when no verified factor exists — surface it and keep blocking.
        setError('No verified two-factor method found for this account. Please sign out and contact support.');
      }
    }).catch(() => {
      setError('Unable to verify your two-factor status. Please sign out and try again.');
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    setError(null);
    setLoading(true);

    try {
      // Fetch user's registered MFA factors
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;

      const totpFactor = factors.totp.find(f => f.status === 'verified');
      if (!totpFactor) {
        throw new Error('No verified TOTP factor found for this user.');
      }

      // Verify TOTP challenge code
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: totpFactor.id,
        code: code.trim(),
      });

      if (verifyError) throw verifyError;

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please check your 6-digit code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 text-slate-100 shadow-2xl">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-5">
          <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Two-Factor Security Verification</h3>
            <p className="text-xs text-slate-400">Enter code from your authenticator app</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-sm text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              6-Digit Authenticator Code
            </label>
            <input
              type="text"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-center font-mono text-xl tracking-widest text-white focus:outline-none focus:border-amber-500"
              autoFocus
              required
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
            >
              Sign Out
            </button>
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors"
            >
              {loading ? 'Verifying...' : 'Authenticate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
