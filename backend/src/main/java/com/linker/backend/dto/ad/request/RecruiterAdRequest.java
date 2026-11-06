package com.linker.backend.dto.ad.request;

import java.time.LocalDate;

public record RecruiterAdRequest(String jobCategory, String title, String url, LocalDate closesOn) {
}
