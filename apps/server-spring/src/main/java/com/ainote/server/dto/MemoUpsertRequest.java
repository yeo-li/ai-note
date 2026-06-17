package com.ainote.server.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

@Schema(description = "메모 업서트 요청 (오프라인 동기화용). updatedAt 기준 LWW로 충돌을 해소합니다.")
public record MemoUpsertRequest(
        @Schema(description = "메모 제목", example = "오늘 할 일") String title,
        @Schema(description = "메모 본문", example = "장보기, 운동") String body,
        @Schema(description = "즐겨찾기 여부", example = "false") Boolean favorite,
        @Schema(description = "카테고리 (최대 32자)", example = "idea") String category,
        @Schema(description = "색상", example = "yellow", allowableValues = {"yellow", "pink", "blue", "green", "purple"}) String color,
        @Schema(description = "메모 최초 생성 시각 (ISO-8601)", example = "2026-01-01T00:00:00Z") Instant createdAt,
        @Schema(description = "마지막 수정 시각 (ISO-8601). 서버의 값보다 늦을 때만 반영됩니다.", example = "2026-01-02T12:00:00Z") Instant updatedAt) {
}
