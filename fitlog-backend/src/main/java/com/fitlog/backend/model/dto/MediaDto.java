package com.fitlog.backend.model.dto;

import lombok.Data;

@Data
public class MediaDto {
    private String exerciseId;
    private String mediaType;
    private String url;
    private String storageKey;
    private Integer width;
    private Integer height;

    /** true=有真实图片；false=被开关关闭或无图，前端应显示 placeholder */
    private Boolean available;
    /** 占位图地址（开关关闭 / 无图时返回，前端展示“暂无图片”） */
    private String placeholder;
}
