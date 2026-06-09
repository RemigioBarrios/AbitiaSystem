import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dashboard } from './pages/Dashboard';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30000, retry: 1 },
  },
});

export function App(): React.ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <div style={styles.shell}>
        <header style={styles.header}>
          <span style={styles.logo}>ABITIA</span>
          <span style={styles.subtitle}>Gestión Integral Multi-Condominio — Fase Magra v0.1</span>
          <nav style={styles.nav}>
            <a href="#" style={styles.navLink}>Dashboard</a>
            <a href="#" style={styles.navLink}>Propiedades</a>
            <a href="#" style={styles.navLink}>Recibos</a>
            <a href="#" style={styles.navLink}>Pagos</a>
            <a href="#" style={styles.navLink}>Ledger</a>
          </nav>
        </header>
        <main style={styles.main}>
          <Dashboard />
        </main>
        <footer style={styles.footer}>
          <span>Abitia v0.1.0 — Local-First / Google Antigravity Ready — © 2026</span>
        </footer>
      </div>
    </QueryClientProvider>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: '#0f1923',
    color: '#c8d6e5',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '6px 12px',
    background: '#1a2a3a',
    borderBottom: '1px solid #2a3a4a',
    minHeight: 36,
  },
  logo: {
    fontWeight: 900,
    fontSize: 16,
    color: '#48dbfb',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 11,
    color: '#576574',
  },
  nav: {
    display: 'flex',
    gap: '16px',
    marginLeft: 'auto',
  },
  navLink: {
    color: '#8395a7',
    textDecoration: 'none',
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  main: {
    flex: 1,
    overflow: 'auto',
    padding: '12px',
  },
  footer: {
    padding: '4px 12px',
    background: '#1a2a3a',
    borderTop: '1px solid #2a3a4a',
    fontSize: 10,
    color: '#576574',
    textAlign: 'center',
  },
};
