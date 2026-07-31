package com.fitlog.backend.model.dto;

import lombok.Data;

import java.util.List;

@Data
public class AdminResult<T> {
    private String table;
    private int page;
    private int size;
    private long total;
    private List<T> rows;
}
