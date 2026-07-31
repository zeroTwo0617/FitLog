package com.fitlog.backend.controller;

import com.fitlog.backend.model.dto.AdminResult;
import com.fitlog.backend.model.entity.AgentSession;
import com.fitlog.backend.model.entity.ExerciseMedia;
import com.fitlog.backend.model.entity.KbChunk;
import com.fitlog.backend.service.AdminService;
import com.fitlog.backend.service.MediaFeatureService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminService adminService;
    private final MediaFeatureService mediaFeature;

    public AdminController(AdminService adminService, MediaFeatureService mediaFeature) {
        this.adminService = adminService;
        this.mediaFeature = mediaFeature;
    }

    @GetMapping("/exercises_media")
    public AdminResult<ExerciseMedia> exercisesMedia(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String keyword) {
        return adminService.exercisesMedia(page, size, keyword);
    }

    @GetMapping("/kb_chunks")
    public AdminResult<KbChunk> kbChunks(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String source) {
        return adminService.kbChunks(page, size, keyword, source);
    }

    @GetMapping("/agent_sessions")
    public AdminResult<AgentSession> agentSessions(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String openid) {
        return adminService.agentSessions(page, size, keyword, openid);
    }

    /** 热切换图片 API 开关：关掉后前端全部回退占位图 */
    @PostMapping("/media-enabled")
    public Map<String, Object> setMediaEnabled(@RequestParam boolean enabled) {
        mediaFeature.setEnabled(enabled);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("enabled", mediaFeature.isEnabled());
        return m;
    }
}
