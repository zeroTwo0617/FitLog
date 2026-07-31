package com.fitlog.backend.model.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class AgentRequest {
    @Size(max = 64)
    private String sessionId;

    @NotBlank
    @Size(max = 2000)
    private String query;

    @Size(max = 16)
    private String action = "chat";

    @Valid
    private AgentContext context = new AgentContext();
}
