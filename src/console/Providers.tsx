import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { I18nProvider } from '@/shared/i18n';

const client = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 15_000 } } });

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      <I18nProvider>
        {/* the console is served under /console */}
        <BrowserRouter basename="/console">{children}</BrowserRouter>
      </I18nProvider>
    </QueryClientProvider>
  );
}
