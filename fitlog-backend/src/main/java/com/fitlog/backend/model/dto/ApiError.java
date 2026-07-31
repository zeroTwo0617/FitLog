package com.fitlog.backend.model.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.Instant;

@Data
@AllArgsConstructor
public class ApiError {
    private boolean ok;
    private String code;
    private String message;
    private String requestId;
    private String timestamp;

    public static ApiError of(String code, String message, String requestId) {
        return new ApiError(false, code, message, requestId, Instant.now().toString());
    }
}
