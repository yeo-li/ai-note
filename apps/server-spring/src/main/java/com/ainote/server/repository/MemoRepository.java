package com.ainote.server.repository;

import com.ainote.server.domain.Memo;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MemoRepository extends JpaRepository<Memo, String> {
}
