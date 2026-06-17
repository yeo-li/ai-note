package com.ainote.server.service;

import com.ainote.server.domain.Memo;
import com.ainote.server.domain.MemoCategories;
import com.ainote.server.domain.MemoStickyColor;
import com.ainote.server.domain.MemoTombstone;
import com.ainote.server.dto.MemoCreateRequest;
import com.ainote.server.dto.MemoDto;
import com.ainote.server.dto.MemoTombstoneDto;
import com.ainote.server.dto.MemoUpsertRequest;
import com.ainote.server.repository.MemoRepository;
import com.ainote.server.repository.MemoTombstoneRepository;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class MemoService {

    private final MemoRepository memoRepository;
    private final MemoTombstoneRepository tombstoneRepository;

    public MemoService(MemoRepository memoRepository, MemoTombstoneRepository tombstoneRepository) {
        this.memoRepository = memoRepository;
        this.tombstoneRepository = tombstoneRepository;
    }

    public List<MemoDto> listMemos() {
        return memoRepository.findAll().stream().map(MemoDto::from).toList();
    }

    public Optional<MemoDto> getMemo(String memoId) {
        return memoRepository.findById(memoId).map(MemoDto::from);
    }

    public MemoDto createMemo(MemoCreateRequest input) {
        Instant now = Instant.now();

        Memo memo = new Memo(
                UUID.randomUUID().toString(),
                input.title() != null ? input.title() : "",
                input.body() != null ? input.body() : "",
                false,
                MemoCategories.normalize(input.category()),
                MemoStickyColor.normalize(input.color()),
                now,
                now);

        return MemoDto.from(memoRepository.save(memo));
    }

    public Optional<MemoDto> updateMemo(String memoId, Map<String, Object> patch) {
        return memoRepository.findById(memoId).map(memo -> {
            if (patch.containsKey("title")) {
                memo.setTitle(asString(patch.get("title")));
            }

            if (patch.containsKey("body")) {
                memo.setBody(asString(patch.get("body")));
            }

            if (patch.containsKey("favorite") && patch.get("favorite") instanceof Boolean favorite) {
                memo.setFavorite(favorite);
            }

            if (patch.containsKey("category")) {
                memo.setCategory(MemoCategories.normalize(asString(patch.get("category"))));
            }

            if (patch.containsKey("color")) {
                memo.setColor(MemoStickyColor.normalize(asString(patch.get("color"))));
            }

            memo.setUpdatedAt(Instant.now());

            return MemoDto.from(memoRepository.save(memo));
        });
    }

    /**
     * 클라이언트(데스크톱)의 오프라인 변경 사항을 동기화하기 위한 upsert.
     * Last-Write-Wins: 들어온 updatedAt이 서버에 저장된 값보다 늦은 경우에만 덮어쓴다.
     */
    public MemoDto upsertMemo(String memoId, MemoUpsertRequest input) {
        Instant now = Instant.now();
        Instant incomingUpdatedAt = input.updatedAt() != null ? input.updatedAt() : now;

        return memoRepository.findById(memoId)
                .map(memo -> {
                    if (memo.getUpdatedAt() != null && !incomingUpdatedAt.isAfter(memo.getUpdatedAt())) {
                        return MemoDto.from(memo);
                    }

                    memo.setTitle(input.title() != null ? input.title() : "");
                    memo.setBody(input.body() != null ? input.body() : "");
                    memo.setFavorite(Boolean.TRUE.equals(input.favorite()));
                    memo.setCategory(MemoCategories.normalize(input.category()));
                    memo.setColor(MemoStickyColor.normalize(input.color()));
                    memo.setUpdatedAt(incomingUpdatedAt);

                    return MemoDto.from(memoRepository.save(memo));
                })
                .orElseGet(() -> {
                    Instant createdAt = input.createdAt() != null ? input.createdAt() : incomingUpdatedAt;

                    Memo memo = new Memo(
                            memoId,
                            input.title() != null ? input.title() : "",
                            input.body() != null ? input.body() : "",
                            Boolean.TRUE.equals(input.favorite()),
                            MemoCategories.normalize(input.category()),
                            MemoStickyColor.normalize(input.color()),
                            createdAt,
                            incomingUpdatedAt);

                    return MemoDto.from(memoRepository.save(memo));
                });
    }

    public boolean deleteMemo(String memoId) {
        if (!memoRepository.existsById(memoId)) {
            return false;
        }

        Instant now = Instant.now();
        memoRepository.deleteById(memoId);
        tombstoneRepository.save(new MemoTombstone(memoId, now));
        return true;
    }

    public List<MemoTombstoneDto> listDeletions(Instant since) {
        List<MemoTombstone> tombstones = since != null
                ? tombstoneRepository.findByDeletedAtAfter(since)
                : tombstoneRepository.findAll();
        return tombstones.stream().map(MemoTombstoneDto::from).toList();
    }

    private static String asString(Object value) {
        return value instanceof String stringValue ? stringValue : null;
    }
}
