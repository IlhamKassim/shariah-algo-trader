import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { ShieldCheck, Key, AlertCircle, CheckCircle2 } from 'lucide-react';


interface MfaEnrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const MfaEnrollModal: React.FC<MfaEnrollModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen && supabase) {
      startEnrollment();
    }
  }, [isOpen]);

  const startEnrollment = async () => {
    if (!supabase) return;
    setError(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
      });
      if (error) throw error;

      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
    } catch (err: any) {
      setError(err.message || 'Failed to initialize MFA enrollment.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !factorId) return;

    setError(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: code.trim(),
      });

      if (error) throw error;

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Invalid verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 text-slate-100 shadow-2xl">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-5">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Setup Multi-Factor Authentication</h3>
            <p className="text-xs text-slate-400">Protect real-money trading with TOTP authenticator</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-sm text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
            <h4 className="text-lg font-medium text-white">MFA Enabled Successfully!</h4>
            <p className="text-xs text-slate-400">Your account is now secured with 2-Factor Authentication.</p>
          </div>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            {loading && !qrCode ? (
              <div className="py-8 text-center text-sm text-slate-400">Generating secure QR Code...</div>
            ) : (
              <>
                <div className="bg-slate-950 p-4 rounded-lg flex flex-col items-center justify-center border border-slate-800">
                  {qrCode && (
                    <img src={qrCode} alt="TOTP QR Code" className="w-44 h-44 rounded bg-white p-2" />
                  )}
                  <div className="mt-3 text-center">
                    <p className="text-xs text-slate-400 mb-1 flex items-center justify-center gap-1">
                      <Key className="w-3 h-3 text-slate-500" /> Manual Secret Key:
                    </p>
                    <code className="text-xs font-mono bg-slate-900 px-2 py-1 rounded text-emerald-400 border border-slate-800 select-all">
                      {secret}
                    </code>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Enter 6-Digit Code from Authenticator App
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-center font-mono text-lg tracking-widest text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || code.length !== 6}
                    className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors"
                  >
                    {loading ? 'Verifying...' : 'Enable MFA'}
                  </button>
                </div>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
};
