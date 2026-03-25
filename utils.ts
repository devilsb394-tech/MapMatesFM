import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toast } from 'sonner';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function handleQuotaError(error: any, componentName: string) {
  if (error.code === 'resource-exhausted' || error.message?.includes('Quota exceeded')) {
    console.warn(`[${componentName}] Firestore quota exceeded. Real-time features paused.`);
    toast.error('Daily limit reached', {
      description: 'The app has reached its free tier limit for today. Real-time features will resume tomorrow.',
      duration: 10000
    });
    return true;
  }
  console.error(`[${componentName}] Firestore error:`, error);
  return false;
}
