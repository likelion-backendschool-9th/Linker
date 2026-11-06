package com.linker.backend.integration.mail;

import java.util.List;
import java.util.Properties;

import com.linker.backend.global.config.LinkerProperties;
import com.linker.backend.global.error.ApiException;

import jakarta.mail.Authenticator;
import jakarta.mail.Message;
import jakarta.mail.MessagingException;
import jakarta.mail.PasswordAuthentication;
import jakarta.mail.Session;
import jakarta.mail.Transport;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.springframework.stereotype.Component;

@Component
public class SmtpMailGateway implements MailGateway {

	private static final String UNAVAILABLE = "메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요";

	private final LinkerProperties properties;

	public SmtpMailGateway(LinkerProperties properties) {
		this.properties = properties;
	}

	@Override
	public boolean configured() {
		LinkerProperties.Mail mail = properties.mail();
		return mail != null && mail.host() != null && !mail.host().isBlank();
	}

	@Override
	public void requireConfigured() {
		if (!configured()) {
			throw new ApiException(503, "SERVICE_UNAVAILABLE", UNAVAILABLE);
		}
	}

	@Override
	public List<String> freeDomains() {
		LinkerProperties.Mail mail = properties.mail();
		if (mail == null || mail.freeDomains() == null) {
			return List.of();
		}
		return mail.freeDomains();
	}

	@Override
	public String publicBaseUrl() {
		LinkerProperties.Mail mail = properties.mail();
		String base = mail == null || mail.publicBaseUrl() == null ? "" : mail.publicBaseUrl().trim();
		while (base.endsWith("/")) {
			base = base.substring(0, base.length() - 1);
		}
		return base.isEmpty() ? "http://localhost:3000" : base;
	}

	@Override
	public void send(String to, String subject, String text) {
		LinkerProperties.Mail mail = properties.mail();
		if (!configured() || mail == null) {
			throw new ApiException(503, "SERVICE_UNAVAILABLE", UNAVAILABLE);
		}
		Properties props = new Properties();
		props.put("mail.smtp.host", mail.host().trim());
		props.put("mail.smtp.port", Integer.toString(mail.port()));
		props.put("mail.smtp.connectiontimeout", "5000");
		props.put("mail.smtp.timeout", "5000");
		props.put("mail.smtp.writetimeout", "5000");
		boolean authenticate = mail.username() != null && !mail.username().isBlank();
		props.put("mail.smtp.auth", Boolean.toString(authenticate));
		Session session = authenticate
				? Session.getInstance(props, new Authenticator() {
					@Override
					protected PasswordAuthentication getPasswordAuthentication() {
						return new PasswordAuthentication(mail.username(), mail.password() == null ? "" : mail.password());
					}
				})
				: Session.getInstance(props);
		try {
			MimeMessage message = new MimeMessage(session);
			message.setFrom(InternetAddress.parse(mail.from(), false)[0]);
			message.setRecipients(Message.RecipientType.TO, InternetAddress.parse(to, false));
			message.setSubject(subject, "UTF-8");
			message.setText(text, "UTF-8");
			Transport.send(message);
		}
		catch (MessagingException | RuntimeException exception) {
			throw new ApiException(503, "SERVICE_UNAVAILABLE", UNAVAILABLE);
		}
	}
}
