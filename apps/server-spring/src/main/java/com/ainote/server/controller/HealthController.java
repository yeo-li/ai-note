package com.ainote.server.controller;

import com.ainote.server.dto.HealthResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {

    @GetMapping("/health")
    public HealthResponse getHealth() {
        return HealthResponse.ok();
    }
}
