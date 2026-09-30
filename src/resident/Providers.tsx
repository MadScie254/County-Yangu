import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { I18nProvider } from '@/shared/i18n';
import { persistPublicQueries } from '@/shared/lib/offlineCache';

const client = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 60_000 } },
});
persistPublicQueries(client);

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      <I18nProvider>
        <BrowserRouter>{children}</BrowserRouter>
      </I18nProvider>
    </QueryClientProvider>
  );
}
