package com.ainote.server.dto;

import com.ainote.server.domain.MemoTombstone;
import java.time.Instant;

public record MemoTombstoneDto(String memoId, Instant deletedAt) {

    public static MemoTombstoneDto from(MemoTombstone tombstone) {
        return new MemoTombstoneDto(tombstone.getMemoId(), tombstone.getDeletedAt());
    }
}
