package com.fitlog.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fitlog.backend.exception.AppException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

@Service
public class LlmClient {
    private final String baseUrl;
    private final String apiKey;
    private final String model;
    private final int timeoutSeconds;
    private final int maxTokens;
    private final ObjectMapper mapper;

    public LlmClient(@Value("${fitlog.llm.base-url:}") String baseUrl,
                     @Value("${fitlog.llm.api-key:}") String apiKey,
                     @Value("${fitlog.llm.model:}") String model,
                     @Value("${fitlog.llm.timeout-seconds:45}") int timeoutSeconds,
                     @Value("${fitlog.llm.max-tokens:1200}") int maxTokens,
                     ObjectMapper mapper) {
        this.baseUrl = baseUrl == null ? "" : baseUrl.trim();
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model == null ? "" : model.trim();
        this.timeoutSeconds = Math.max(3, timeoutSeconds);
        this.maxTokens = Math.max(128, maxTokens);
        this.mapper = mapper;
    }

    public boolean available() { return !baseUrl.isBlank() && !apiKey.isBlank() && !model.isBlank(); }

    public String complete(String system, String user) {
        if (!available()) return "我已收到你的训练目标。请补充训练频率、可用器械和近期训练记录，我会给出更具体的建议。";
        try {
            String endpoint = baseUrl.endsWith("/") ? baseUrl + "chat/completions" : baseUrl + "/chat/completions";
            Map<String, Object> body = Map.of(
                    "model", model,
                    "temperature", 0.4,
                    "max_tokens", maxTokens,
                    "messages", List.of(Map.of("role", "system", "content", system), Map.of("role", "user", "content", user)));
            HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(endpoint))
                    .timeout(Duration.ofSeconds(timeoutSeconds))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)));
            HttpResponse<String> response = HttpClient.newHttpClient().send(builder.build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) throw new AppException("LLM_FAILED", "模型服务暂时不可用", org.springframework.http.HttpStatus.BAD_GATEWAY);
            JsonNode root = mapper.readTree(response.body());
            JsonNode content = root.path("choices").path(0).path("message").path("content");
            if (!content.isTextual()) throw new AppException("LLM_INVALID", "模型返回格式无效", org.springframework.http.HttpStatus.BAD_GATEWAY);
            return content.asText();
        } catch (AppException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new AppException("LLM_TIMEOUT", "模型响应超时，请稍后重试", org.springframework.http.HttpStatus.GATEWAY_TIMEOUT);
        }
    }
}
