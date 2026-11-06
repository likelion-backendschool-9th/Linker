package com.linker.backend.integration.github;

import java.time.LocalDate;

public record GithubContribution(LocalDate day, int count) {
}
