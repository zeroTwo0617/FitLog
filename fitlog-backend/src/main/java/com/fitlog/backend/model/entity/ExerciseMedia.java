package com.fitlog.backend.model.entity;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ExerciseMedia {
    private String exerciseId;
    private String mediaType;
    private String storageKey;
    private String url;
    private Integer width;
    private Integer height;
    private LocalDateTime createdAt;

    /** 非 DB 字段：控制台预览用的同域相对地址 /media/<storageKey> */
    private String previewUrl;
}
