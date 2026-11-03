package com.linker.backend.service.sitemap;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

import com.linker.backend.dto.sitemap.SitemapItem;
import com.linker.backend.repository.account.UserRepository;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;

@Component
public class UserSitemapSource implements SitemapSource {

	private final UserRepository users;

	public UserSitemapSource(UserRepository users) {
		this.users = users;
	}

	@Override
	public SitemapKind kind() {
		return SitemapKind.USERS;
	}

	@Override
	public List<SitemapItem> page(int page, int size) {
		return users.findIndexable(PageRequest.of(page - 1, size, Sort.by("id").ascending())).stream()
				.map(user -> new SitemapItem(
						user.getId(),
						"/u/" + URLEncoder.encode(user.getUsername(), StandardCharsets.UTF_8).replace("+", "%20"),
						user.getUpdatedAt()
				))
				.toList();
	}
}
