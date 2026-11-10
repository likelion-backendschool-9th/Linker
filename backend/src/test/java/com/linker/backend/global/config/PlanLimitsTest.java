package com.linker.backend.global.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class PlanLimitsTest {

	@Test
	void flexMonthlyAmountUsesBaseThroughSixSeats() {
		assertThat(PlanLimits.flexMonthlyAmount(1)).isEqualTo(7_900);
		assertThat(PlanLimits.flexMonthlyAmount(6)).isEqualTo(7_900);
	}

	@Test
	void flexMonthlyAmountAddsExtraFromSeventh() {
		assertThat(PlanLimits.flexMonthlyAmount(7)).isEqualTo(7_900 + 1_900);
		assertThat(PlanLimits.flexMonthlyAmount(8)).isEqualTo(7_900 + 3_800);
	}

	@Test
	void flexMonthlyAmountRejectsInvalidSeats() {
		assertThatThrownBy(() -> PlanLimits.flexMonthlyAmount(0))
				.isInstanceOf(IllegalArgumentException.class);
	}

	@Test
	void flexYearlyAmountIsTenMonthsForTheSameHeadcount() {
		assertThat(PlanLimits.flexYearlyAmount(6)).isEqualTo(79_000);
		assertThat(PlanLimits.flexYearlyAmount(7)).isEqualTo(79_000 + 19_000);
		assertThat(PlanLimits.flexYearlyAmount(8)).isEqualTo(PlanLimits.flexMonthlyAmount(8) * 10);
	}
}
