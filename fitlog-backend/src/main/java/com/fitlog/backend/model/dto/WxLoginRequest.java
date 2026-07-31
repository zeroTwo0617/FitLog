package com.fitlog.backend.model.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class WxLoginRequest {
    @NotBlank
    @Size(max = 256)
    private String code;
}
