package com.fitlog.backend.service;

import com.fitlog.backend.exception.AppException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class RateLimitService {
    private final int limit;
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();

    public RateLimitService(@Value("${fitlog.request.rate-limit-per-minute:20}") int limit) { this.limit = Math.max(1, limit); }

    public void check(String user) {
        long minute = System.currentTimeMillis() / 60000;
        Window window = windows.compute(user, (key, old) -> {
            if (old == null || old.minute != minute) return new Window(minute);
            old.count.incrementAndGet();
            return old;
        });
        if (window.count.get() > limit) throw new AppException("RATE_LIMITED", "请求过于频繁，请稍后再试", org.springframework.http.HttpStatus.TOO_MANY_REQUESTS);
    }

    private static final class Window {
        private final long minute;
        private final AtomicInteger count = new AtomicInteger(1);
        private Window(long minute) { this.minute = minute; }
    }
}
