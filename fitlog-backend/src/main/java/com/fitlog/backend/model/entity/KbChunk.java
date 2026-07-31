package com.fitlog.backend.model.entity;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class KbChunk {
    private Long id;
    private String source;       // 'exercise' | 'user_history'
    private String refId;
    private String chunkText;
    private String embedding;    // JSON 数组文本，如 "[0.12,-0.03,...]"，应用内解析为 float[]
    private String metaJson;     // JSON 对象文本，如 {"bodyPart":"胸","target":"胸大肌"}
    private LocalDateTime createdAt;
}
