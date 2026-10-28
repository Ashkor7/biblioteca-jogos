import { useContext } from 'react';
import { ToastContext } from './contexts.js';

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast precisa estar dentro de <ToastProvider>');
  return value;
}
