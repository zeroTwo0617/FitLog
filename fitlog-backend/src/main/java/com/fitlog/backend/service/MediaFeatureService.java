package com.fitlog.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * 图片 API 总开关（控制台可热切换，无需重启）。
 * 默认 true；设为 false 时 /api/media/* 全部回退占位图，前端“暂时没有图片”。
 */
@Service
public class MediaFeatureService {

    private volatile boolean enabled;

    public MediaFeatureService(@Value("${fitlog.media.enabled:true}") boolean enabled) {
        this.enabled = enabled;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean v) {
        this.enabled = v;
    }
}
