import React, { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from '@tanstack/react-table';

interface HighDensityTableProps<T extends object> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  onRowClick?: (row: T) => void;
}

export function HighDensityTable<T extends object>({
  data,
  columns,
  onRowClick,
}: HighDensityTableProps<T>): React.ReactElement {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState('');

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div style={styles.wrapper}>
      <input
        type="text"
        placeholder="Filtrar..."
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
        style={styles.filter}
      />
      <table style={styles.table}>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                  style={{
                    ...styles.th,
                    cursor: header.column.getCanSort() ? 'pointer' : 'default',
                  }}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getIsSorted() === 'asc' ? ' ▲' : header.column.getIsSorted() === 'desc' ? ' ▼' : ''}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onRowClick?.(row.original)}
              style={{ ...styles.tr, cursor: onRowClick ? 'pointer' : 'default' }}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} style={styles.td}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={styles.count}>
        {table.getRowModel().rows.length} registros
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    width: '100%',
    overflow: 'auto',
  },
  filter: {
    width: '100%',
    padding: '4px 8px',
    marginBottom: 6,
    background: '#1a2a3a',
    border: '1px solid #2a3a4a',
    color: '#c8d6e5',
    fontSize: 12,
    outline: 'none',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  th: {
    padding: '4px 8px',
    textAlign: 'left',
    borderBottom: '2px solid #2a3a4a',
    color: '#48dbfb',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    whiteSpace: 'nowrap',
    position: 'sticky',
    top: 0,
    background: '#0f1923',
    userSelect: 'none',
  },
  tr: {
    borderBottom: '1px solid #1a2a3a',
  },
  td: {
    padding: '3px 8px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 300,
  },
  count: {
    padding: '4px 8px',
    fontSize: 10,
    color: '#576574',
    textAlign: 'right',
  },
};
