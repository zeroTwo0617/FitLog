package com.fitlog.backend.model.entity;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class AgentSession {
    private Long id;
    private String openid;
    private String sessionId;
    private String messages;     // JSON 数组文本，如 "[{role,content,ts},...]"
    private LocalDateTime updatedAt;
}
