-- UI-3.10A: 性能监控 + 错误追踪 数据库表结构
-- 创建时间：2026-03-27

-- =============================================================================
-- 性能日志表
-- =============================================================================

CREATE TABLE IF NOT EXISTS performance_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'GET',
    status_code INTEGER NOT NULL,
    duration_ms REAL NOT NULL,
    is_slow INTEGER NOT NULL DEFAULT 0,
    request_id TEXT,
    meta_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_performance_endpoint ON performance_logs (endpoint);
CREATE INDEX IF NOT EXISTS idx_performance_created_at ON performance_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_performance_is_slow ON performance_logs (is_slow);

-- =============================================================================
-- 前端错误表
-- =============================================================================

CREATE TABLE IF NOT EXISTS frontend_errors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    page TEXT,
    message TEXT NOT NULL,
    source TEXT,
    lineno INTEGER,
    colno INTEGER,
    stack TEXT,
    user_agent TEXT,
    is_processed INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_frontend_page ON frontend_errors (page);
CREATE INDEX IF NOT EXISTS idx_frontend_created_at ON frontend_errors (created_at);

-- =============================================================================
-- 数据库查询性能表
-- =============================================================================

CREATE TABLE IF NOT EXISTS db_query_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    query_type TEXT,
    table_name TEXT,
    duration_ms REAL NOT NULL,
    is_slow INTEGER NOT NULL DEFAULT 0,
    query_hash TEXT,
    query_preview TEXT
);

CREATE INDEX IF NOT EXISTS idx_db_query_type ON db_query_logs (query_type);
CREATE INDEX IF NOT EXISTS idx_db_is_slow ON db_query_logs (is_slow);
