package com.ainote.server.dto;

import com.ainote.server.domain.MemoTombstone;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

@Schema(description = "삭제된 메모의 tombstone")
public record MemoTombstoneDto(
        @Schema(description = "삭제된 메모 ID", example = "550e8400-e29b-41d4-a716-446655440000") String memoId,
        @Schema(description = "삭제된 시각 (ISO-8601)", example = "2026-01-03T09:00:00Z") Instant deletedAt) {

    public static MemoTombstoneDto from(MemoTombstone tombstone) {
        return new MemoTombstoneDto(tombstone.getMemoId(), tombstone.getDeletedAt());
    }
}
