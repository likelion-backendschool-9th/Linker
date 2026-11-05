package com.linker.backend.controller;

import java.time.Duration;
import java.util.List;

import com.linker.backend.dto.legal.response.LegalDocumentResponse;
import com.linker.backend.dto.legal.response.LegalDocumentSummaryResponse;
import com.linker.backend.service.PublicLegalService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/public")
public class PublicLegalController {

	private final PublicLegalService legal;

	public PublicLegalController(PublicLegalService legal) {
		this.legal = legal;
	}

	@GetMapping("/legal-documents")
	@Tag(name = "p03-legal")
	@Operation(operationId = "listLegalDocuments")
	public ResponseEntity<List<LegalDocumentSummaryResponse>> list() {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.maxAge(Duration.ofDays(1)).cachePublic())
				.body(legal.list());
	}

	@GetMapping("/legal-documents/{slug}")
	@Tag(name = "p03-legal")
	@Operation(operationId = "getLegalDocument")
	public ResponseEntity<LegalDocumentResponse> document(@PathVariable String slug) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.maxAge(Duration.ofDays(1)).cachePublic())
				.body(legal.document(slug));
	}
}
