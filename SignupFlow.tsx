import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Image as ImageIcon, Upload, Check, ChevronRight, X, MapPin, User as UserIcon, Mail, Lock, Chrome, Facebook, Twitter, Apple } from 'lucide-react';
import Webcam from 'react-webcam';
import { useDropzone } from 'react-dropzone';
import { db, storage } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { User } from 'firebase/auth';
import { UserProfile } from '../types';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

interface SignupFlowProps {
  user: User | null;
  onComplete: (profile: UserProfile) => void;
}

export default function SignupFlow({ user, onComplete }: SignupFlowProps) {
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [tempPhoto, setTempPhoto] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const webcamRef = useRef<Webcam>(null);
  const [isSocial, setIsSocial] = useState(false);

  // Step 2/3 Fields
  const [gender, setGender] = useState('');
  const [religion, setReligion] = useState('');
  const [language, setLanguage] = useState('');
  const [age, setAge] = useState('');
  const [relationshipStatus, setRelationshipStatus] = useState('');
  const [profession, setProfession] = useState('');
  const [economicClass, setEconomicClass] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);

  // Initialize from social login if available
  useEffect(() => {
    if (user) {
      if (user.displayName || user.photoURL) {
        setIsSocial(true);
        setFullName(user.displayName || '');
        setUsername(user.displayName ? user.displayName.toLowerCase().replace(/\s+/g, '_') : '');
        setPhoto(user.photoURL || null);
        setStep(2); // Go directly to details for social
      }
    }
  }, [user]);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setTempPhoto(imageSrc);
    }
  }, [webcamRef]);

  const handleConfirmPhoto = () => {
    if (tempPhoto) {
      setPhoto(tempPhoto);
      setTempPhoto(null);
      setIsCameraOpen(false);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: false
  } as any);

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !fullName) {
      toast.error('Please provide your name and username');
      return;
    }
    setStep(2);
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    const defaultAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username || user.uid}`;

    try {
      // Check photo size if it's a base64 string (Increased limit to ~2MB)
      if (photo && photo.startsWith('data:image') && photo.length > 2500000) {
        toast.error('Profile photo is too large. Please use a smaller image or take a photo with the camera.');
        setLoading(false);
        return;
      }

      // Parallelize photo upload and geolocation for speed
      const [photoURL, location] = await Promise.all([
        (async () => {
          if (!photo) return defaultAvatar;
          if (photo.startsWith('http')) return photo; // Already a URL (social)

          try {
            const storageRef = ref(storage, `profiles/${user.uid}`);
            await uploadString(storageRef, photo, 'data_url');
            return await getDownloadURL(storageRef);
          } catch (storageErr) {
            console.warn('Firebase Storage upload failed, falling back to base64 or default:', storageErr);
            return photo; 
          }
        })(),
        (async () => {
          let loc = { lat: 31.5204, lng: 74.3587, lastUpdated: new Date().toISOString() };
          if (navigator.geolocation) {
            try {
              const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                const timeoutId = setTimeout(() => reject(new Error('Geolocation timeout')), 5000);
                navigator.geolocation.getCurrentPosition(
                  (p) => { clearTimeout(timeoutId); resolve(p); },
                  (e) => { clearTimeout(timeoutId); reject(e); },
                  { timeout: 5000, enableHighAccuracy: true }
                );
              });
              loc = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                lastUpdated: new Date().toISOString()
              };
            } catch (geoErr) {
              console.warn('Geolocation failed, using default:', geoErr);
            }
          }
          return loc;
        })()
      ]);

        const profile: UserProfile = {
          uid: user.uid,
          username,
          fullName,
          email: user.email || '',
          photoURL,
          bio,
          gender,
          religion,
          language,
          age: parseInt(age) || 18,
          relationshipStatus,
          profession,
          economicClass,
          location,
          isOnline: true,
          lastSeen: new Date().toISOString(),
          showOnMap: true,
          privateProfile: false,
          showOnDiscover: true,
          stats: {
            views: 0,
            likes: 0,
            friendsCount: 0
          }
        };

      console.log('Attempting to create profile for user:', user.uid);
      await setDoc(doc(db, 'users', user.uid), profile);
      console.log('Profile created successfully in Firestore');
      toast.success('Profile completed! Welcome to MAPMATES.');
      onComplete(profile);
    } catch (err: any) {
      console.error('Signup error details:', err);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-white flex flex-col items-center justify-center p-4 overflow-y-auto">
      {/* Full Screen Camera Overlay */}
      <AnimatePresence>
        {isCameraOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[3000] bg-black flex flex-col items-center justify-center"
          >
            {!tempPhoto ? (
              <>
                <div className="relative w-full h-full flex items-center justify-center">
                  <Webcam
                    audio={false}
                    ref={webcamRef as any}
                    screenshotFormat="image/jpeg"
                    className="w-full h-full object-cover"
                    videoConstraints={{ facingMode: 'user' }}
                    {...({} as any)}
                  />
                  {/* Circular Overlay Guide */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-64 h-64 border-4 border-white/50 rounded-full shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"></div>
                  </div>
                </div>
                
                {/* Camera Controls */}
                <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-8">
                  <div className="flex items-center justify-center gap-12">
                    <div {...getRootProps()}>
                      <input {...getInputProps()} />
                      <button className="p-4 bg-white/10 backdrop-blur-xl text-white rounded-full hover:bg-white/20 transition border border-white/20">
                        <ImageIcon className="w-6 h-6" />
                      </button>
                    </div>
                    
                    <button 
                      onClick={capture}
                      className="w-20 h-20 bg-white rounded-full border-[6px] border-neutral-300 shadow-2xl active:scale-95 transition-transform flex items-center justify-center"
                    >
                      <div className="w-14 h-14 bg-white rounded-full border-2 border-neutral-100 shadow-inner"></div>
                    </button>

                    <button 
                      onClick={() => setIsCameraOpen(false)}
                      className="p-4 bg-white/10 backdrop-blur-xl text-white rounded-full hover:bg-white/20 transition border border-white/20"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.2em]">Capture Your Vibe</p>
                </div>
              </>
            ) : (
              <div className="relative w-full h-full flex flex-col items-center justify-center bg-black">
                <div className="relative w-full h-full flex items-center justify-center">
                  <img src={tempPhoto} alt="Captured" className="w-full h-full object-cover" />
                  {/* Circular Overlay Guide */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-64 h-64 border-4 border-blue-500 rounded-full shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"></div>
                  </div>
                </div>
                <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-6">
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setTempPhoto(null)}
                      className="px-8 py-3 bg-white/10 backdrop-blur-xl text-white rounded-2xl font-bold border border-white/20 hover:bg-white/20 transition"
                    >
                      Retake
                    </button>
                    <button 
                      onClick={handleConfirmPhoto}
                      className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-xl hover:bg-blue-700 transition flex items-center gap-2"
                    >
                      <Upload className="w-5 h-5" /> Upload Photo
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full max-w-xl">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition", step >= 1 ? "bg-blue-600 text-white" : "bg-neutral-100 text-neutral-400")}>1</div>
          <div className={cn("h-1 w-8 rounded-full transition", step >= 2 ? "bg-blue-600" : "bg-neutral-100")}></div>
          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition", step >= 2 ? "bg-blue-600 text-white" : "bg-neutral-100 text-neutral-400")}>2</div>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="text-center">
                <h2 className="text-2xl font-black tracking-tighter text-neutral-900 mb-1">Profile Setup</h2>
                <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest">Almost there! Customize your profile.</p>
              </div>

              <div className="flex flex-col items-center gap-4">
                <div className="relative w-28 h-28 bg-neutral-100 rounded-full overflow-hidden border-4 border-white shadow-xl flex items-center justify-center group">
                  {photo ? (
                    <img src={photo} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-4">
                      <div className="w-full h-full bg-neutral-200 flex items-center justify-center">
                        <Camera className="w-6 h-6 text-neutral-400" />
                      </div>
                    </div>
                  )}
                  
                  {photo && (
                    <button 
                      onClick={() => setPhoto(null)}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  )}
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsCameraOpen(true)}
                    className="px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-neutral-800 transition shadow-lg"
                  >
                    <Camera className="w-4 h-4" /> Camera
                  </button>
                  <div {...getRootProps()}>
                    <input {...getInputProps()} />
                    <button className="px-4 py-2 bg-white border border-neutral-200 text-neutral-900 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-neutral-50 transition shadow-sm">
                      <ImageIcon className="w-4 h-4" /> Gallery
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Profile picture is optional</p>
              </div>

              <form onSubmit={handleStep1Submit} className="max-w-sm mx-auto space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-4">Full Name</label>
                  <input
                    type="text"
                    placeholder="Your full name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl py-3 px-5 focus:ring-2 focus:ring-blue-500 transition-all outline-none font-bold text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-4">Username</label>
                  <input
                    type="text"
                    placeholder="Choose a unique username"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl py-3 px-5 focus:ring-2 focus:ring-blue-500 transition-all outline-none font-bold text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black tracking-tight text-base hover:bg-blue-700 transition shadow-xl shadow-blue-100 flex items-center justify-center gap-2"
                >
                  Continue <ChevronRight className="w-5 h-5" />
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="text-center">
                <h2 className="text-2xl font-black tracking-tighter text-neutral-900 mb-1">Tell Us More</h2>
                <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Help others find you based on your interests!</p>
              </div>

              <form onSubmit={handleFinalSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-4">Gender</label>
                  <select 
                    required 
                    value={gender} 
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-sm"
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-4">Religion</label>
                  <select 
                    required 
                    value={religion} 
                    onChange={(e) => setReligion(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-sm"
                  >
                    <option value="">Select Religion</option>
                    <option value="Islam">Islam</option>
                    <option value="Christianity">Christianity</option>
                    <option value="Hinduism">Hinduism</option>
                    <option value="Buddhism">Buddhism</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-4">Language</label>
                  <select 
                    required 
                    value={language} 
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-sm"
                  >
                    <option value="">Select Language</option>
                    <option value="English">English</option>
                    <option value="Urdu">Urdu</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Spanish">Spanish</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-4">Age</label>
                  <input
                    type="number"
                    placeholder="Your Age"
                    required
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-4">Relationship Status</label>
                  <select 
                    required 
                    value={relationshipStatus} 
                    onChange={(e) => setRelationshipStatus(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-sm"
                  >
                    <option value="">Select Status</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="In a Relationship">In a Relationship</option>
                    <option value="Complicated">Complicated</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-4">Profession</label>
                  <input
                    type="text"
                    placeholder="Your Profession"
                    required
                    value={profession}
                    onChange={(e) => setProfession(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-4">Economic Class</label>
                  <select 
                    required 
                    value={economicClass} 
                    onChange={(e) => setEconomicClass(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-sm"
                  >
                    <option value="">Select Class</option>
                    <option value="Rich">Rich</option>
                    <option value="Middle">Middle</option>
                    <option value="Poor">Poor</option>
                  </select>
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-4">Bio</label>
                  <textarea
                    placeholder="Tell us about yourself..."
                    required
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-sm min-h-[80px]"
                  />
                </div>

                <div className="sm:col-span-2 pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black tracking-tight text-base hover:bg-blue-700 transition shadow-xl shadow-blue-100 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? 'Creating Your World...' : 'Complete Signup'} <Upload className="w-5 h-5" />
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
