package com.fitlog.backend.repository;

import com.fitlog.backend.model.entity.ExerciseMedia;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface ExerciseMediaMapper {
    ExerciseMedia selectByExerciseId(@Param("exerciseId") String exerciseId);

    List<ExerciseMedia> selectByIds(@Param("ids") List<String> ids);

    List<ExerciseMedia> selectAll();

    /** 幂等写入：主键冲突则忽略（用于 MediaBootstrap 从磁盘种子） */
    int insertIgnore(ExerciseMedia media);
}
