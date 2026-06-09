import mysql from 'mysql2/promise';
import { injectable } from 'tsyringe';

export interface MySQLConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

@injectable()
export class MySQLConnection {
  private pool: mysql.Pool | null = null;

  async connect(config: MySQLConfig): Promise<mysql.Pool> {
    if (!this.pool) {
      this.pool = mysql.createPool({
        ...config,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        charset: 'utf8mb4',
      });
    }
    return this.pool;
  }

  getPool(): mysql.Pool {
    if (!this.pool) throw new Error('MySQL pool not initialized');
    return this.pool;
  }

  async getConnection(): Promise<mysql.PoolConnection> {
    return this.getPool().getConnection();
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}
