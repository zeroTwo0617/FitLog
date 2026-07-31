package com.fitlog.backend.exception;

import com.fitlog.backend.model.dto.ApiError;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.http.converter.HttpMessageNotReadableException;

@RestControllerAdvice
public class ApiExceptionHandler {
    private final ObjectMapper objectMapper;

    public ApiExceptionHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @ExceptionHandler(AppException.class)
    public void app(AppException ex, HttpServletRequest request, HttpServletResponse response) throws IOException {
        write(response, ex.getStatus().value(), ApiError.of(ex.getCode(), ex.getMessage(), requestId(request)));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public void validation(MethodArgumentNotValidException ex, HttpServletRequest request, HttpServletResponse response)
            throws IOException {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .findFirst().map(e -> e.getField() + " is invalid").orElse("request is invalid");
        write(response, HttpStatus.BAD_REQUEST.value(), ApiError.of("VALIDATION_ERROR", message, requestId(request)));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public void unreadable(HttpMessageNotReadableException ex, HttpServletRequest request, HttpServletResponse response)
            throws IOException {
        write(response, HttpStatus.BAD_REQUEST.value(), ApiError.of("INVALID_JSON", "请求数据格式不正确", requestId(request)));
    }

    @ExceptionHandler(Exception.class)
    public void other(Exception ex, HttpServletRequest request, HttpServletResponse response) throws IOException {
        write(response, HttpStatus.INTERNAL_SERVER_ERROR.value(),
                ApiError.of("INTERNAL_ERROR", "服务暂时不可用", requestId(request)));
    }

    private void write(HttpServletResponse response, int status, ApiError error) throws IOException {
        if (response.isCommitted()) return;
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        objectMapper.writeValue(response.getWriter(), error);
    }

    private String requestId(HttpServletRequest request) {
        Object value = request.getAttribute("fitlog.requestId");
        return value == null ? "unknown" : value.toString();
    }
}
