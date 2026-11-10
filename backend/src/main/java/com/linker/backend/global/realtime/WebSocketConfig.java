package com.linker.backend.global.realtime;

import java.util.Arrays;

import com.linker.backend.global.config.LinkerProperties;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

	/**
	 * Server heart-beat {send, expect}: the server pings every 10 s so an idle socket never reaches the
	 * proxy idle timeout (nginx proxy_read_timeout 300 s). It expects nothing from the client, because
	 * browsers throttle timers in background tabs and WebViews; a missed client ping must not close the
	 * session. The web client asks for 10 s both ways (stomp-client.ts) and drops a silent server itself.
	 */
	static final long[] HEARTBEAT_MS = {10_000, 0};

	private final StompHandshakeInterceptor handshakeInterceptor;
	private final StompChannelInterceptor channelInterceptor;
	private final ChatDeliveryGuard deliveryGuard;
	private final LinkerProperties properties;
	private final TaskScheduler brokerScheduler;

	public WebSocketConfig(
			StompHandshakeInterceptor handshakeInterceptor,
			StompChannelInterceptor channelInterceptor,
			ChatDeliveryGuard deliveryGuard,
			LinkerProperties properties,
			@Lazy @Qualifier("messageBrokerTaskScheduler") TaskScheduler brokerScheduler
	) {
		this.handshakeInterceptor = handshakeInterceptor;
		this.channelInterceptor = channelInterceptor;
		this.deliveryGuard = deliveryGuard;
		this.properties = properties;
		this.brokerScheduler = brokerScheduler;
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
		registry.enableSimpleBroker("/topic", "/queue")
				.setHeartbeatValue(HEARTBEAT_MS)
				.setTaskScheduler(brokerScheduler);
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
