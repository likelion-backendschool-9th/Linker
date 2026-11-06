package com.linker.backend.global.config;

import java.time.Clock;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@EnableScheduling
public class AppConfig {

	@Bean
	Clock clock() {
		return Clock.system(PlanLimits.APP_ZONE);
	}
}
