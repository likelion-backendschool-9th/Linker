package com.linker.backend.service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.linker.backend.dto.legal.response.LegalDocumentResponse;
import com.linker.backend.dto.legal.response.LegalDocumentSummaryResponse;
import com.linker.backend.global.error.ApiException;

import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

/**
 * Paired entry for {@link com.linker.backend.controller.LegalController}.
 * Documents are classpath resources. There is no table.
 */
@Service
public class LegalService {

	private static final List<String> SLUGS = List.of("terms", "privacy", "community", "recruiter-terms");

	private final Map<String, LegalDocument> documents;

	public LegalService() {
		Map<String, LegalDocument> loaded = new LinkedHashMap<>();
		for (String slug : SLUGS) {
			loaded.put(slug, load(slug));
		}
		this.documents = Map.copyOf(loaded);
	}

	public List<LegalDocumentSummaryResponse> list() {
		return SLUGS.stream().map(slug -> documents.get(slug).summary()).toList();
	}

	public LegalDocumentResponse document(String slug) {
		LegalDocument found = documents.get(slug);
		if (found == null) {
			throw new ApiException(404, "NOT_FOUND", "삭제되었거나 볼 수 없는 콘텐츠예요");
		}
		return found.response();
	}

	/** Version stored with onboarding and recruiter consent. */
	public String termsVersion() {
		return documents.get("terms").version();
	}

	private static LegalDocument load(String slug) {
		ClassPathResource resource = new ClassPathResource("legal/" + slug + ".md");
		try {
			String raw = resource.getContentAsString(StandardCharsets.UTF_8).replace("\r\n", "\n");
			return parse(slug, raw);
		}
		catch (IOException exception) {
			throw new IllegalStateException("Missing legal document " + slug, exception);
		}
	}

	private static LegalDocument parse(String slug, String raw) {
		int split = raw.indexOf("\n\n");
		if (split < 0) {
			throw new IllegalStateException("Legal document " + slug + " has no body");
		}
		Map<String, String> header = new LinkedHashMap<>();
		for (String line : raw.substring(0, split).split("\n")) {
			int colon = line.indexOf(':');
			if (colon < 1) {
				throw new IllegalStateException("Legal document " + slug + " has a bad header");
			}
			header.put(line.substring(0, colon).trim(), line.substring(colon + 1).trim());
		}
		String title = required(slug, header, "title");
		String version = required(slug, header, "version");
		String effectiveDate = required(slug, header, "effectiveDate");
		String body = raw.substring(split + 2).strip();
		if (body.isEmpty()) {
			throw new IllegalStateException("Legal document " + slug + " has no body");
		}
		return new LegalDocument(slug, title, version, effectiveDate, body);
	}

	private static String required(String slug, Map<String, String> header, String key) {
		String value = header.get(key);
		if (value == null || value.isBlank()) {
			throw new IllegalStateException("Legal document " + slug + " is missing " + key);
		}
		return value;
	}

	private record LegalDocument(String slug, String title, String version, String effectiveDate, String body) {

		private LegalDocumentSummaryResponse summary() {
			return new LegalDocumentSummaryResponse(slug, title, version, effectiveDate);
		}

		private LegalDocumentResponse response() {
			return new LegalDocumentResponse(slug, title, version, effectiveDate, body);
		}
	}
}
