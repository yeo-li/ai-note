package com.ainote.server.domain;

import java.util.Set;

public final class MemoStickyColor {

    public static final Set<String> VALUES = Set.of("yellow", "pink", "blue", "green", "purple");

    private MemoStickyColor() {
    }

    public static String normalize(String value) {
        return value != null && VALUES.contains(value) ? value : null;
    }
}
