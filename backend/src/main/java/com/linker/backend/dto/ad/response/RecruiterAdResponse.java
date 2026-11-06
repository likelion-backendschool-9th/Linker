package com.linker.backend.dto.ad.response;

import java.time.LocalDate;

public record RecruiterAdResponse(boolean subscribed, Ad ad) {

	public record Ad(long id, String status, String jobCategory, String title, String url, LocalDate closesOn) {
	}
}
