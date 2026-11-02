import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';

interface SocketContextValue {
  isConnected: boolean;
}
const SocketContext = createContext<SocketContextValue>({ isConnected: false });

export function SocketProvider({ children }: { children: ReactNode }) {
  return <SocketContext.Provider value={{ isConnected: false }}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}
