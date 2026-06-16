package com.ainote.server.dto;

import com.ainote.server.domain.Memo;
import java.time.Instant;

public record MemoDto(
        String id,
        String title,
        String body,
        boolean favorite,
        String category,
        String color,
        Instant createdAt,
        Instant updatedAt) {

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
