package com.ainote.server.memo;

public final class MemoCategories {

    private static final int MAX_LENGTH = 32;

    private MemoCategories() {
    }

    public static String normalize(String value) {
        if (value == null) {
            return null;
        }

        String normalized = value.trim().replaceAll("\\s+", " ");

        if (normalized.isEmpty()) {
            return null;
        }

        return normalized.length() > MAX_LENGTH ? normalized.substring(0, MAX_LENGTH) : normalized;
    }
}
