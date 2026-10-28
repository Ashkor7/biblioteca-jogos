import { useContext } from 'react';
import { AuthContext } from './contexts.js';

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return value;
}
