package com.linker.backend.integration.ai;

/** Technical LLM adapter. Business rules (quota, Flex, filters) stay in role services. */
public interface LlmClient {

	String summarizeChat(String prompt);

	String modelName();
}
