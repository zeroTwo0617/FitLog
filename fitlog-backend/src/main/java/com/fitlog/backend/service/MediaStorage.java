package com.fitlog.backend.service;

import java.nio.file.Path;

public interface MediaStorage {
    Path resolve(String storageKey);
    Path placeholder();
}
