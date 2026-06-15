package com.ainote.server.memo.dto;

import com.ainote.server.memo.MemoTombstone;
import java.time.Instant;

public record MemoTombstoneDto(String memoId, Instant deletedAt) {

    public static MemoTombstoneDto from(MemoTombstone tombstone) {
        return new MemoTombstoneDto(tombstone.getMemoId(), tombstone.getDeletedAt());
    }
}
