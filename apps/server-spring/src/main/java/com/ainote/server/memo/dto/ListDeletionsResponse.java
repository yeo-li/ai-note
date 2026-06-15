package com.ainote.server.memo.dto;

import java.util.List;

public record ListDeletionsResponse(List<MemoTombstoneDto> deletions) {}
