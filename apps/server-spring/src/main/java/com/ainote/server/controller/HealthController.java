package com.ainote.server.controller;

import com.ainote.server.dto.HealthResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "헬스체크", description = "서버 상태 확인 API")
@RestController
public class HealthController {

    @Operation(summary = "서버 상태 확인", description = "서버가 정상적으로 실행 중인지 확인합니다.")
    @GetMapping("/health")
    public HealthResponse getHealth() {
        return HealthResponse.ok();
    }
}
