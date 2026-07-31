package com.fitlog.backend.service;

import com.fitlog.backend.model.dto.MediaDto;
import com.fitlog.backend.model.entity.ExerciseMedia;
import com.fitlog.backend.repository.ExerciseMediaMapper;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class MediaService {

    private final ExerciseMediaMapper mediaMapper;
    private final MediaFeatureService feature;
    private final String mediaBaseUrl;
    private final String placeholderUrl;

    public MediaService(ExerciseMediaMapper mediaMapper,
                        MediaFeatureService feature,
                        @Value("${fitlog.media.base-url:}") String mediaBaseUrl,
                        @Value("${fitlog.media.placeholder:/media/placeholder/exercise-missing.png}") String placeholderUrl) {
        this.mediaMapper = mediaMapper;
        this.feature = feature;
        this.mediaBaseUrl = mediaBaseUrl;
        this.placeholderUrl = placeholderUrl;
    }

    /** 开关关闭 / 无记录时返回的“无图”视图 */
    private MediaDto disabled(String exerciseId) {
        MediaDto d = new MediaDto();
        d.setExerciseId(exerciseId);
        d.setAvailable(false);
        d.setPlaceholder(placeholderUrl);
        return d;
    }

    private MediaDto toDto(ExerciseMedia m) {
        if (m == null) return null;
        MediaDto dto = new MediaDto();
        BeanUtils.copyProperties(m, dto);
        dto.setAvailable(true);
        dto.setPlaceholder(placeholderUrl);
        if (dto.getUrl() == null || dto.getUrl().isEmpty()) {
            // 没预生成 url：按 base-url 拼绝对地址，否则给同域相对地址（浏览器/同域小程序可用）
            String rel = "/media/" + m.getStorageKey();
            dto.setUrl(mediaBaseUrl != null && !mediaBaseUrl.isEmpty()
                    ? (mediaBaseUrl.endsWith("/") ? mediaBaseUrl + m.getStorageKey() : mediaBaseUrl + "/" + m.getStorageKey())
                    : rel);
        }
        return dto;
    }

    public MediaDto getByExerciseId(String exerciseId) {
        if (!feature.isEnabled()) return disabled(exerciseId);
        return toDto(mediaMapper.selectByExerciseId(exerciseId));
    }

    public Map<String, MediaDto> getMap(List<String> ids) {
        Map<String, MediaDto> map = new LinkedHashMap<>();
        if (ids == null || ids.isEmpty()) return map;
        if (!feature.isEnabled()) {
            ids.forEach(id -> map.put(id, disabled(id)));
            return map;
        }
        mediaMapper.selectByIds(ids).forEach(m -> {
            MediaDto dto = toDto(m);
            map.put(m.getExerciseId(), dto != null ? dto : disabled(m.getExerciseId()));
        });
        // 补全 DB 里没有的 id（同样回退占位）
        ids.forEach(id -> map.putIfAbsent(id, disabled(id)));
        return map;
    }

    public List<MediaDto> listAll() {
        // TODO M6b: 支持 bodyPart / equipment 过滤（需 join kb_chunks 或扩展 exercises_media 字段）
        List<MediaDto> result = new ArrayList<>();
        if (!feature.isEnabled()) return result;
        mediaMapper.selectAll().forEach(m -> {
            MediaDto dto = toDto(m);
            if (dto != null) result.add(dto);
        });
        return result;
    }
}
