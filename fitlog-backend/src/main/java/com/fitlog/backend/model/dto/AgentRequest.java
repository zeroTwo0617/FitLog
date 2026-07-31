package com.fitlog.backend.model.dto;

import lombok.Data;

import java.util.Map;

@Data
public class AgentRequest {
    private String openid;                       // 小程序传入
    private String action;                       // chat | search | insight
    private String query;                        // 用户问题
    private String sessionId;                    // 多轮用，可选
    private String range;                        // insight: month | 30d | all
    private Map<String, String> filters;         // search: {bodyPart, equipment}
    private String recentSummary;                // MVP 由小程序传入的近期训练摘要
}
