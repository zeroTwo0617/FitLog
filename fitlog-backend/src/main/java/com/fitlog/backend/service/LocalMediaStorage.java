package com.fitlog.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.file.Path;
import java.nio.file.Paths;

@Service
public class LocalMediaStorage implements MediaStorage {
    private final Path root;
    private final String placeholder;

    public LocalMediaStorage(@Value("${fitlog.media.dir:./media}") String mediaDir,
                             @Value("${fitlog.media.placeholder:/media/placeholder/exercise-missing.png}") String placeholder) {
        this.root = Paths.get(mediaDir).toAbsolutePath().normalize();
        this.placeholder = placeholder.startsWith("/media/") ? placeholder.substring("/media/".length()) : placeholder;
    }

    @Override
    public Path resolve(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) return null;
        Path file = root.resolve(storageKey).normalize();
        return file.startsWith(root) ? file : null;
    }

    @Override
    public Path placeholder() { return resolve(placeholder); }
}
