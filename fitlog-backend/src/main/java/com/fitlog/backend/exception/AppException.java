package com.fitlog.backend.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public class AppException extends RuntimeException {
    private final String code;
    private final HttpStatus status;

    public AppException(String code, String message, HttpStatus status) {
        super(message);
        this.code = code;
        this.status = status;
    }

    public static AppException badRequest(String code, String message) {
        return new AppException(code, message, HttpStatus.BAD_REQUEST);
    }

    public static AppException unauthorized(String message) {
        return new AppException("UNAUTHORIZED", message, HttpStatus.UNAUTHORIZED);
    }

    public static AppException forbidden(String message) {
        return new AppException("FORBIDDEN", message, HttpStatus.FORBIDDEN);
    }
}
