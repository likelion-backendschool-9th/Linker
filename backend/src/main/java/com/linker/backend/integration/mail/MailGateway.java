package com.linker.backend.integration.mail;

import java.util.List;

/** SMTP delivery for recruiter codes and reset links. A production relay is not selected. */
public interface MailGateway {

	boolean configured();

	void requireConfigured();

	List<String> freeDomains();

	String publicBaseUrl();

	void send(String to, String subject, String text);
}
