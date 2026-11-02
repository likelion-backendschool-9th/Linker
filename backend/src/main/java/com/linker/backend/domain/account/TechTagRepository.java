package com.linker.backend.domain.account;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TechTagRepository extends JpaRepository<TechTag, Long> {

	List<TechTag> findAllByOrderBySortOrderAscIdAsc();
}
