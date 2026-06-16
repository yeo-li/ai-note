package com.ainote.server.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.servers.Server;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI openAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("AI Note API")
                        .description("AI Note 데스크톱 앱과 동기화하는 메모 관리 서버 API. " +
                                "Last-Write-Wins(LWW) 전략으로 오프라인 충돌을 해소하며, " +
                                "삭제된 메모는 tombstone으로 추적해 다중 기기 동기화를 지원합니다.")
                        .version("v0.1.0")
                        .contact(new Contact()
                                .name("yeo-li")
                                .email("parkseongyeol2110@gmail.com")))
                .servers(List.of(
                        new Server().url("http://127.0.0.1:4310").description("로컬 개발 서버")));
    }
}
