import mysql from 'mysql2/promise';
export declare const mysqlPool: mysql.Pool;
export declare function connectDatabase(): Promise<void>;
