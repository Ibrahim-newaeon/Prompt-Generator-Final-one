import { AutumnProvider } from "autumn-js/react";

export function Provider({ children }: { children: React.ReactNode }) {
  return (
    <AutumnProvider useBetterAuth>
      {children}
    </AutumnProvider>
  );
}
