package com.linker.backend.service.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import javax.imageio.ImageIO;

import com.linker.backend.global.error.ApiException;

import org.junit.jupiter.api.Test;

class ImageInspectorTest {

	private final UserUploadService.ImageInspection inspector = new UserUploadService.ImageInspection();

	@Test
	void resizesALongPngAndStripsItByReencoding() throws Exception {
		BufferedImage image = new BufferedImage(3000, 10, BufferedImage.TYPE_INT_RGB);
		ByteArrayOutputStream output = new ByteArrayOutputStream();
		ImageIO.write(image, "png", output);

		UserUploadService.ImageInspection.ProcessedImage processed = inspector.inspect(output.toByteArray(), "image/png");

		assertThat(processed.contentType()).isEqualTo("image/png");
		assertThat(processed.width()).isEqualTo(2048);
		assertThat(processed.height()).isLessThan(10);
		assertThat(UserUploadService.ImageInspection.sniff(processed.bytes()))
				.isEqualTo(UserUploadService.ImageInspection.Kind.PNG);
	}

	@Test
	void rejectsATypeThatDoesNotMatchTheBytes() throws Exception {
		BufferedImage image = new BufferedImage(2, 2, BufferedImage.TYPE_INT_RGB);
		ByteArrayOutputStream output = new ByteArrayOutputStream();
		ImageIO.write(image, "png", output);

		assertThatThrownBy(() -> inspector.inspect(output.toByteArray(), "image/jpeg"))
				.isInstanceOf(ApiException.class)
				.extracting("code")
				.isEqualTo("VALIDATION_ERROR");
	}
}
