/**
 * Script de actualización de contraseñas para producción.
 * Ejecutar UNA SOLA VEZ en el servidor para cifrar contraseñas en texto plano.
 *
 * Uso:  node scripts/hash_passwords.js
 */
'use strict';
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// Cargar .env.production
const envPath = path.join(__dirname, '../../../.env.production');
if (fs.existsSync(envPath)) require('dotenv').config({ path: envPath });
else require('dotenv').config();

const mysql = require('mysql2/promise');

const SALT_ROUNDS = 10;

// Contraseñas a actualizar: { email, plainPassword }
// Añade aquí TODOS los usuarios cuyas contraseñas estén en texto plano.
const USERS_TO_UPDATE = [
  { email: 'admin@casa10.com', plainPassword: 'admin123' },
  { email: 'owner@casa10.com', plainPassword: 'owner123' },
];

async function run() {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'abitia_db',
  });

  console.log('[hash_passwords] Conectado a la base de datos.');

  for (const { email, plainPassword } of USERS_TO_UPDATE) {
    // Verificar si ya tiene hash (los hashes bcrypt empiezan con $2b$)
    const [rows] = await pool.execute(
      'SELECT IdUsuario, Password_Hash FROM Usuario WHERE Email = ?',
      [email]
    );

    if (rows.length === 0) {
      console.warn(`  [SKIP] Usuario no encontrado: ${email}`);
      continue;
    }

    const { IdUsuario, Password_Hash } = rows[0];

    if (Password_Hash.startsWith('$2b$') || Password_Hash.startsWith('$2a$')) {
      console.log(`  [OK] ${email} ya tiene hash bcrypt. Sin cambios.`);
      continue;
    }

    const hashed = await bcrypt.hash(plainPassword, SALT_ROUNDS);
    await pool.execute(
      'UPDATE Usuario SET Password_Hash = ? WHERE IdUsuario = ?',
      [hashed, IdUsuario]
    );
    console.log(`  [UPDATED] ${email} → contraseña actualizada a hash bcrypt.`);
  }

  await pool.end();
  console.log('[hash_passwords] Completado.');
}

run().catch(err => {
  console.error('[hash_passwords] ERROR:', err.message);
  process.exit(1);
});
