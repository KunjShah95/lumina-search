declare module 'pg-lite' {
    interface PgLiteOptions {
        dbPath?: string
        maxConnections?: number
    }

    interface QueryResult {
        rows: any[]
        rowCount?: number
    }

    interface PgLiteDatabase {
        query(sql: string, params?: any[]): Promise<QueryResult>
        exec(sql: string): Promise<void>
        close(): Promise<void>
    }

    function init(options?: PgLiteOptions): PgLiteDatabase
    
    export = init
}
