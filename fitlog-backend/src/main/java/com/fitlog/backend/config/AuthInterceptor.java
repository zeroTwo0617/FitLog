package com.fitlog.backend.config;

import com.fitlog.backend.exception.AppException;
import com.fitlog.backend.service.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpMethod;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

public class AuthInterceptor implements HandlerInterceptor {
    public static final String OPENID = "fitlog.openid";
    private final JwtService jwtService;
    private final Set<String> adminOpenids;

    public AuthInterceptor(JwtService jwtService, String admins) {
        this.jwtService = jwtService;
        this.adminOpenids = Arrays.stream(admins.split(",")).map(String::trim).filter(s -> !s.isBlank()).collect(Collectors.toSet());
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (HttpMethod.OPTIONS.matches(request.getMethod())) return true;
        String authorization = request.getHeader("Authorization");
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw AppException.unauthorized("请先登录");
        }
        String openid = jwtService.subject(authorization.substring(7).trim());
        request.setAttribute(OPENID, openid);
        if (request.getRequestURI().startsWith(request.getContextPath() + "/api/admin") && !adminOpenids.contains(openid)) {
            throw AppException.forbidden("没有管理权限");
        }
        return true;
    }
}
