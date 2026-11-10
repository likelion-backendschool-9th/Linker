package com.linker.backend.integration.push;

import java.util.List;
import java.util.Set;

public interface PushGateway {

	Set<String> send(List<PushMessage> messages);
}
