package com.fitlog.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.sql.init.dependency.DependsOnDatabaseInitialization;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Keeps the small, application-owned schema changes compatible with existing local databases. */
@Component
@DependsOnDatabaseInitialization
public class DatabaseSchemaInitializer {
    private static final String AGENT_SESSIONS = "agent_sessions";

    private final JdbcTemplate jdbcTemplate;
    private final boolean autoMigrate;

    public DatabaseSchemaInitializer(
            JdbcTemplate jdbcTemplate,
            @Value("${fitlog.database.auto-migrate:true}") boolean autoMigrate) {
        this.jdbcTemplate = jdbcTemplate;
        this.autoMigrate = autoMigrate;
    }

    @jakarta.annotation.PostConstruct
    public void initialize() {
        if (!autoMigrate) return;

        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS agent_sessions (
                  id BIGINT AUTO_INCREMENT PRIMARY KEY,
                  openid VARCHAR(64) NOT NULL,
                  session_id VARCHAR(64) NOT NULL,
                  messages JSON NOT NULL,
                  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  INDEX idx_openid (openid),
                  UNIQUE KEY uk_agent_user_session (openid, session_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);

        if (!hasColumn("session_id")) {
            jdbcTemplate.execute("ALTER TABLE agent_sessions ADD COLUMN session_id VARCHAR(64) NULL AFTER openid");
            jdbcTemplate.update("""
                    UPDATE agent_sessions
                    SET session_id = CONCAT('legacy-', id)
                    WHERE session_id IS NULL OR session_id = ''
                    """);
            jdbcTemplate.execute("ALTER TABLE agent_sessions MODIFY COLUMN session_id VARCHAR(64) NOT NULL");
        }

        if (!hasUniqueIndex("uk_agent_user_session")) {
            jdbcTemplate.execute(
                    "ALTER TABLE agent_sessions ADD UNIQUE KEY uk_agent_user_session (openid, session_id)");
        }
    }

    private boolean hasColumn(String column) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM information_schema.columns
                WHERE table_schema = DATABASE()
                  AND table_name = ?
                  AND column_name = ?
                """, Integer.class, AGENT_SESSIONS, column);
        return count != null && count > 0;
    }

    private boolean hasUniqueIndex(String indexName) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM information_schema.statistics
                WHERE table_schema = DATABASE()
                  AND table_name = ?
                  AND index_name = ?
                  AND non_unique = 0
                """, Integer.class, AGENT_SESSIONS, indexName);
        return count != null && count > 0;
    }
}
