package com.linker.backend.global;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.PathItem;

import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.stereotype.Component;

/**
 * Springdoc infers 200 for every {@code ResponseEntity}. Drop that inference when the method
 * documents 201 or 204. A webhook that returns both 200 and 202 keeps 200.
 */
@Component
public class DocumentedSuccessStatusCustomizer implements OpenApiCustomizer {

	@Override
	public void customise(OpenAPI openApi) {
		if (openApi.getPaths() == null) {
			return;
		}
		for (PathItem item : openApi.getPaths().values()) {
			for (Operation operation : item.readOperations()) {
				if (operation.getResponses() == null) {
					continue;
				}
				if (operation.getResponses().containsKey("201") || operation.getResponses().containsKey("204")) {
					operation.getResponses().remove("200");
				}
			}
		}
	}
}
