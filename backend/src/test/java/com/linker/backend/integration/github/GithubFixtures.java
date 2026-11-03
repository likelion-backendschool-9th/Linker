package com.linker.backend.integration.github;

import java.nio.charset.StandardCharsets;
import java.io.IOException;
import java.util.Map;

import com.linker.backend.dto.issue.ProjectsRefreshContext;
import com.linker.backend.dto.issue.ProjectsRefreshContext.BoardStatus;
import org.springframework.core.io.ClassPathResource;

/** Synthetic public fixtures only; no captured team data or real credentials. */
public final class GithubFixtures {
	private GithubFixtures() { }
	public static String load(String name) {
		try { return new ClassPathResource("github/" + name + ".json").getContentAsString(StandardCharsets.UTF_8); }
		catch (IOException exception) { throw new AssertionError("Missing synthetic GitHub fixture", exception); }
	}
	public static ProjectsRefreshContext context() {
		return new ProjectsRefreshContext(1, 10, 100, 200, "R_10", "PVT_1", "STATUS", "START", "DUE",
				Map.of("blocked", BoardStatus.BLOCKED, "todo", BoardStatus.TODO, "done", BoardStatus.DONE));
	}
}
