package com.linker.backend.repository.chat;

import java.util.List;

import com.linker.backend.entity.chat.ChatMessageImage;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChatMessageImageRepository extends JpaRepository<ChatMessageImage, Long> {

	@Query("""
			select i.file.id from ChatMessageImage i
			where i.message.id = :messageId
			order by i.sortOrder asc, i.id asc
			""")
	List<Long> findFileIds(@Param("messageId") long messageId);

	@Query("""
			select f.url from ChatMessageImage i
			join i.file f
			where i.message.id = :messageId
			  and f.url is not null
			order by i.sortOrder asc, i.id asc
			""")
	List<String> findUrls(@Param("messageId") long messageId);
}
