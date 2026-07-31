-- FitLog backend schema (MySQL 8)
-- embedding 用 JSON 数组存浮点；检索在应用内算余弦，不引入 PGVector。

-- 图片映射：exerciseId -> 存储 key / URL
CREATE TABLE IF NOT EXISTS exercises_media (
  exercise_id  VARCHAR(64)  PRIMARY KEY,
  media_type   VARCHAR(16)  NOT NULL DEFAULT 'gif',
  storage_key  VARCHAR(255) NOT NULL,         -- COS key 或静态路径
  url          VARCHAR(512) DEFAULT NULL,     -- 构建/同步时生成
  width        INT          DEFAULT NULL,
  height       INT          DEFAULT NULL,
  created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- RAG 知识块 + 向量
CREATE TABLE IF NOT EXISTS kb_chunks (
  id          BIGINT       AUTO_INCREMENT PRIMARY KEY,
  source      VARCHAR(16)  NOT NULL,          -- 'exercise' | 'user_history'
  ref_id      VARCHAR(64)  DEFAULT NULL,
  chunk_text  TEXT         NOT NULL,
  embedding   JSON         NOT NULL,          -- [0.12, -0.03, ...]
  meta_json   JSON         DEFAULT NULL,      -- {bodyPart, target, equipment}
  created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_source (source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Agent 多轮记忆
CREATE TABLE IF NOT EXISTS agent_sessions (
  id          BIGINT       AUTO_INCREMENT PRIMARY KEY,
  openid      VARCHAR(64)  NOT NULL,
  messages    JSON         NOT NULL,          -- [{role, content, ts}]
  updated_at  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_openid (openid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
