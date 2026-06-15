package com.ainote.server.memo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.boot.test.context.SpringBootTest.WebEnvironment.RANDOM_PORT;

import com.ainote.server.memo.dto.CreateMemoResponse;
import com.ainote.server.memo.dto.DeleteMemoResponse;
import com.ainote.server.memo.dto.GetMemoResponse;
import com.ainote.server.memo.dto.ListMemosResponse;
import com.ainote.server.memo.dto.MemoCreateRequest;
import com.ainote.server.memo.dto.UpdateMemoResponse;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
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
                org.springframework.http.HttpMethod.PATCH,
                new org.springframework.http.HttpEntity<>(Map.of("favorite", true, "title", "Updated")),
                UpdateMemoResponse.class);
        assertThat(updateResponse.getBody().memo().favorite()).isTrue();
        assertThat(updateResponse.getBody().memo().title()).isEqualTo("Updated");

        ResponseEntity<DeleteMemoResponse> deleteResponse =
                restTemplate.exchange(
                        "/api/memos/" + memoId,
                        org.springframework.http.HttpMethod.DELETE,
                        null,
                        DeleteMemoResponse.class);
        assertThat(deleteResponse.getBody().deleted()).isTrue();

        ResponseEntity<GetMemoResponse> afterDelete =
                restTemplate.getForEntity("/api/memos/" + memoId, GetMemoResponse.class);
        assertThat(afterDelete.getBody().memo()).isNull();
    }

    @Test
    void getMemoReturnsNullWhenMissing() {
        ResponseEntity<GetMemoResponse> response =
                restTemplate.getForEntity("/api/memos/does-not-exist", GetMemoResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().memo()).isNull();
    }
}
