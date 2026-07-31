package com.fitlog.backend.service;

import com.fitlog.backend.model.dto.AdminResult;
import com.fitlog.backend.model.entity.AgentSession;
import com.fitlog.backend.model.entity.ExerciseMedia;
import com.fitlog.backend.model.entity.KbChunk;
import com.fitlog.backend.repository.AdminMapper;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AdminService {

    private final AdminMapper adminMapper;

    public AdminService(AdminMapper adminMapper) {
        this.adminMapper = adminMapper;
    }

    private int offset(int page, int size) {
        return (Math.max(page, 1) - 1) * size;
    }

    private String blank(String s) {
        return s == null ? "" : s.trim();
    }

    private <T> AdminResult<T> wrap(String table, int page, int size, long total, List<T> rows) {
        AdminResult<T> r = new AdminResult<>();
        r.setTable(table);
        r.setPage(page);
        r.setSize(size);
        r.setTotal(total);
        r.setRows(rows);
        return r;
    }

    public AdminResult<ExerciseMedia> exercisesMedia(int page, int size, String keyword) {
        keyword = blank(keyword);
        List<ExerciseMedia> rows = adminMapper.pageExercisesMedia(keyword, size, offset(page, size));
        // 给控制台补一个同域预览地址（/media/<storageKey>），<img> 直接渲染
        rows.forEach(r -> {
            if (r.getStorageKey() != null && !r.getStorageKey().isEmpty()) {
                r.setPreviewUrl("/media/" + r.getStorageKey());
            }
        });
        long total = adminMapper.countExercisesMedia(keyword);
        return wrap("exercises_media", page, size, total, rows);
    }

    public AdminResult<KbChunk> kbChunks(int page, int size, String keyword, String source) {
        keyword = blank(keyword);
        source = blank(source);
        List<KbChunk> rows = adminMapper.pageKbChunks(keyword, source, size, offset(page, size));
        long total = adminMapper.countKbChunks(keyword, source);
        return wrap("kb_chunks", page, size, total, rows);
    }

    public AdminResult<AgentSession> agentSessions(int page, int size, String keyword, String openid) {
        keyword = blank(keyword);
        openid = blank(openid);
        List<AgentSession> rows = adminMapper.pageAgentSessions(keyword, openid, size, offset(page, size));
        long total = adminMapper.countAgentSessions(keyword, openid);
        return wrap("agent_sessions", page, size, total, rows);
    }
}
