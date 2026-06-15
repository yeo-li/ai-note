package com.ainote.server.memo.dto;

import java.time.Instant;

public record MemoUpsertRequest(
        String title,
        String body,
        Boolean favorite,
        String category,
        String color,
        Instant createdAt,
        Instant updatedAt) {
}
