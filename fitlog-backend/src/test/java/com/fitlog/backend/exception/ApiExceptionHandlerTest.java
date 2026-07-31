package com.fitlog.backend.exception;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ApiExceptionHandlerTest {
    @Test
    void unreadableRequestWritesJsonWithoutContentNegotiation() throws Exception {
        ApiExceptionHandler handler = new ApiExceptionHandler(new ObjectMapper());
        HttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        response.setHeader("Accept", "text/event-stream");

        handler.unreadable(new HttpMessageNotReadableException("invalid body"), request, response);

        assertEquals(400, response.getStatus());
        assertEquals("application/json;charset=UTF-8", response.getContentType());
        assertTrue(response.getContentAsString().contains("\"code\":\"INVALID_JSON\""));
    }
}
