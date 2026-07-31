package com.fitlog.backend.controller;

import com.fitlog.backend.model.dto.WxLoginRequest;
import com.fitlog.backend.model.dto.WxLoginResponse;
import com.fitlog.backend.service.JwtService;
import com.fitlog.backend.service.WxLoginService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final WxLoginService wxLoginService;
    private final JwtService jwtService;

    public AuthController(WxLoginService wxLoginService, JwtService jwtService) {
        this.wxLoginService = wxLoginService;
        this.jwtService = jwtService;
    }

    @PostMapping("/wx-login")
    public WxLoginResponse wxLogin(@Valid @RequestBody WxLoginRequest request) {
        String openid = wxLoginService.exchange(request.getCode());
        return new WxLoginResponse(jwtService.create(openid), jwtService.expiresSeconds());
    }
}
