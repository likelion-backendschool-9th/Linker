package com.linker.backend.service.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import javax.imageio.ImageIO;

import com.linker.backend.global.error.ApiException;

import org.junit.jupiter.api.Test;

class ImageInspectorTest {

	private final UploadService.ImageInspection inspector = new UploadService.ImageInspection();

	@Test
	void resizesALongPngAndStripsItByReencoding() throws Exception {
		BufferedImage image = new BufferedImage(3000, 10, BufferedImage.TYPE_INT_RGB);
		ByteArrayOutputStream output = new ByteArrayOutputStream();
		ImageIO.write(image, "png", output);

		UploadService.ImageInspection.ProcessedImage processed = inspector.inspect(output.toByteArray(), "image/png");

		assertThat(processed.contentType()).isEqualTo("image/png");
		assertThat(processed.width()).isEqualTo(2048);
		assertThat(processed.height()).isLessThan(10);
		assertThat(UploadService.ImageInspection.sniff(processed.bytes()))
				.isEqualTo(UploadService.ImageInspection.Kind.PNG);
	}

	@Test
	void reencodesJpegAndDropsAnExifApp1Segment() throws Exception {
		BufferedImage image = new BufferedImage(32, 16, BufferedImage.TYPE_INT_RGB);
		ByteArrayOutputStream output = new ByteArrayOutputStream();
		ImageIO.write(image, "jpeg", output);
		byte[] withExif = insertExifApp1(output.toByteArray());
		assertThat(containsExifApp1(withExif)).isTrue();

		UploadService.ImageInspection.ProcessedImage processed = inspector.inspect(withExif, "image/jpeg");

		assertThat(processed.contentType()).isEqualTo("image/jpeg");
		assertThat(UploadService.ImageInspection.sniff(processed.bytes()))
				.isEqualTo(UploadService.ImageInspection.Kind.JPEG);
		assertThat(containsExifApp1(processed.bytes())).isFalse();
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

	private static byte[] insertExifApp1(byte[] jpeg) {
		byte[] payload = "Exif\0\0GPS".getBytes(StandardCharsets.ISO_8859_1);
		int segmentLen = payload.length + 2;
		byte[] out = new byte[jpeg.length + 4 + payload.length];
		out[0] = (byte) 0xFF;
		out[1] = (byte) 0xD8;
		out[2] = (byte) 0xFF;
		out[3] = (byte) 0xE1;
		out[4] = (byte) ((segmentLen >> 8) & 0xFF);
		out[5] = (byte) (segmentLen & 0xFF);
		System.arraycopy(payload, 0, out, 6, payload.length);
		System.arraycopy(jpeg, 2, out, 6 + payload.length, jpeg.length - 2);
		return out;
	}

	private static boolean containsExifApp1(byte[] jpeg) {
		byte[] marker = "Exif".getBytes(StandardCharsets.ISO_8859_1);
		for (int i = 0; i < jpeg.length - marker.length; i++) {
			if (jpeg[i] == (byte) 0xFF && jpeg[i + 1] == (byte) 0xE1
					&& Arrays.equals(jpeg, i + 4, i + 4 + marker.length, marker, 0, marker.length)) {
				return true;
			}
		}
		return false;
	}
}
