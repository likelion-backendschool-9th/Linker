import { screen } from '@testing-library/react';

import { renderWithProviders } from '@/test/render-with-providers';

import { AiSummarySheet } from './AiSummarySheet';
import { useOverlay } from '@/lib/navigation/use-overlay';

function OpenSheet() {
  const overlay = useOverlay('ai-summary');
  return (
    <AiSummarySheet
      overlay={overlay}
      result={{
        summaryId: 1,
        status: 'DONE',
        summary: '내일 저녁에 회의하기로 했어요.',
        messageCount: 42,
        usedToday: 3,
        limit: 10,
        disclaimer: 'AI가 만든 요약이라 틀릴 수 있어요',
      }}
    />
  );
}

it('shows the summary body and disclaimer', async () => {
  renderWithProviders(<OpenSheet />, { searchParams: '?overlay=ai-summary' });
  expect(await screen.findByText('내일 저녁에 회의하기로 했어요.')).toBeVisible();
  expect(screen.getByText('AI가 만든 요약이라 틀릴 수 있어요')).toBeVisible();
  expect(screen.getByText(/3\/10/)).toBeVisible();
});
