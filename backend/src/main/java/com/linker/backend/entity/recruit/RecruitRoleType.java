package com.linker.backend.entity.recruit;

public enum RecruitRoleType {
	FRONTEND("프론트엔드"),
	BACKEND("백엔드"),
	FULLSTACK("풀스택"),
	MOBILE("앱 개발"),
	DESIGN("디자이너"),
	DATA_AI("데이터/AI"),
	DEVOPS("DevOps/인프라"),
	PM("기획"),
	ETC("기타");

	private final String label;

	RecruitRoleType(String label) {
		this.label = label;
	}

	public String label() {
		return label;
	}
}
