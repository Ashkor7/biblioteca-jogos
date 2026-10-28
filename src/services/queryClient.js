import { QueryClient } from '@tanstack/react-query';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: true,
        // 401/404 não melhoram tentando de novo
        retry: (count, error) => (error?.status === 0 || error?.status >= 500 ? count < 2 : false),
      },
    },
  });
}
