package com.linker.backend.integration.push;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class ExpoPushGatewayTest {
  @Test
  void sendsTheExistingLinkPathAsTheNativeTapDestinationWithoutMutatingMetadata() {
    var builder = RestClient.builder().baseUrl("https://exp.host/--/api/v2/push/send");
    var server = MockRestServiceServer.bindTo(builder).build();
    var gateway = new ExpoPushGateway();
    ReflectionTestUtils.setField(gateway, "client", builder.build());
    Map<String, Object> metadata = Map.of("notificationId", 17L);
    server.expect(requestTo("https://exp.host/--/api/v2/push/send"))
        .andExpect(content().json("""
            [{"to":"ExpoPushToken[test]","title":"팀 알림","body":"새 메시지",
              "data":{"notificationId":17,"path":"/chats/42"}}]
            """))
        .andRespond(withSuccess("{\"data\":[{\"status\":\"ok\"}]}", MediaType.APPLICATION_JSON));

    assertThat(gateway.send(List.of(new PushMessage("ExpoPushToken[test]", "팀 알림", "새 메시지",
        "/chats/42", metadata)))).containsExactly("ExpoPushToken[test]");
    assertThat(metadata).containsOnlyKeys("notificationId");
    server.verify();
  }

  @Test
  void absentDestinationsDoNotInventANavigationTarget() {
    var builder = RestClient.builder().baseUrl("https://exp.host/--/api/v2/push/send");
    var server = MockRestServiceServer.bindTo(builder).build();
    var gateway = new ExpoPushGateway();
    ReflectionTestUtils.setField(gateway, "client", builder.build());
    server.expect(requestTo("https://exp.host/--/api/v2/push/send"))
        .andExpect(content().json("""
            [{"to":"ExpoPushToken[test]","title":"알림","body":"내용"}]
            """))
        .andRespond(withSuccess("{\"data\":[{\"status\":\"ok\"}]}", MediaType.APPLICATION_JSON));
    gateway.send(List.of(new PushMessage("ExpoPushToken[test]", "알림", "내용", null, null)));
    server.verify();
  }
}
