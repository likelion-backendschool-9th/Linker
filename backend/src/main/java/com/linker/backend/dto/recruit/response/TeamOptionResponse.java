package com.linker.backend.dto.recruit.response;

/**
 * A team the recruit editor (20) can link. {@code flex}: the team has the Flex benefit now, so its
 * headcount isn't capped at the free team size (Policy POL-R-1).
 */
public record TeamOptionResponse(long id, String name, boolean flex) {

	/** JPQL constructor expression in {@code TeamMemberRepository}; Flex is filled in by the service. */
	public TeamOptionResponse(long id, String name) {
		this(id, name, false);
	}
}
