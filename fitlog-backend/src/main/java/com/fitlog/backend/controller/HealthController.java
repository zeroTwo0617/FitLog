package com.fitlog.backend.controller;

import com.fitlog.backend.service.AgentService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class HealthController {

    private final AgentService agentService;

    public HealthController(AgentService agentService) {
        this.agentService = agentService;
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "UP");
    }

    // 自检：确认 LLM key 是否已配置（复用 rag-kb-demo 思路）
    @GetMapping("/agent/llm-status")
    public Map<String, Object> llmStatus() {
        return Map.of("available", agentService.isLlmAvailable());
    }
}
