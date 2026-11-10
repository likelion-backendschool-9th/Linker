package com.linker.backend.integration.ai;

/**
 * Technical LLM adapter. Business rules (quota, Flex, message filters, prompt wording, result parsing)
 * stay in the role services.
 */
public interface LlmClient {

	/**
	 * Blocks until the model finishes. {@code listener} hears the running output token count, so the
	 * first call also marks the end of prompt reading.
	 *
	 * @throws LlmException when the model cannot be reached or does not finish in time
	 */
	LlmResult chat(LlmRequest request, LlmProgressListener listener);

	String modelName();
}
