import { useEffect, useMemo, useState } from 'react';
import { MessageCircle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { authApi } from '@/services/api';
import { toast } from 'sonner';

const OTP_LENGTH = 6;

export default function Login({ onAuthenticated }) {
  const [step, setStep] = useState('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (!resendIn) return;
    const timer = setTimeout(() => setResendIn((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const canVerify = useMemo(() => otp.length === OTP_LENGTH && !loading, [otp, loading]);

  const requestOtp = async () => {
    if (!phoneNumber.trim()) {
      toast.error('Enter your WhatsApp number');
      return;
    }

    try {
      setLoading(true);
      const response = await authApi.requestWhatsappOtp(phoneNumber.trim());
      setStep('otp');
      setResendIn(response.data.expiresIn || 60);
      toast.success('OTP sent on WhatsApp');

      if (response.data.devOtp) {
        toast.info(`Dev OTP: ${response.data.devOtp}`);
      }
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to request OTP');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (otp.length !== OTP_LENGTH) {
      toast.error('Please enter 6-digit OTP');
      return;
    }

    try {
      setLoading(true);
      const response = await authApi.verifyWhatsappOtp(phoneNumber.trim(), otp);
      onAuthenticated(response.data);
      toast.success('Login successful');
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <Card className="w-full max-w-md p-6 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold" style={{ fontFamily: "'Lora', serif", color: 'var(--t1)' }}>
            ImplantFlow Login
          </h1>
          <p className="text-sm" style={{ color: 'var(--t2)' }}>
            Dentists/clinicians sign in with WhatsApp OTP
          </p>
        </div>

        {step === 'phone' ? (
          <div className="space-y-4">
            <label className="text-sm block" style={{ color: 'var(--t2)' }}>
              WhatsApp Number
            </label>
            <Input
              placeholder="+91 98765 43210"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="input-clinical"
            />
            <Button onClick={requestOtp} disabled={loading} className="w-full btn-primary-endo">
              <MessageCircle className="h-4 w-4 mr-2" />
              {loading ? 'Sending OTP...' : 'Send OTP on WhatsApp'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--t2)' }}>
              <ShieldCheck className="h-4 w-4" />
              OTP sent to {phoneNumber}
            </div>
            <InputOTP
              maxLength={OTP_LENGTH}
              value={otp}
              onChange={(value) => setOtp(value)}
              containerClassName="justify-center"
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>

            <Button onClick={verifyOtp} disabled={!canVerify} className="w-full btn-primary-endo">
              {loading ? 'Verifying...' : 'Verify & Login'}
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              disabled={loading || resendIn > 0}
              onClick={requestOtp}
            >
              {resendIn > 0 ? `Resend OTP in ${resendIn}s` : 'Resend OTP'}
            </Button>

            <Button variant="link" className="w-full" onClick={() => setStep('phone')}>
              Change number
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
