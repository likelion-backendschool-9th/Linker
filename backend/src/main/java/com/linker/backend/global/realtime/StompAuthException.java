package com.linker.backend.global.realtime;

import org.springframework.messaging.MessageDeliveryException;

public class StompAuthException extends MessageDeliveryException {

	public StompAuthException(String description) {
		super(description);
	}
}
