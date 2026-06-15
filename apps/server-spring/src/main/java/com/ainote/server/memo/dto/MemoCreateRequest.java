package com.ainote.server.memo.dto;

public record MemoCreateRequest(String title, String body, String category, String color) {
}
