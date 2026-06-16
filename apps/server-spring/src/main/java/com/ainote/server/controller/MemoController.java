package com.ainote.server.controller;

import com.ainote.server.dto.CreateMemoResponse;
import com.ainote.server.dto.DeleteMemoResponse;
import com.ainote.server.dto.GetMemoResponse;
import com.ainote.server.dto.ListDeletionsResponse;
import com.ainote.server.dto.ListMemosResponse;
import com.ainote.server.dto.MemoCreateRequest;
import com.ainote.server.dto.MemoUpsertRequest;
import com.ainote.server.dto.UpdateMemoResponse;
import com.ainote.server.service.MemoService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Instant;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "메모", description = "메모 CRUD 및 오프라인 동기화 API")
@RestController
@RequestMapping("/api/memos")
public class MemoController {

    private final MemoService memoService;

    public MemoController(MemoService memoService) {
        this.memoService = memoService;
    }

    @Operation(summary = "메모 목록 조회", description = "저장된 모든 메모를 반환합니다.")
    @GetMapping
    public ListMemosResponse listMemos() {
        return new ListMemosResponse(memoService.listMemos());
    }

    @Operation(
            summary = "삭제된 메모 목록 조회",
            description = "서버에서 삭제된 메모의 tombstone 목록을 반환합니다. " +
                    "`since` 파라미터를 전달하면 해당 시각 이후에 삭제된 항목만 조회합니다. " +
                    "데스크톱 클라이언트가 풀 동기화 시 사용합니다.")
    @GetMapping("/deletions")
    public ListDeletionsResponse listDeletions(
            @Parameter(description = "이 시각 이후에 삭제된 항목만 조회 (ISO-8601, 예: 2026-01-01T00:00:00Z)")
            @RequestParam(required = false) Instant since) {
        return new ListDeletionsResponse(memoService.listDeletions(since));
    }

    @Operation(
            summary = "메모 단건 조회",
            description = "memoId에 해당하는 메모를 반환합니다. 존재하지 않으면 `memo: null`을 반환합니다.",
            responses = @ApiResponse(responseCode = "200", content = @Content(schema = @Schema(implementation = GetMemoResponse.class))))
    @GetMapping("/{memoId}")
    public GetMemoResponse getMemo(
            @Parameter(description = "메모 ID") @PathVariable String memoId) {
        return new GetMemoResponse(memoService.getMemo(memoId).orElse(null));
    }

    @Operation(
            summary = "메모 생성",
            description = "새 메모를 생성하고 서버가 UUID를 부여합니다.",
            responses = @ApiResponse(responseCode = "201", content = @Content(schema = @Schema(implementation = CreateMemoResponse.class))))
    @PostMapping
    public ResponseEntity<CreateMemoResponse> createMemo(@RequestBody MemoCreateRequest input) {
        return ResponseEntity.status(HttpStatus.CREATED).body(new CreateMemoResponse(memoService.createMemo(input)));
    }

    @Operation(
            summary = "메모 업서트 (오프라인 동기화용)",
            description = "클라이언트가 지정한 ID로 메모를 생성하거나 덮어씁니다. " +
                    "Last-Write-Wins: 요청의 `updatedAt`이 서버에 저장된 값보다 늦을 때만 반영됩니다. " +
                    "오프라인 상태에서 변경된 메모를 서버에 밀어 넣을 때 사용합니다.")
    @PutMapping("/{memoId}")
    public UpdateMemoResponse upsertMemo(
            @Parameter(description = "메모 ID") @PathVariable String memoId,
            @RequestBody MemoUpsertRequest input) {
        return new UpdateMemoResponse(memoService.upsertMemo(memoId, input));
    }

    @Operation(
            summary = "메모 부분 수정",
            description = "전달한 필드만 선택적으로 수정합니다. 전달하지 않은 필드는 변경되지 않습니다. " +
                    "수정 가능한 필드: `title`, `body`, `favorite`, `category`, `color`")
    @PatchMapping("/{memoId}")
    public UpdateMemoResponse updateMemo(
            @Parameter(description = "메모 ID") @PathVariable String memoId,
            @RequestBody Map<String, Object> patch) {
        return new UpdateMemoResponse(memoService.updateMemo(memoId, patch).orElse(null));
    }

    @Operation(
            summary = "메모 삭제",
            description = "메모를 삭제하고 tombstone을 기록합니다. " +
                    "tombstone은 `/api/memos/deletions`를 통해 다른 클라이언트가 동기화할 수 있습니다.")
    @DeleteMapping("/{memoId}")
    public DeleteMemoResponse deleteMemo(
            @Parameter(description = "메모 ID") @PathVariable String memoId) {
        return new DeleteMemoResponse(memoService.deleteMemo(memoId), memoId);
    }
}
