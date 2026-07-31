package com.fitlog.backend.repository;

import com.fitlog.backend.model.entity.AgentSession;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface AgentSessionMapper {
    AgentSession selectByOpenid(@Param("openid") String openid);

    int insert(AgentSession session);

    // M5b 升级为 upsert（需给 openid 加唯一索引）
}
