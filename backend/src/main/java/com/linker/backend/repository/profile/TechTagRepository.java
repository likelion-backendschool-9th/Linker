package com.linker.backend.repository.profile;

import java.util.List;

import com.linker.backend.entity.profile.TechTag;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TechTagRepository extends JpaRepository<TechTag, Long> {

	List<TechTag> findAllByOrderBySortOrderAscIdAsc();
}
