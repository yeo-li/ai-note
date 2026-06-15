package com.ainote.server.memo;

import com.ainote.server.memo.dto.MemoCreateRequest;
import com.ainote.server.memo.dto.MemoDto;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class MemoService {

    private final MemoRepository memoRepository;

    public MemoService(MemoRepository memoRepository) {
        this.memoRepository = memoRepository;
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

    public boolean deleteMemo(String memoId) {
        if (!memoRepository.existsById(memoId)) {
            return false;
        }

        memoRepository.deleteById(memoId);
        return true;
    }

    private static String asString(Object value) {
        return value instanceof String stringValue ? stringValue : null;
    }
}
