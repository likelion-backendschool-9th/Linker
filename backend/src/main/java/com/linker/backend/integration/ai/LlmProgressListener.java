package com.linker.backend.integration.ai;

/** Hears the running output token count while a reply streams. */
@FunctionalInterface
public interface LlmProgressListener {

	LlmProgressListener NONE = tokens -> {
	};

	void outputTokens(int count);
}
