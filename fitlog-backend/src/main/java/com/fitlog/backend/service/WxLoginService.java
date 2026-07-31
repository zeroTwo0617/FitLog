package com.fitlog.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fitlog.backend.exception.AppException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

@Service
public class WxLoginService {
    private final String appId;
    private final String appSecret;
    private final String loginUrl;
    private final String mockOpenid;
    private final ObjectMapper mapper;

    public WxLoginService(@Value("${fitlog.auth.wx-app-id:}") String appId,
                          @Value("${fitlog.auth.wx-app-secret:}") String appSecret,
                          @Value("${fitlog.auth.wx-login-url}") String loginUrl,
                          @Value("${fitlog.auth.mock-openid:}") String mockOpenid,
                          ObjectMapper mapper) {
        this.appId = appId;
        this.appSecret = appSecret;
        this.loginUrl = loginUrl;
        this.mockOpenid = mockOpenid;
        this.mapper = mapper;
    }

    public String exchange(String code) {
        if (mockOpenid != null && !mockOpenid.isBlank()) return mockOpenid.trim();
        if (appId.isBlank() || appSecret.isBlank()) {
            throw AppException.unauthorized("微信登录服务未配置");
        }
        try {
            String query = "appid=" + enc(appId) + "&secret=" + enc(appSecret) + "&js_code=" + enc(code) + "&grant_type=authorization_code";
            HttpRequest request = HttpRequest.newBuilder(URI.create(loginUrl + "?" + query))
                    .timeout(Duration.ofSeconds(8)).GET().build();
            HttpResponse<String> response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
            JsonNode body = mapper.readTree(response.body());
            if (body.hasNonNull("openid")) return body.get("openid").asText();
            throw AppException.unauthorized("微信登录凭证无效");
        } catch (AppException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new AppException("WX_LOGIN_FAILED", "微信登录暂时不可用", org.springframework.http.HttpStatus.BAD_GATEWAY);
        }
    }

    private String enc(String value) { return URLEncoder.encode(value, StandardCharsets.UTF_8); }
}
