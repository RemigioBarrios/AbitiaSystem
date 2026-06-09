import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { HighDensityTable } from '../components/HighDensityTable';
import { fetchPropiedades, fetchBandejaPagos } from '../services/api';

interface PropiedadRow {
  id: number;
  codigo: string;
  alicuota: string;
  propietario: string;
  estatus: string;
}

interface PagoRow {
  id: number;
  propiedad: string;
  monto: string;
  referencia: string;
  fechaPago: string;
  banco: string;
  formaPago: string;
  observaciones: string;
  reportadoPor: number;
}

export function Dashboard(): React.ReactElement {
  const { data: propiedades } = useQuery({
    queryKey: ['propiedades'],
    queryFn: async () => {
      const data = (await fetchPropiedades()) as Record<string, unknown>[];
      return data.map((p: Record<string, unknown>) => ({
        id: p.IdPropiedad as number,
        codigo: p.Codigo_Nro as string,
        alicuota: ` ${Number(p.Alicuota).toFixed(4)}`,
        propietario: `Propietario #${p.IdPropietario_Actual}`,
        estatus: (p.Estatus as number) === 1 ? 'Activo' : 'Inactivo',
      })) as PropiedadRow[];
    },
  });

  const { data: pagos } = useQuery({
    queryKey: ['pagos-bandeja'],
    queryFn: async () => {
      const data = (await fetchBandejaPagos()) as Record<string, unknown>[];
      return data.map((p: Record<string, unknown>) => {
        const formaPagoMap: Record<number, string> = {
          1: 'Transferencia', 2: 'Pago Móvil', 3: 'Efectivo', 4: 'Zelle',
        };
        return {
          id: p.IdPago as number,
          propiedad: `Prop #${p.IdPropiedad}`,
          monto: `Bs. ${Number(p.Monto).toFixed(2)}`,
          referencia: p.Referencia_Bancaria as string,
          fechaPago: new Date(p.Fecha_Transferencia as string).toLocaleDateString('es-VE'),
          banco: `Banco #${p.IdBanco_Destino}`,
          formaPago: formaPagoMap[(p.Forma_Pago as number)] || `Tipo ${p.Forma_Pago}`,
          observaciones: (p.Observaciones_User as string) || '',
          reportadoPor: p.IdUsuario_Reporta as number,
        };
      }) as PagoRow[];
    },
  });

  const propiedadColumns: ColumnDef<PropiedadRow, unknown>[] = [
    { accessorKey: 'id', header: '#', size: 60 },
    { accessorKey: 'codigo', header: 'Código' },
    { accessorKey: 'alicuota', header: 'Alícuota' },
    { accessorKey: 'propietario', header: 'Propietario' },
    { accessorKey: 'estatus', header: 'Estatus' },
  ];

  const pagoColumns: ColumnDef<PagoRow, unknown>[] = [
    { accessorKey: 'id', header: '#', size: 55 },
    { accessorKey: 'propiedad', header: 'Inmueble', size: 90 },
    { accessorKey: 'monto', header: 'Monto' },
    { accessorKey: 'referencia', header: 'Ref. Bancaria' },
    { accessorKey: 'fechaPago', header: 'F. Transferencia' },
    { accessorKey: 'banco', header: 'Banco' },
    { accessorKey: 'formaPago', header: 'Forma Pago' },
    { accessorKey: 'observaciones', header: 'Observaciones' },
    { accessorKey: 'reportadoPor', header: 'Usr.', size: 55 },
  ];

  return (
    <div style={styles.container}>
      <section style={styles.panel}>
        <h2 style={styles.panelTitle}>Propiedades</h2>
        {propiedades ? (
          <HighDensityTable data={propiedades} columns={propiedadColumns} />
        ) : (
          <p style={styles.loading}>Cargando propiedades...</p>
        )}
      </section>

      <section style={styles.panel}>
        <h2 style={styles.panelTitle}>Bandeja de Verificación de Pagos</h2>
        {pagos ? (
          <HighDensityTable data={pagos} columns={pagoColumns} />
        ) : (
          <p style={styles.loading}>Cargando pagos pendientes...</p>
        )}
      </section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  panel: {
    background: '#1a2a3a',
    border: '1px solid #2a3a4a',
    borderRadius: 2,
    overflow: 'hidden',
  },
  panelTitle: {
    padding: '6px 8px',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#8395a7',
    borderBottom: '1px solid #2a3a4a',
  },
  loading: {
    padding: 12,
    fontSize: 11,
    color: '#576574',
  },
};
