import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn('[Abitia] Sesión expirada o no autenticado');
    }
    return Promise.reject(error);
  },
);

export async function fetchPropiedades(): Promise<unknown[]> {
  const { data } = await api.get('/propiedades');
  return data;
}

export async function fetchGastos(periodo: string): Promise<unknown[]> {
  const { data } = await api.get(`/gastos/${periodo}`);
  return data;
}

export async function fetchRecibosPendientes(idPropiedad: number): Promise<unknown[]> {
  const { data } = await api.get(`/recibos/pendientes/${idPropiedad}`);
  return data;
}

export async function fetchBandejaPagos(): Promise<unknown[]> {
  const { data } = await api.get('/pagos/bandeja');
  return data;
}

export async function fetchLedger(idPropiedad: number): Promise<unknown[]> {
  const { data } = await api.get(`/ledger/${idPropiedad}`);
  return data;
}

export async function fetchSaldo(idPropiedad: number): Promise<{ saldo: number }> {
  const { data } = await api.get(`/ledger/${idPropiedad}/saldo`);
  return data;
}

export { api };
