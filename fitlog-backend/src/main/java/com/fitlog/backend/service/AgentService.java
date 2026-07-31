package com.fitlog.backend.service;

import com.fitlog.backend.model.dto.AgentRequest;
import com.fitlog.backend.model.dto.AgentResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Agent 编排服务。M1b 仅实现 action 分发 + echo，验证链路；
 * M2b 接入 RAG 检索（search）、M3b 接入 LLM（chat）、M4b 接入统计（insight）。
 */
@Service
public class AgentService {

    private final String llmApiKey;

    public AgentService(@Value("${fitlog.llm.api-key:}") String llmApiKey) {
        this.llmApiKey = llmApiKey;
    }

    public boolean isLlmAvailable() {
        return llmApiKey != null && !llmApiKey.isEmpty();
    }

    public AgentResponse handle(AgentRequest req) {
        String action = req.getAction();
        if (action == null || action.isEmpty()) {
            return AgentResponse.fail("BAD_ACTION", "action 不能为空");
        }
        switch (action) {
            case "chat":
                return echoChat(req);
            case "search":
                return echoSearch(req);
            case "insight":
                return echoInsight(req);
            default:
                return AgentResponse.fail("BAD_ACTION", "不支持的 action: " + action);
        }
    }

    // M1b: 仅回显请求，确认「小程序 -> 后端 -> 分发」链路打通
    private AgentResponse echoChat(AgentRequest req) {
        AgentResponse r = AgentResponse.ok("chat");
        r.setAnswer("[M1b echo] action=chat, openid=" + req.getOpenid()
                + ", query=" + req.getQuery()
                + ", llmAvailable=" + isLlmAvailable());
        return r;
    }

    private AgentResponse echoSearch(AgentRequest req) {
        AgentResponse r = AgentResponse.ok("search");
        r.setAnswer("[M1b echo] action=search, query=" + req.getQuery()
                + ", filters=" + req.getFilters());
        return r;
    }

    private AgentResponse echoInsight(AgentRequest req) {
        AgentResponse r = AgentResponse.ok("insight");
        r.setAnswer("[M1b echo] action=insight, range=" + req.getRange()
                + ", recentSummary=" + req.getRecentSummary());
        return r;
    }
}
