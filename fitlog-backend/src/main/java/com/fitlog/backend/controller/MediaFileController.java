package com.fitlog.backend.controller;

import com.fitlog.backend.service.MediaStorage;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.core.io.FileSystemResource;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

@RestController
@RequestMapping("/media")
public class MediaFileController {
    private final MediaStorage storage;

    public MediaFileController(MediaStorage storage) { this.storage = storage; }

    @GetMapping("/**")
    public ResponseEntity<?> serve(HttpServletRequest request) {
        String uri = request.getRequestURI();
        int idx = uri.indexOf("/media/");
        if (idx < 0) return ResponseEntity.notFound().build();
        String sub = uri.substring(idx + "/media/".length());
        if (sub.isBlank()) return ResponseEntity.notFound().build();
        Path file = storage.resolve(sub);
        if (file == null) return ResponseEntity.status(403).build();
        if (!Files.isRegularFile(file)) file = storage.placeholder();
        if (file == null || !Files.isRegularFile(file)) return ResponseEntity.notFound().build();
        try {
            String contentType = Files.probeContentType(file);
            MediaType type = contentType == null ? MediaType.APPLICATION_OCTET_STREAM : MediaType.parseMediaType(contentType);
            return ResponseEntity.ok().contentType(type).header("Cache-Control", "no-store")
                    .body(new FileSystemResource(file.toFile()));
        } catch (IOException | IllegalArgumentException ex) {
            return ResponseEntity.internalServerError().build();
        }
    }
}
