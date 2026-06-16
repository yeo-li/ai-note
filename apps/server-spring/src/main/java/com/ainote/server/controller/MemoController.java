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

@RestController
@RequestMapping("/api/memos")
public class MemoController {

    private final MemoService memoService;

    public MemoController(MemoService memoService) {
        this.memoService = memoService;
    }

    @GetMapping
    public ListMemosResponse listMemos() {
        return new ListMemosResponse(memoService.listMemos());
    }

    @GetMapping("/deletions")
    public ListDeletionsResponse listDeletions(@RequestParam(required = false) Instant since) {
        return new ListDeletionsResponse(memoService.listDeletions(since));
    }

    @GetMapping("/{memoId}")
    public GetMemoResponse getMemo(@PathVariable String memoId) {
        return new GetMemoResponse(memoService.getMemo(memoId).orElse(null));
    }

    @PostMapping
    public ResponseEntity<CreateMemoResponse> createMemo(@RequestBody MemoCreateRequest input) {
        return ResponseEntity.status(HttpStatus.CREATED).body(new CreateMemoResponse(memoService.createMemo(input)));
    }

    @PutMapping("/{memoId}")
    public UpdateMemoResponse upsertMemo(@PathVariable String memoId, @RequestBody MemoUpsertRequest input) {
        return new UpdateMemoResponse(memoService.upsertMemo(memoId, input));
    }

    @PatchMapping("/{memoId}")
    public UpdateMemoResponse updateMemo(@PathVariable String memoId, @RequestBody Map<String, Object> patch) {
        return new UpdateMemoResponse(memoService.updateMemo(memoId, patch).orElse(null));
    }

    @DeleteMapping("/{memoId}")
    public DeleteMemoResponse deleteMemo(@PathVariable String memoId) {
        return new DeleteMemoResponse(memoService.deleteMemo(memoId), memoId);
    }
}
