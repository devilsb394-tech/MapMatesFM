import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, Lock, Chrome, Github, Twitter, Apple, Facebook } from 'lucide-react';
import { auth, googleProvider, microsoftProvider, twitterProvider, appleProvider, facebookProvider } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { toast } from 'sonner';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success('Welcome back to MAPMATES!');
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        toast.success('Account created! Let\'s set up your profile.');
      }
      onClose();
    } catch (err: any) {
      if (err.code === 'auth/unauthorized-domain') {
        toast.error('This domain is not authorized in Firebase. Please add it to your Firebase Console > Authentication > Settings > Authorized domains.');
      } else if (err.code === 'auth/invalid-credential') {
        if (isLogin) {
          toast.error('Ghalat Email ya Password. Agar account nahi banaya toh pehle Sign Up karein.');
        } else {
          toast.error('Signup fail: Check karein ke Email sahi hai ya nahi.');
        }
      } else if (err.code === 'auth/email-already-in-use') {
        toast.error('Ye Email pehle se use mein hai. Log In karein.');
      } else {
        toast.error(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: any) => {
    try {
      await signInWithPopup(auth, provider);
      toast.success('Logged in successfully!');
      onClose();
    } catch (err: any) {
      if (err.code === 'auth/unauthorized-domain') {
        toast.error('This domain is not authorized in Firebase. Please add it to your Firebase Console > Authentication > Settings > Authorized domains.');
      } else {
        toast.error(err.message);
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row"
          >
            <div className="hidden md:flex md:w-1/3 bg-blue-600 p-8 flex-col justify-between text-white">
              <div>
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center mb-4">
                  <span className="text-blue-600 font-black text-xs">MM</span>
                </div>
                <h2 className="text-2xl font-black tracking-tighter leading-tight">Connect with the World.</h2>
              </div>
              <p className="text-xs text-blue-100 font-medium leading-relaxed">Join thousands of users discovering new connections every day on MAPMATES.</p>
            </div>

            <div className="flex-1 p-8 md:p-12 relative">
              <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-neutral-100 rounded-full transition">
                <X className="w-5 h-5 text-neutral-400" />
              </button>

              <h3 className="text-2xl font-black tracking-tighter text-neutral-900 mb-2">
                {isLogin ? 'Welcome Back' : 'Join MAPMATES'}
              </h3>
              <p className="text-sm text-neutral-500 mb-8 font-medium">
                {isLogin ? 'Don\'t have an account?' : 'Already have an account?'} 
                <button onClick={() => setIsLogin(!isLogin)} className="text-blue-600 font-bold ml-1 hover:underline">
                  {isLogin ? 'Sign up' : 'Log in'}
                </button>
              </p>

              <div className="space-y-3">
                <button 
                  onClick={() => handleSocialLogin(googleProvider)}
                  className="w-full py-4 bg-white border border-neutral-200 rounded-2xl font-black tracking-tight hover:bg-neutral-50 transition shadow-sm flex items-center justify-center gap-3"
                >
                  <Chrome className="w-5 h-5 text-blue-600" /> Continue with Google
                </button>
                
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-neutral-100"></div></div>
                  <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest text-neutral-400"><span className="bg-white px-4">Or use email</span></div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
                  <input
                    type="email"
                    placeholder="Email Address"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-blue-500 transition-all outline-none text-sm font-medium"
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
                  <input
                    type="password"
                    placeholder="Password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-blue-500 transition-all outline-none text-sm font-medium"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black tracking-tight hover:bg-blue-700 transition shadow-xl shadow-blue-100 disabled:opacity-50"
                >
                  {loading ? 'Processing...' : (isLogin ? 'Log In' : 'Continue')}
                </button>
              </form>

              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-neutral-100"></div></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-4 text-neutral-400 font-bold tracking-widest">Or continue with</span></div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <button onClick={() => handleSocialLogin(facebookProvider)} className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl hover:bg-neutral-100 transition flex justify-center" title="Facebook"><Facebook className="w-5 h-5" /></button>
                <button onClick={() => handleSocialLogin(appleProvider)} className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl hover:bg-neutral-100 transition flex justify-center" title="Apple"><Apple className="w-5 h-5" /></button>
                <button onClick={() => handleSocialLogin(microsoftProvider)} className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl hover:bg-neutral-100 transition flex justify-center" title="Microsoft">
                  <div className="grid grid-cols-2 gap-0.5">
                    <div className="w-2 h-2 bg-neutral-400"></div>
                    <div className="w-2 h-2 bg-neutral-400"></div>
                    <div className="w-2 h-2 bg-neutral-400"></div>
                    <div className="w-2 h-2 bg-neutral-400"></div>
                  </div>
                </button>
                <button onClick={() => handleSocialLogin(twitterProvider)} className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl hover:bg-neutral-100 transition flex justify-center" title="Twitter"><Twitter className="w-5 h-5" /></button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
