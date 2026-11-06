package com.linker.backend;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.Test;

class FlywayMigrationVersionTest {

	private static final Pattern NAME = Pattern.compile("^V(\\d+)__.+\\.sql$");

	@Test
	void sourceMigrationVersionsAreUnique() throws IOException {
		Path directory = Path.of("src/main/resources/db/migration");
		assertThat(directory).isDirectory();
		List<String> versions = new ArrayList<>();
		List<String> names = new ArrayList<>();
		try (var files = Files.list(directory)) {
			files.map(path -> path.getFileName().toString()).filter(name -> name.endsWith(".sql")).sorted().forEach(name -> {
				Matcher matcher = NAME.matcher(name);
				assertThat(matcher.matches()).as(name).isTrue();
				versions.add(matcher.group(1));
				names.add(name);
			});
		}
		assertThat(versions).doesNotHaveDuplicates();
		assertThat(names).contains("V4__github_social_login.sql", "V10__chat_message_edited_at.sql")
				.doesNotContain("V4__chat_message_edited_at.sql");
	}
}
