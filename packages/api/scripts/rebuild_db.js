const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../../.env') });
dotenv.config();

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3307,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  });

  console.log('Conectado a MariaDB/MySQL. Recreando base de datos...');
  
  const sqlFilePath = path.join(__dirname, '../../../sql/001_create_schema.sql');
  const sql = fs.readFileSync(sqlFilePath, 'utf8');

  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
  
  const tablesToDrop = [
    'Cuenta_Corriente_Propiedad', 'CuentaCorrientePropiedad',
    'Pago_Reportado', 'PagoReportado',
    'Recibo_Mensual', 'ReciboMensual',
    'Gasto_Condominio', 'GastoCondominio',
    'Propiedad',
    'Usuario_Condominio_Rol', 'UsuarioCondominioRol',
    'Usuario',
    'Condominio'
  ];

  for (const table of tablesToDrop) {
    try {
      await connection.execute(`DROP TABLE IF EXISTS abitia_db.${table}`);
      console.log(`Tabla ${table} eliminada (si existía).`);
    } catch (err) {
      console.error(`Error eliminando ${table}:`, err.message);
    }
  }

  await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

  for (const statement of statements) {
    try {
      await connection.execute(statement);
    } catch (err) {
      console.error(`Error ejecutando statement:\n${statement}\nError:`, err.message);
    }
  }

  console.log('Base de datos recreada con éxito.');
  await connection.end();
}

run().catch(console.error);
