package com.fitlog.backend.model.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class PlanDraft {
    @NotBlank
    @Size(max = 120)
    private String name;
    @NotEmpty
    @Size(max = 30)
    @Valid
    private List<Item> items = new ArrayList<>();

    @Data
    public static class Item {
        @NotBlank @Size(max = 64) private String exerciseId;
        @NotBlank @Size(max = 64) private String exerciseName;
        private Integer targetSets;
        private Integer targetReps;
        private Double targetWeight;
    }
}
