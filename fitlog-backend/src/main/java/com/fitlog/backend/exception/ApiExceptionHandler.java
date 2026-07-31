package com.fitlog.backend.exception;

import com.fitlog.backend.model.dto.ApiError;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.util.ContentCachingRequestWrapper;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(AppException.class)
    public ResponseEntity<ApiError> app(AppException ex, HttpServletRequest request) {
        return ResponseEntity.status(ex.getStatus()).body(ApiError.of(ex.getCode(), ex.getMessage(), requestId(request)));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> validation(MethodArgumentNotValidException ex, HttpServletRequest request) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .findFirst().map(e -> e.getField() + " is invalid").orElse("request is invalid");
        return ResponseEntity.badRequest().body(ApiError.of("VALIDATION_ERROR", message, requestId(request)));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> other(Exception ex, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiError.of("INTERNAL_ERROR", "服务暂时不可用", requestId(request)));
    }

    private String requestId(HttpServletRequest request) {
        Object value = request.getAttribute("fitlog.requestId");
        return value == null ? "unknown" : value.toString();
    }
}
