package com.ainote.server.dto;

import com.ainote.server.domain.Memo;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

@Schema(description = "메모")
public record MemoDto(
        @Schema(description = "메모 ID (UUID)", example = "550e8400-e29b-41d4-a716-446655440000") String id,
        @Schema(description = "제목", example = "오늘 할 일") String title,
        @Schema(description = "본문", example = "장보기, 운동") String body,
        @Schema(description = "즐겨찾기 여부", example = "false") boolean favorite,
        @Schema(description = "카테고리", example = "idea") String category,
        @Schema(description = "색상", example = "yellow") String color,
        @Schema(description = "생성 시각 (ISO-8601)", example = "2026-01-01T00:00:00Z") Instant createdAt,
        @Schema(description = "마지막 수정 시각 (ISO-8601)", example = "2026-01-02T12:00:00Z") Instant updatedAt) {

    public static MemoDto from(Memo memo) {
        return new MemoDto(
                memo.getId(),
                memo.getTitle(),
                memo.getBody(),
                memo.isFavorite(),
                memo.getCategory(),
                memo.getColor(),
                memo.getCreatedAt(),
                memo.getUpdatedAt());
    }
}
