package com.fitlog.backend.model.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class WxLoginResponse {
    private String token;
    private long expiresIn;
}
