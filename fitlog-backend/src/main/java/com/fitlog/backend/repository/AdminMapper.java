package com.fitlog.backend.repository;

import com.fitlog.backend.model.entity.AgentSession;
import com.fitlog.backend.model.entity.ExerciseMedia;
import com.fitlog.backend.model.entity.KbChunk;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface AdminMapper {

    // ---------- exercises_media ----------
    List<ExerciseMedia> pageExercisesMedia(@Param("keyword") String keyword,
                                           @Param("limit") int limit,
                                           @Param("offset") int offset);

    long countExercisesMedia(@Param("keyword") String keyword);

    // ---------- kb_chunks ----------
    List<KbChunk> pageKbChunks(@Param("keyword") String keyword,
                               @Param("source") String source,
                               @Param("limit") int limit,
                               @Param("offset") int offset);

    long countKbChunks(@Param("keyword") String keyword, @Param("source") String source);

    // ---------- agent_sessions ----------
    List<AgentSession> pageAgentSessions(@Param("keyword") String keyword,
                                         @Param("openid") String openid,
                                         @Param("limit") int limit,
                                         @Param("offset") int offset);

    long countAgentSessions(@Param("keyword") String keyword, @Param("openid") String openid);
}
