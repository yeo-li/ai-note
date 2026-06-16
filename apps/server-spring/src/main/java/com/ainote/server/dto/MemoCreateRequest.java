package com.ainote.server.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "메모 생성 요청")
public record MemoCreateRequest(
        @Schema(description = "메모 제목", example = "오늘 할 일") String title,
        @Schema(description = "메모 본문", example = "장보기, 운동") String body,
        @Schema(description = "카테고리 (최대 32자)", example = "idea") String category,
        @Schema(description = "색상", example = "yellow", allowableValues = {"yellow", "pink", "blue", "green", "purple"}) String color) {
}
