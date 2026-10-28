import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api.js';
import { AuthContext } from '../hooks/contexts.js';

export default function AuthProvider({ children }) {
  const client = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: api.me, retry: 1, staleTime: 60_000 });

  const value = useMemo(
    () => ({
      user: me.data?.user ?? null,
      publicRead: Boolean(me.data?.publicRead),
      isLoading: me.isPending,
      error: me.error,
      refetch: me.refetch,
      async login(credentials) {
        const result = await api.login(credentials);
        client.setQueryData(['me'], (old) => ({ ...(old ?? {}), user: result.user }));
        await client.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
        return result.user;
      },
      async logout() {
        await api.logout();
        client.setQueryData(['me'], (old) => ({ ...(old ?? {}), user: null }));
        client.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
      },
    }),
    [me.data, me.isPending, me.error, me.refetch, client],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
