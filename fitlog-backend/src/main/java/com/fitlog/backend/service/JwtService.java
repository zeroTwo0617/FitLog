package com.fitlog.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fitlog.backend.exception.AppException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;

@Service
public class JwtService {
    private static final String ALG = "HmacSHA256";
    private final byte[] secret;
    private final long expiresSeconds;
    private final ObjectMapper mapper;

    public JwtService(@Value("${fitlog.auth.jwt-secret}") String secret,
                      @Value("${fitlog.auth.expires-seconds:7200}") long expiresSeconds,
                      ObjectMapper mapper) {
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
        this.expiresSeconds = expiresSeconds;
        this.mapper = mapper;
    }

    public String create(String openid) {
        try {
            long now = Instant.now().getEpochSecond();
            String header = encode("{\"alg\":\"HS256\",\"typ\":\"JWT\"}");
            String payload = encode(mapper.writeValueAsString(java.util.Map.of(
                    "sub", openid, "iat", now, "exp", now + expiresSeconds)));
            return header + "." + payload + "." + sign(header + "." + payload);
        } catch (Exception e) {
            throw new IllegalStateException("cannot create jwt", e);
        }
    }

    public String subject(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 3 || !constantTime(sign(parts[0] + "." + parts[1]), parts[2])) {
                throw AppException.unauthorized("登录态无效");
            }
            JsonNode payload = mapper.readTree(new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8));
            if (!payload.hasNonNull("sub") || payload.path("exp").asLong(0) <= Instant.now().getEpochSecond()) {
                throw AppException.unauthorized("登录态已过期");
            }
            return payload.get("sub").asText();
        } catch (AppException ex) {
            throw ex;
        } catch (Exception e) {
            throw AppException.unauthorized("登录态无效");
        }
    }

    public long expiresSeconds() { return expiresSeconds; }

    private String encode(String text) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(text.getBytes(StandardCharsets.UTF_8));
    }

    private String sign(String value) throws Exception {
        Mac mac = Mac.getInstance(ALG);
        mac.init(new SecretKeySpec(secret, ALG));
        return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
    }

    private boolean constantTime(String expected, String actual) {
        return java.security.MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), actual.getBytes(StandardCharsets.UTF_8));
    }
}
