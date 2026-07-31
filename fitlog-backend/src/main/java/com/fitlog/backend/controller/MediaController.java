package com.fitlog.backend.controller;

import com.fitlog.backend.model.dto.MediaDto;
import com.fitlog.backend.service.MediaFeatureService;
import com.fitlog.backend.service.MediaService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/media")
public class MediaController {

    private final MediaService mediaService;
    private final MediaFeatureService mediaFeature;
    private final String placeholderUrl;

    public MediaController(MediaService mediaService,
                           MediaFeatureService mediaFeature,
                           @Value("${fitlog.media.placeholder:/media/placeholder/exercise-missing.png}") String placeholderUrl) {
        this.mediaService = mediaService;
        this.mediaFeature = mediaFeature;
        this.placeholderUrl = placeholderUrl;
    }

    /** 开关状态 + 占位图地址（控制台读取/前端可缓存） */
    @GetMapping("/enabled")
    public Map<String, Object> enabled() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("enabled", mediaFeature.isEnabled());
        m.put("placeholder", placeholderUrl);
        return m;
    }

    @GetMapping("/exercise/{exerciseId}")
    public ResponseEntity<MediaDto> getByExercise(@PathVariable String exerciseId) {
        // 始终返回（含 available 标记），前端据此决定显示真图还是占位图
        return ResponseEntity.ok(mediaService.getByExerciseId(exerciseId));
    }

    @GetMapping("/map")
    public Map<String, MediaDto> getMap(@RequestParam String ids) {
        List<String> idList = java.util.Arrays.stream(ids.split(","))
                .map(String::trim).filter(s -> !s.isBlank()).limit(100).toList();
        return mediaService.getMap(idList);
    }

    @GetMapping("/list")
    public List<MediaDto> list(@RequestParam(required = false) String bodyPart,
                               @RequestParam(required = false) String equipment) {
        // bodyPart / equipment 过滤 M6b 实现（见 MediaService.listAll 注释）
        return mediaService.listAll();
    }
}
