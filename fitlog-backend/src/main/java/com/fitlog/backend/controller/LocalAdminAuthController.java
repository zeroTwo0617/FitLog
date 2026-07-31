package com.fitlog.backend.controller;

import com.fitlog.backend.exception.AppException;
import com.fitlog.backend.model.dto.WxLoginResponse;
import com.fitlog.backend.service.JwtService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Local-only login used by the browser admin console. Never enabled in production. */
@Profile("local")
@RestController
@RequestMapping("/api/auth")
public class LocalAdminAuthController {
    private final JwtService jwtService;
    private final String mockOpenid;

    public LocalAdminAuthController(JwtService jwtService,
                                    @Value("${fitlog.auth.mock-openid:}") String mockOpenid) {
        this.jwtService = jwtService;
        this.mockOpenid = mockOpenid;
    }

    @PostMapping("/local-admin")
    public WxLoginResponse login() {
        if (mockOpenid == null || mockOpenid.isBlank()) {
            throw AppException.unauthorized("本地管理员登录未配置");
        }
        return new WxLoginResponse(jwtService.create(mockOpenid.trim()), jwtService.expiresSeconds());
    }
}
