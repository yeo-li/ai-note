package com.ainote.server.dto;

public record MemoCreateRequest(String title, String body, String category, String color) {
}
