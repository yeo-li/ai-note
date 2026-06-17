package com.ainote.server.dto;

import java.util.List;

public record ListDeletionsResponse(List<MemoTombstoneDto> deletions) {
}
