package com.fitlog.backend.controller;

import com.fitlog.backend.model.dto.AgentRequest;
import com.fitlog.backend.service.AgentService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/agent")
public class AgentController {
    private final AgentService agentService;

    public AgentController(AgentService agentService) { this.agentService = agentService; }

    @PostMapping(value = {"", "/stream"}, produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@Valid @RequestBody AgentRequest request, HttpServletRequest httpRequest) {
        SseEmitter emitter = new SseEmitter(60000L);
        String openid = (String) httpRequest.getAttribute("fitlog.openid");
        java.util.concurrent.CompletableFuture.runAsync(() -> agentService.stream(request, openid, emitter));
        return emitter;
    }
}
