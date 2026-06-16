package com.ainote.server.repository;

import com.ainote.server.domain.MemoTombstone;
import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MemoTombstoneRepository extends JpaRepository<MemoTombstone, String> {

    List<MemoTombstone> findByDeletedAtAfter(Instant since);
}
