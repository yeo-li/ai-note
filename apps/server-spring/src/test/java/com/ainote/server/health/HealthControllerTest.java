package com.ainote.server.health;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.boot.test.context.SpringBootTest.WebEnvironment.RANDOM_PORT;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.ResponseEntity;

@SpringBootTest(webEnvironment = RANDOM_PORT)
class HealthControllerTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void getHealthReturnsServiceStatus() {
        ResponseEntity<HealthResponse> response = restTemplate.getForEntity("/health", HealthResponse.class);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isEqualTo(HealthResponse.ok());
    }
}
