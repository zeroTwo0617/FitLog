package com.fitlog.backend.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * 托管本地图片资源：GET /media/** -> 读取 fitlog.media.dir 下的文件。
 * 占位图也走这条路由（/media/placeholder/exercise-missing.png）。
 * 生产环境可把 media.dir 指向对象存储挂载目录，或替换为 COS 直链。
 */
@RestController
@RequestMapping("/media")
public class MediaFileController {

    private final String mediaDir;

    public MediaFileController(@Value("${fitlog.media.dir:./media}") String mediaDir) {
        this.mediaDir = mediaDir;
    }

    @GetMapping("/**")
    public ResponseEntity<?> serve(HttpServletRequest request) {
        String uri = request.getRequestURI();
        int idx = uri.indexOf("/media/");
        if (idx < 0) return ResponseEntity.notFound().build();
        String sub = uri.substring(idx + "/media/".length());
        if (sub.isEmpty()) return ResponseEntity.notFound().build();

        Path root = Paths.get(mediaDir).toAbsolutePath().normalize();
        Path file = root.resolve(sub).normalize();
        // 防目录穿越
        if (!file.startsWith(root)) return ResponseEntity.status(403).build();
        if (!Files.exists(file) || Files.isDirectory(file)) return ResponseEntity.notFound().build();

        try {
            String ct = Files.probeContentType(file);
            MediaType mt = ct != null ? MediaType.parseMediaType(ct) : MediaType.APPLICATION_OCTET_STREAM;
            // 用 FileSystemResource：Spring 会自动带 Content-Length 并写出全部字节；
            // 之前用 InputStreamResource + Files.newInputStream 会写出空 body（chunked 0 字节）。
            // no-store：避免浏览器缓存到“空响应/404”导致刷新后图片仍裂。
            return ResponseEntity.ok()
                    .contentType(mt)
                    .header("Cache-Control", "no-store")
                    .body(new FileSystemResource(file.toFile()));
        } catch (IOException e) {
            return ResponseEntity.status(500).build();
        }
    }
}
