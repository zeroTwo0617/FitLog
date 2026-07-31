package com.fitlog.backend.controller;

import com.fitlog.backend.model.dto.AgentRequest;
import com.fitlog.backend.model.dto.AgentResponse;
import com.fitlog.backend.service.AgentService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/agent")
public class AgentController {

    private final AgentService agentService;

    public AgentController(AgentService agentService) {
        this.agentService = agentService;
    }

    @PostMapping
    public AgentResponse chat(@RequestBody AgentRequest req) {
        return agentService.handle(req);
    }
}
