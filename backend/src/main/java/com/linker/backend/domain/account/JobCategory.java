package com.linker.backend.domain.account;

/**
 * ERD section 5 keys. Korean labels match the web client's provisional list.
 * Policy still marks the published category list as tentative.
 */
public enum JobCategory {
	FRONTEND("프론트엔드"),
	BACKEND("백엔드"),
	FULLSTACK("풀스택"),
	MOBILE("모바일(iOS/Android)"),
	DATA_AI("데이터/AI"),
	DEVOPS("DevOps/인프라"),
	GAME("게임"),
	EMBEDDED("임베디드"),
	SECURITY("보안"),
	QA("QA");

	private final String label;

	JobCategory(String label) {
		this.label = label;
	}

	public String label() {
		return label;
	}
}
