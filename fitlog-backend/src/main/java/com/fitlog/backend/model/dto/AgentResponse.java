package com.fitlog.backend.model.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class AgentResponse {
    private Boolean ok = true;
    private String code;        // 出错: EMBED_FAIL | LLM_FAIL | NO_DATA | BAD_ACTION
    private String msg;
    private String action;

    // chat -> 文本答案（M1b 为 echo 占位）
    private String answer;
    // search -> 命中列表
    private List<SearchHit> results;
    // insight -> 统计 + 报告
    private Map<String, Object> stats;
    private String report;

    @Data
    public static class SearchHit {
        private String exerciseId;
        private String name;
        private Double score;
        private String reason;
    }

    public static AgentResponse ok(String action) {
        AgentResponse r = new AgentResponse();
        r.action = action;
        return r;
    }

    public static AgentResponse fail(String code, String msg) {
        AgentResponse r = new AgentResponse();
        r.ok = false;
        r.code = code;
        r.msg = msg;
        return r;
    }
}
