import type { ReactNode } from 'react';
import { OrganizationProvider } from './organization';
import { QueryProvider } from './query-client';
import { SessionProvider } from './session';
import { SocketProvider } from './socket';
import { ThemeProvider } from './theme';
import { ToastProvider } from '../components/ui/toast';

/**
 * Provider composition order matters:
 * theme → query cache → session → active organization → realtime → toasts.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <SessionProvider>
          <OrganizationProvider>
            <SocketProvider>
              <ToastProvider>{children}</ToastProvider>
            </SocketProvider>
          </OrganizationProvider>
        </SessionProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
