package com.fitlog.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fitlog.backend.exception.AppException;
import com.fitlog.backend.model.dto.AgentContext;
import com.fitlog.backend.model.dto.AgentRequest;
import com.fitlog.backend.model.dto.PlanDraft;
import com.fitlog.backend.model.entity.AgentSession;
import com.fitlog.backend.repository.AgentSessionMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class AgentService {
    private final ObjectMapper mapper;
    private final AgentSessionMapper sessionMapper;
    private final LlmClient llm;
    private final RateLimitService rateLimit;
    private final ContentSafetyService contentSafety;
    private final int maxContextItems;

    public AgentService(ObjectMapper mapper, AgentSessionMapper sessionMapper, LlmClient llm,
                        RateLimitService rateLimit, ContentSafetyService contentSafety,
                        @Value("${fitlog.request.max-context-items:30}") int maxContextItems) {
        this.mapper = mapper;
        this.sessionMapper = sessionMapper;
        this.llm = llm;
        this.rateLimit = rateLimit;
        this.contentSafety = contentSafety;
        this.maxContextItems = maxContextItems;
    }

    public boolean isLlmAvailable() { return llm.available(); }

    public void stream(AgentRequest request, String openid, SseEmitter emitter) {
        String sessionId = request.getSessionId() == null || request.getSessionId().isBlank()
                ? UUID.randomUUID().toString().replace("-", "") : request.getSessionId().trim();
        try {
            rateLimit.check(openid);
            validate(request);
            contentSafety.check(request.getQuery());
            send(emitter, "meta", Map.of("sessionId", sessionId, "providerAvailable", llm.available()));
            String prompt = prompt(request, openid, sessionId);
            String answer = llm.complete(systemPrompt(), prompt);
            send(emitter, "delta", Map.of("text", answer));
            PlanDraft draft = parsePlan(answer);
            if (draft != null) send(emitter, "plan", Map.of("planDraft", draft));
            saveMessage(openid, sessionId, request.getQuery(), answer);
            send(emitter, "done", Map.of("sessionId", sessionId, "hasPlan", draft != null));
            emitter.complete();
        } catch (Exception ex) {
            try { send(emitter, "error", Map.of("code", code(ex), "message", ex.getMessage() == null ? "请求失败" : ex.getMessage())); }
            catch (Exception ignored) { }
            emitter.completeWithError(ex);
        }
    }

    private void validate(AgentRequest request) {
        if (request.getAction() != null && !request.getAction().isBlank()
                && !request.getAction().equals("chat") && !request.getAction().equals("plan")) {
            throw AppException.badRequest("BAD_ACTION", "只支持 chat 或 plan");
        }
        AgentContext c = request.getContext() == null ? new AgentContext() : request.getContext();
        int count = size(c.getConstraints()) + size(c.getRecentWorkouts()) + size(c.getExistingPlans());
        if (count > maxContextItems) throw AppException.badRequest("CONTEXT_TOO_LARGE", "训练上下文过大");
    }

    private int size(List<?> list) { return list == null ? 0 : list.size(); }

    private String prompt(AgentRequest request, String openid, String sessionId) {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("user", openid);
            payload.put("sessionId", sessionId);
            payload.put("query", request.getQuery());
            payload.put("context", request.getContext() == null ? new AgentContext() : request.getContext());
            return mapper.writeValueAsString(payload);
        } catch (Exception ex) { throw new IllegalStateException(ex); }
    }

    private String systemPrompt() {
        return "你是 FitLog 训练方案助手。只根据用户提供的训练上下文给出安全、具体、可执行的建议。若用户要求计划，在回答中附加一个 JSON 对象，字段必须是 planDraft，结构为 {name:string,items:[{exerciseId:string,exerciseName:string,targetSets:number|null,targetReps:number|null,targetWeight:number|null}]}。不要虚构 exerciseId；上下文没有动作 ID 时不要生成 planDraft。JSON 必须是完整合法对象。";
    }

    private PlanDraft parsePlan(String answer) {
        try {
            int start = answer.indexOf("{\"planDraft\"");
            if (start < 0) start = answer.indexOf("{\n  \"planDraft\"");
            if (start < 0) return null;
            JsonNode outer = mapper.readTree(answer.substring(start));
            JsonNode node = outer.path("planDraft");
            if (node.isMissingNode()) return null;
            PlanDraft draft = mapper.treeToValue(node, PlanDraft.class);
            if (draft.getName() == null || draft.getName().isBlank() || draft.getItems() == null || draft.getItems().isEmpty() || draft.getItems().size() > 30) return null;
            for (PlanDraft.Item item : draft.getItems()) {
                if (item.getExerciseId() == null || item.getExerciseId().isBlank() || item.getExerciseName() == null || item.getExerciseName().isBlank()) return null;
                if (positive(item.getTargetSets()) == false && item.getTargetSets() != null) return null;
                if (positive(item.getTargetReps()) == false && item.getTargetReps() != null) return null;
                if (item.getTargetWeight() != null && item.getTargetWeight() < 0) return null;
            }
            return draft;
        } catch (Exception ignored) { return null; }
    }

    private boolean positive(Integer value) { return value == null || value > 0; }

    private void saveMessage(String openid, String sessionId, String query, String answer) throws Exception {
        AgentSession current = sessionMapper.selectByUserAndSession(openid, sessionId);
        List<Map<String, Object>> messages = new ArrayList<>();
        if (current != null && current.getMessages() != null) {
            JsonNode old = mapper.readTree(current.getMessages());
            if (old.isArray()) old.forEach(n -> messages.add(mapper.convertValue(n, Map.class)));
        }
        messages.add(message("user", query));
        messages.add(message("assistant", answer));
        if (messages.size() > 20) messages.subList(0, messages.size() - 20).clear();
        String json = mapper.writeValueAsString(messages);
        if (current == null) {
            AgentSession session = new AgentSession();
            session.setOpenid(openid); session.setSessionId(sessionId); session.setMessages(json);
            sessionMapper.insert(session);
        } else sessionMapper.updateMessages(current.getId(), json);
    }

    private Map<String, Object> message(String role, String content) {
        return Map.of("role", role, "content", content, "ts", Instant.now().toString());
    }

    private String code(Exception ex) { return ex instanceof AppException ? ((AppException) ex).getCode() : "AGENT_FAILED"; }

    private void send(SseEmitter emitter, String event, Object data) throws IOException {
        emitter.send(SseEmitter.event().name(event).data(data));
    }
}
