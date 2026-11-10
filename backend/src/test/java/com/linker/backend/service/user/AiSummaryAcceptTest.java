package com.linker.backend.service.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.integration.ai.LlmException;

import org.junit.jupiter.api.Test;

/** What the model's summary must look like before it is stored (bug 2026-11-11: reasoning saved as summary). */
class AiSummaryAcceptTest {

	private static final int MAX = PlanLimits.AI_SUMMARY_TEXT_MAX_CHARS;

	@Test
	void shortParagraphIsStoredWithWhitespaceTidied() {
		assertThat(AiSummaryService.acceptSummary("  배포 일정을 이야기했어요.\n금요일에 배포하기로 했어요.  "))
				.isEqualTo("배포 일정을 이야기했어요. 금요일에 배포하기로 했어요.");
	}

	@Test
	void reasoningCapturedOnTheDemoServerFails() {
		String leaked = """
				채팅 기록을 요약해 보자. 먼저, 채팅 기록을 분석해 보고, 주요 내용을 파악해야 한다. \
				채팅 기록은 [1]부터 [22]까지의 메시지로 구성되어 있다.

				1. Avcnnw는 'Oner ~', 'T1 Down!' 등과 같은 게임 관련 용어를 사용하고 있다.
				2. 장준영은 'ㅋㅋ', '상혁이형 우리형' 등으로 게임 관련 용어를 반복하고 있다.

				주요 내용을 요약하면,""";

		assertRejected(leaked);
	}

	@Test
	void numberedOrBulletedListsFailEvenWithoutReasoningWords() {
		assertRejected("1. 배포 일정을 정했어요.\n2. 리뷰는 민수님이 맡았어요.");
		assertRejected("- 배포 일정을 정했어요.\n- 리뷰는 민수님이 맡았어요.");
		assertRejected("정한 것은 1. 금요일 배포 2. 민수님 리뷰예요.");
	}

	@Test
	void talkAboutTheTaskOrMessageNumbersFails() {
		assertRejected("대화를 정리해 보면 배포 일정을 정했어요.");
		assertRejected("[3]에서 민수님이 리뷰를 맡기로 했어요.");
	}

	@Test
	void versionNumbersAreNotMistakenForAList() {
		assertThat(AiSummaryService.acceptSummary("Next.js 16.1로 올리기로 했어요. 리뷰는 1.5일 안에 끝내요."))
				.isEqualTo("Next.js 16.1로 올리기로 했어요. 리뷰는 1.5일 안에 끝내요.");
	}

	@Test
	void slightlyLongReplyKeepsWholeSentencesWithinTheLimit() {
		String sentence = "배포 일정을 금요일로 정하고 리뷰 담당을 나눴어요. ";
		String reply = sentence.repeat(MAX / sentence.length() + 2).strip();

		String stored = AiSummaryService.acceptSummary(reply);

		assertThat(reply.length()).isGreaterThan(MAX).isLessThanOrEqualTo(AiSummaryService.SUMMARY_REJECT_OVER_CHARS);
		assertThat(stored.length()).isLessThanOrEqualTo(MAX);
		assertThat(stored).endsWith("나눴어요.");
		assertThat(reply).startsWith(stored);
	}

	@Test
	void farTooLongReplyFailsInsteadOfBeingCut() {
		assertRejected("가".repeat(AiSummaryService.SUMMARY_REJECT_OVER_CHARS) + "요.");
	}

	@Test
	void longReplyWithNoSentenceEndInsideTheLimitFails() {
		assertRejected("가".repeat(MAX + 10) + "요.");
	}

	@Test
	void blankReplyFails() {
		assertRejected("   ");
	}

	private static void assertRejected(String reply) {
		assertThatThrownBy(() -> AiSummaryService.acceptSummary(reply)).isInstanceOf(LlmException.class);
	}
}
