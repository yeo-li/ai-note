package com.ainote.server.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.boot.test.context.SpringBootTest.WebEnvironment.RANDOM_PORT;

import com.ainote.server.dto.CreateMemoResponse;
import com.ainote.server.dto.DeleteMemoResponse;
import com.ainote.server.dto.GetMemoResponse;
import com.ainote.server.dto.ListDeletionsResponse;
import com.ainote.server.dto.ListMemosResponse;
import com.ainote.server.dto.MemoCreateRequest;
import com.ainote.server.dto.MemoUpsertRequest;
import com.ainote.server.dto.UpdateMemoResponse;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

@SpringBootTest(webEnvironment = RANDOM_PORT)
class MemoControllerTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void createListGetUpdateDeleteMemo() {
        MemoCreateRequest createRequest = new MemoCreateRequest("Title", "Body", "idea", "yellow");

        ResponseEntity<CreateMemoResponse> createResponse =
                restTemplate.postForEntity("/api/memos", createRequest, CreateMemoResponse.class);

        assertThat(createResponse.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        String memoId = createResponse.getBody().memo().id();
        assertThat(createResponse.getBody().memo().title()).isEqualTo("Title");
        assertThat(createResponse.getBody().memo().category()).isEqualTo("idea");
        assertThat(createResponse.getBody().memo().color()).isEqualTo("yellow");
        assertThat(createResponse.getBody().memo().favorite()).isFalse();

        ResponseEntity<ListMemosResponse> listResponse = restTemplate.getForEntity("/api/memos", ListMemosResponse.class);
        assertThat(listResponse.getBody().memos()).extracting("id").contains(memoId);

        ResponseEntity<GetMemoResponse> getResponse =
                restTemplate.getForEntity("/api/memos/" + memoId, GetMemoResponse.class);
        assertThat(getResponse.getBody().memo().id()).isEqualTo(memoId);

        ResponseEntity<UpdateMemoResponse> updateResponse = restTemplate.exchange(
                "/api/memos/" + memoId,
                HttpMethod.PATCH,
                new HttpEntity<>(Map.of("favorite", true, "title", "Updated")),
                UpdateMemoResponse.class);
        assertThat(updateResponse.getBody().memo().favorite()).isTrue();
        assertThat(updateResponse.getBody().memo().title()).isEqualTo("Updated");

        ResponseEntity<DeleteMemoResponse> deleteResponse = restTemplate.exchange(
                "/api/memos/" + memoId,
                HttpMethod.DELETE,
                null,
                DeleteMemoResponse.class);
        assertThat(deleteResponse.getBody().deleted()).isTrue();

        ResponseEntity<GetMemoResponse> afterDelete =
                restTemplate.getForEntity("/api/memos/" + memoId, GetMemoResponse.class);
        assertThat(afterDelete.getBody().memo()).isNull();
    }

    @Test
    void upsertCreatesMemoWhenMissing() {
        String memoId = UUID.randomUUID().toString();
        Instant updatedAt = Instant.now();
        MemoUpsertRequest request = new MemoUpsertRequest("Title", "Body", true, "idea", "pink", updatedAt, updatedAt);

        ResponseEntity<UpdateMemoResponse> response = restTemplate.exchange(
                "/api/memos/" + memoId,
                HttpMethod.PUT,
                new HttpEntity<>(request),
                UpdateMemoResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().memo().id()).isEqualTo(memoId);
        assertThat(response.getBody().memo().title()).isEqualTo("Title");
        assertThat(response.getBody().memo().favorite()).isTrue();
    }

    @Test
    void upsertIgnoresOlderUpdateThanServer() {
        ResponseEntity<CreateMemoResponse> createResponse =
                restTemplate.postForEntity("/api/memos", new MemoCreateRequest("Original", "Body", null, null), CreateMemoResponse.class);
        String memoId = createResponse.getBody().memo().id();
        Instant serverUpdatedAt = createResponse.getBody().memo().updatedAt();

        MemoUpsertRequest staleRequest = new MemoUpsertRequest(
                "Stale", "Stale body", false, null, null,
                serverUpdatedAt.minus(1, ChronoUnit.DAYS), serverUpdatedAt.minus(1, ChronoUnit.DAYS));

        ResponseEntity<UpdateMemoResponse> response = restTemplate.exchange(
                "/api/memos/" + memoId,
                HttpMethod.PUT,
                new HttpEntity<>(staleRequest),
                UpdateMemoResponse.class);

        assertThat(response.getBody().memo().title()).isEqualTo("Original");
    }

    @Test
    void getMemoReturnsNullWhenMissing() {
        ResponseEntity<GetMemoResponse> response =
                restTemplate.getForEntity("/api/memos/does-not-exist", GetMemoResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().memo()).isNull();
    }

    @Test
    void deleteRecordsTombstoneAndItAppearsInDeletions() {
        ResponseEntity<CreateMemoResponse> createResponse =
                restTemplate.postForEntity("/api/memos", new MemoCreateRequest("삭제 대상", "내용", null, null), CreateMemoResponse.class);
        String memoId = createResponse.getBody().memo().id();
        Instant before = Instant.now().minusSeconds(1);

        restTemplate.delete("/api/memos/" + memoId);

        ResponseEntity<ListDeletionsResponse> deletionsResponse =
                restTemplate.getForEntity("/api/memos/deletions?since=" + before.toString(), ListDeletionsResponse.class);

        assertThat(deletionsResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(deletionsResponse.getBody().deletions())
                .anyMatch(d -> d.memoId().equals(memoId));
    }
}
