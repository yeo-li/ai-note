package com.ainote.server.memo;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "memo_tombstones")
public class MemoTombstone {

    @Id
    @Column(name = "memo_id")
    private String memoId;

    @Column(name = "deleted_at", nullable = false)
    private Instant deletedAt;

    protected MemoTombstone() {}

    public MemoTombstone(String memoId, Instant deletedAt) {
        this.memoId = memoId;
        this.deletedAt = deletedAt;
    }

    public String getMemoId() {
        return memoId;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }
}
