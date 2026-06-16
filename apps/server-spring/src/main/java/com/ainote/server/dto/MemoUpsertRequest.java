package com.ainote.server.dto;

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
