package com.fitlog.backend.service;

import com.fitlog.backend.exception.AppException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Set;

@Service
public class ContentSafetyService {
    private final boolean mock;
    private final Set<String> blocked = Set.of("违法", "赌博", "毒品", "自残");

    public ContentSafetyService(@Value("${fitlog.content-safety.mock:true}") boolean mock) { this.mock = mock; }

    public void check(String text) {
        if (!mock || text == null) return;
        for (String word : blocked) {
            if (text.contains(word)) throw AppException.badRequest("CONTENT_BLOCKED", "问题包含暂不支持的内容");
        }
    }
}
