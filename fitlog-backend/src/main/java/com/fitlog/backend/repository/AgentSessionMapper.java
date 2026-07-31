package com.fitlog.backend.repository;

import com.fitlog.backend.model.entity.AgentSession;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface AgentSessionMapper {
    AgentSession selectByUserAndSession(@Param("openid") String openid, @Param("sessionId") String sessionId);

    int insert(AgentSession session);

    int updateMessages(@Param("id") Long id, @Param("messages") String messages);

    // M5b 升级为 upsert（需给 openid 加唯一索引）
}
