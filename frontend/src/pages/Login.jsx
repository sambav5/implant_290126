import React, { useState, useEffect, useMemo } from 'react';
import { MessageCircle, ShieldCheck, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../components/ui/input-otp';
import { authApi } from '../services/api';

const Login = ({ onAuthenticated }) => {
  const [step, setStep] = useState('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn > 0) {
      const timer = setTimeout(() => setResendIn(resendIn - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendIn]);

  const isPhoneValid = useMemo(() => {
    return phoneNumber.trim().length >= 10;
  }, [phoneNumber]);

  const isOtpComplete = useMemo(() => {
    return otp.length === 6;
  }, [otp]);

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!isPhoneValid) {
      toast.error('Please enter a valid phone number');
      return;
    }

    setLoading(true);
    try {
      await authApi.requestWhatsappOtp(phoneNumber);
      setStep('otp');
      setResendIn(60);
      toast.success('OTP sent to your WhatsApp');
    } catch (error) {
      const message = error?.response?.data?.detail || 'Failed to send OTP. Please try again.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!isOtpComplete) {
      toast.error('Please enter the complete 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const response = await authApi.verifyWhatsappOtp(phoneNumber, otp);
      const sessionData = response.data;

      localStorage.setItem('clinician_auth_session', JSON.stringify(sessionData));
      
      toast.success('Login successful');
      
      if (onAuthenticated) {
        onAuthenticated(sessionData);
      }
      
      // Route based on onboarding stage
      const { onboardingStage } = sessionData;
      
      if (onboardingStage === 'PROFILE') {
        window.location.href = '/setup-profile';
      } else if (onboardingStage === 'TEAM') {
        window.location.href = '/setup-team';
      } else {
        window.location.href = '/';
      }
    } catch (error) {
      const message = error?.response?.data?.detail || 'Invalid OTP. Please try again.';
      toast.error(message);
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendIn > 0) return;

    setLoading(true);
    try {
      await authApi.requestWhatsappOtp(phoneNumber);
      setResendIn(60);
      setOtp('');
      toast.success('OTP resent to your WhatsApp');
    } catch (error) {
      const message = error?.response?.data?.detail || 'Failed to resend OTP. Please try again.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToPhone = () => {
    setStep('phone');
    setOtp('');
    setResendIn(0);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <Card className="w-full max-w-md p-8 space-y-6 shadow-xl">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            {step === 'phone' ? (
              <MessageCircle className="h-12 w-12 text-blue-600" />
            ) : (
              <ShieldCheck className="h-12 w-12 text-green-600" />
            )}
          </div>
          <h1 className="text-3xl font-bold text-gray-900">ImplantFlow Login</h1>
          <p className="text-sm text-gray-600">
            Secure clinician access via WhatsApp OTP
          </p>
        </div>

        {step === 'phone' ? (
          <form onSubmit={handleRequestOtp} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="phoneNumber" className="text-sm font-medium text-gray-700">
                Phone Number
              </label>
              <Input
                id="phoneNumber"
                type="tel"
                placeholder="+91 9876543210"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={loading}
                className="w-full"
                autoFocus
              />
              <p className="text-xs text-gray-500">
                Enter your registered phone number with country code
              </p>
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-xs text-blue-800 font-medium">
                  📱 WhatsApp Sandbox Setup Required:
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Before first login, send "join" to <span className="font-mono font-semibold">+1 415 523 8886</span> on WhatsApp
                </p>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={!isPhoneValid || loading}
            >
              {loading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Sending OTP...
                </>
              ) : (
                <>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Send OTP
                </>
              )}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <button
              type="button"
              onClick={handleBackToPhone}
              className="flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors"
              disabled={loading}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Change number
            </button>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Verification Code
              </label>
              <p className="text-xs text-gray-500 mb-4">
                Enter the 6-digit code sent to {phoneNumber}
              </p>
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={(value) => setOtp(value)}
                  disabled={loading}
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
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={!isOtpComplete || loading}
            >
              {loading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Verifying...
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Verify & Login
                </>
              )}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendIn > 0 || loading}
                className={`text-sm ${
                  resendIn > 0 || loading
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-blue-600 hover:text-blue-800 font-medium'
                } transition-colors`}
              >
                {resendIn > 0 ? (
                  `Resend OTP in ${resendIn}s`
                ) : (
                  'Resend OTP'
                )}
              </button>
            </div>
          </form>
        )}

        <div className="pt-4 border-t border-gray-200">
          <p className="text-xs text-center text-gray-500">
            Protected by WhatsApp OTP verification
          </p>
        </div>
      </Card>
    </div>
  );
};

export default Login;
