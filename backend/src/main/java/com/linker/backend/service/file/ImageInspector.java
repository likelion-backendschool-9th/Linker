package com.linker.backend.service.file;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Iterator;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;

import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;

import org.springframework.stereotype.Component;

@Component
public class ImageInspector {

	public ImageInspector() {
		ImageIO.setUseCache(false);
	}

	public ProcessedImage inspect(byte[] bytes, String declaredContentType) {
		Kind sniffed = sniff(bytes);
		Kind declared = kind(declaredContentType);
		if (sniffed == null || sniffed != declared) {
			throw new ApiException(400, "VALIDATION_ERROR", "JPG, PNG, WebP, GIF 사진만 올릴 수 있어요.");
		}
		if (sniffed == Kind.GIF) {
			Dimensions dimensions = dimensions(bytes);
			return new ProcessedImage(bytes, "image/gif", dimensions.width(), dimensions.height());
		}
		if (sniffed == Kind.WEBP) {
			Dimensions dimensions = dimensions(bytes);
			if (Math.max(dimensions.width(), dimensions.height()) <= PlanLimits.IMAGE_LONG_SIDE) {
				return new ProcessedImage(bytes, "image/webp", dimensions.width(), dimensions.height());
			}
			BufferedImage scaled = scale(read(bytes), PlanLimits.IMAGE_LONG_SIDE);
			byte[] encoded = write(scaled, "png", false);
			return new ProcessedImage(encoded, "image/png", scaled.getWidth(), scaled.getHeight());
		}
		BufferedImage image = read(bytes);
		boolean jpeg = sniffed == Kind.JPEG;
		BufferedImage scaled = scale(image, PlanLimits.IMAGE_LONG_SIDE);
		if (jpeg) {
			scaled = toRgb(scaled);
		}
		String format = jpeg ? "jpeg" : "png";
		String contentType = jpeg ? "image/jpeg" : "image/png";
		byte[] encoded = write(scaled, format, jpeg);
		return new ProcessedImage(encoded, contentType, scaled.getWidth(), scaled.getHeight());
	}

	private BufferedImage read(byte[] bytes) {
		Dimensions dimensions = dimensions(bytes);
		try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
			Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
			if (!readers.hasNext()) {
				throw badImage();
			}
			ImageReader reader = readers.next();
			try {
				reader.setInput(input, true, true);
				if (reader.getWidth(0) != dimensions.width() || reader.getHeight(0) != dimensions.height()) {
					throw badImage();
				}
				BufferedImage image = reader.read(0);
				if (image == null) {
					throw badImage();
				}
				return image;
			}
			finally {
				reader.dispose();
			}
		}
		catch (IOException exception) {
			throw badImage();
		}
	}

	private Dimensions dimensions(byte[] bytes) {
		try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
			Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
			if (!readers.hasNext()) {
				throw badImage();
			}
			ImageReader reader = readers.next();
			try {
				reader.setInput(input, true, true);
				int width = reader.getWidth(0);
				int height = reader.getHeight(0);
				if (width < 1 || height < 1 || width > PlanLimits.IMAGE_MAX_SOURCE_SIDE || height > PlanLimits.IMAGE_MAX_SOURCE_SIDE) {
					throw badImage();
				}
				return new Dimensions(width, height);
			}
			finally {
				reader.dispose();
			}
		}
		catch (IOException exception) {
			throw badImage();
		}
	}

	private BufferedImage scale(BufferedImage image, int longSide) {
		int width = image.getWidth();
		int height = image.getHeight();
		int max = Math.max(width, height);
		if (max <= longSide) {
			return image;
		}
		double ratio = (double) longSide / max;
		int targetWidth = Math.max(1, (int) Math.round(width * ratio));
		int targetHeight = Math.max(1, (int) Math.round(height * ratio));
		int type = image.getColorModel().hasAlpha() ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB;
		BufferedImage scaled = new BufferedImage(targetWidth, targetHeight, type);
		Graphics2D graphics = scaled.createGraphics();
		graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
		graphics.drawImage(image, 0, 0, targetWidth, targetHeight, null);
		graphics.dispose();
		return scaled;
	}

	private BufferedImage toRgb(BufferedImage image) {
		BufferedImage rgb = new BufferedImage(image.getWidth(), image.getHeight(), BufferedImage.TYPE_INT_RGB);
		Graphics2D graphics = rgb.createGraphics();
		graphics.setColor(Color.WHITE);
		graphics.fillRect(0, 0, image.getWidth(), image.getHeight());
		graphics.drawImage(image, 0, 0, null);
		graphics.dispose();
		return rgb;
	}

	private byte[] write(BufferedImage image, String format, boolean jpeg) {
		try {
			ByteArrayOutputStream output = new ByteArrayOutputStream();
			BufferedImage toWrite = jpeg ? toRgb(image) : image;
			if (!ImageIO.write(toWrite, format, output)) {
				throw badImage();
			}
			return output.toByteArray();
		}
		catch (IOException exception) {
			throw badImage();
		}
	}

	static Kind sniff(byte[] bytes) {
		if (bytes.length >= 3 && (bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xFF) == 0xD8 && (bytes[2] & 0xFF) == 0xFF) {
			return Kind.JPEG;
		}
		if (bytes.length >= 8
				&& (bytes[0] & 0xFF) == 0x89
				&& bytes[1] == 'P' && bytes[2] == 'N' && bytes[3] == 'G') {
			return Kind.PNG;
		}
		if (bytes.length >= 6 && bytes[0] == 'G' && bytes[1] == 'I' && bytes[2] == 'F') {
			return Kind.GIF;
		}
		if (bytes.length >= 12
				&& bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F'
				&& bytes[8] == 'W' && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P') {
			return Kind.WEBP;
		}
		return null;
	}

	private Kind kind(String contentType) {
		if (contentType == null) {
			return null;
		}
		return switch (contentType) {
			case "image/jpeg" -> Kind.JPEG;
			case "image/png" -> Kind.PNG;
			case "image/gif" -> Kind.GIF;
			case "image/webp" -> Kind.WEBP;
			default -> null;
		};
	}

	private ApiException badImage() {
		return new ApiException(400, "VALIDATION_ERROR", "이미지 파일을 확인할 수 없어요");
	}

	public record ProcessedImage(byte[] bytes, String contentType, int width, int height) {
	}

	private record Dimensions(int width, int height) {
	}

	enum Kind {
		JPEG,
		PNG,
		GIF,
		WEBP
	}
}
