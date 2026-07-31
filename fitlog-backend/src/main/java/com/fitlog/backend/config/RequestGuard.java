package com.fitlog.backend.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class RequestGuard extends OncePerRequestFilter {
    private final long maxBodyBytes;

    public RequestGuard(@Value("${fitlog.request.max-body-bytes:65536}") long maxBodyBytes) {
        this.maxBodyBytes = maxBodyBytes;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        request.setAttribute("fitlog.requestId", UUID.randomUUID().toString());
        if (request.getContentLengthLong() > maxBodyBytes) {
            response.sendError(HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE, "request body too large");
            return;
        }
        filterChain.doFilter(request, response);
    }
}
