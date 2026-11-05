package com.linker.backend.global.realtime;

import java.util.Arrays;

import com.linker.backend.global.config.LinkerProperties;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

	private final StompHandshakeInterceptor handshakeInterceptor;
	private final StompChannelInterceptor channelInterceptor;
	private final ChatDeliveryGuard deliveryGuard;
	private final LinkerProperties properties;

	public WebSocketConfig(
			StompHandshakeInterceptor handshakeInterceptor,
			StompChannelInterceptor channelInterceptor,
			ChatDeliveryGuard deliveryGuard,
			LinkerProperties properties
	) {
		this.handshakeInterceptor = handshakeInterceptor;
		this.channelInterceptor = channelInterceptor;
		this.deliveryGuard = deliveryGuard;
		this.properties = properties;
	}

	@Override
	public void registerStompEndpoints(StompEndpointRegistry registry) {
		registry.addEndpoint("/ws")
				.setAllowedOriginPatterns(allowedOriginPatterns())
				.addInterceptors(handshakeInterceptor);
	}

	@Override
	public void configureMessageBroker(MessageBrokerRegistry registry) {
		registry.setApplicationDestinationPrefixes("/app");
		registry.enableSimpleBroker("/topic", "/queue");
		registry.setUserDestinationPrefix("/user");
	}

	@Override
	public void configureClientInboundChannel(ChannelRegistration registration) {
		registration.interceptors(channelInterceptor);
	}

	@Override
	public void configureClientOutboundChannel(ChannelRegistration registration) {
		registration.interceptors(deliveryGuard);
	}

	private String[] allowedOriginPatterns() {
		String configured = properties.security().allowedOrigins();
		if (configured == null || configured.isBlank()) {
			return new String[] {"*"};
		}
		String[] origins = Arrays.stream(configured.split(","))
				.map(String::trim)
				.filter(value -> !value.isEmpty())
				.toArray(String[]::new);
		return origins.length == 0 ? new String[] {"*"} : origins;
	}
}
