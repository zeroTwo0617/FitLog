package com.fitlog.backend.repository;

import com.fitlog.backend.model.entity.KbChunk;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface KbChunkMapper {
    List<KbChunk> selectAll();

    List<KbChunk> selectBySource(@Param("source") String source);

    int insert(KbChunk chunk);
}
