package com.ainote.server.health;

public record HealthResponse(String service, String status) {

    public static HealthResponse ok() {
        return new HealthResponse("ai-note-server", "ok");
    }
}
