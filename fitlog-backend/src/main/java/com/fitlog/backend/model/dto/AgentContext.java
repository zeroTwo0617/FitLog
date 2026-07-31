package com.fitlog.backend.model.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class AgentContext {
    @Size(max = 500)
    private String goal;
    @Size(max = 10)
    private List<@Size(max = 120) String> constraints = new ArrayList<>();
    @Size(max = 30)
    private List<WorkoutContext> recentWorkouts = new ArrayList<>();
    @Size(max = 20)
    private List<PlanContext> existingPlans = new ArrayList<>();
    private BodyMetrics bodyMetrics;

    @Data
    public static class WorkoutContext {
        @Size(max = 64) private String date;
        @Size(max = 64) private String exerciseName;
        @Size(max = 64) private String exerciseId;
        private Integer sets;
        private Integer reps;
        private Double weight;
    }

    @Data
    public static class PlanContext {
        @Size(max = 120) private String name;
        @Size(max = 30) private List<PlanItemContext> items = new ArrayList<>();
    }

    @Data
    public static class PlanItemContext {
        @Size(max = 64) private String exerciseId;
        @Size(max = 64) private String exerciseName;
        private Integer targetSets;
        private Integer targetReps;
        private Double targetWeight;
    }

    @Data
    public static class BodyMetrics {
        private Double weight;
        private Double height;
        private Double bodyFat;
    }
}
