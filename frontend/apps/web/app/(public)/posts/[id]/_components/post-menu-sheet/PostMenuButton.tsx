'use client';

// Client boundary: the stack header's "더보기" and its dropdown (Figma 622:216)
import { EllipsisVertical } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';

import { usePostMenuButton } from './hook';
import styles from './PostMenuSheet.module.css';

/** Figma 622:347 ends at the 16px gutter; the header icon ends 8px from the edge (header inset) */
const MENU_ALIGN_OFFSET = 8;

/** Header action of 23 (Figma 285:227): 24px vertical dots, 24×24 hit like other header icons */
export function PostMenuButton({ postId }: { postId: string }) {
  const { post, isGuest, promptLogin, openReport, openEdit, openDelete } =
    usePostMenuButton(postId);

  const icon = (
    <>
      <EllipsisVertical aria-hidden className={styles.triggerIcon} />
      <span className="sr-only">게시물 더보기</span>
    </>
  );

  if (isGuest || !post) {
    return (
      <button type="button" className={styles.trigger} onClick={promptLogin}>
        {icon}
      </button>
    );
  }

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button type="button" className={styles.trigger}>
          {icon}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={styles.panel}
          side="bottom"
          align="end"
          alignOffset={MENU_ALIGN_OFFSET}
          sideOffset={4}
          collisionPadding={16}
        >
          {post.isAuthor ? (
            // Scenario 4 (author) is restyled from its own Figma frame next
            <>
              <DropdownMenu.Item className={styles.item} onSelect={openEdit}>
                수정하기
              </DropdownMenu.Item>
              <DropdownMenu.Item className={styles.item} onSelect={openDelete}>
                삭제하기
              </DropdownMenu.Item>
            </>
          ) : (
            <DropdownMenu.Item className={styles.item} onSelect={openReport}>
              신고 하기
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
