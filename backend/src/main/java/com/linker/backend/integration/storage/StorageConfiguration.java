package com.linker.backend.integration.storage;

import java.nio.file.Path;

import com.linker.backend.global.config.LinkerProperties;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class StorageConfiguration {

	@Bean
	@ConditionalOnProperty(name = "linker.storage.mode", havingValue = "local")
	LocalObjectStorage localObjectStorage(LinkerProperties properties) {
		String configured = properties.storage().localDir();
		Path root = configured == null || configured.isBlank()
				? Path.of(System.getProperty("java.io.tmpdir"), "linker-uploads")
				: Path.of(configured);
		return new LocalObjectStorage(root);
	}

	@Bean
	@ConditionalOnMissingBean(ObjectStorage.class)
	ObjectStorage unconfiguredObjectStorage() {
		return new UnconfiguredObjectStorage();
	}
}
