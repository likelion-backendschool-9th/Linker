package com.linker.backend.repository.file;

import com.linker.backend.entity.file.UploadedFile;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UploadedFileRepository extends JpaRepository<UploadedFile, Long> {
}
