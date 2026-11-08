'use client';

import Image from 'next/image';
import type { InstalledOrganization } from '../../_lib/installation';
import styles from './TeamSetupInformation.module.css';

type Props = {
  installed?: InstalledOrganization;
  name: string;
  description: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onNext: () => void;
  openExternal: (url: string) => void;
};

/** Figma 8-2 (374:4196). These are screen limits, not changes to the server contract. */
const INPUT = { name: 50, description: 100 } as const;

export function TeamSetupInformation({
  installed,
  name,
  description,
  onNameChange,
  onDescriptionChange,
  onNext,
  openExternal,
}: Props) {
  const organizationUrl = installed ? `https://github.com/${installed.org.login}` : undefined;
  const ready =
    !!installed &&
    !!name.trim() &&
    !!description.trim() &&
    name.length <= INPUT.name &&
    description.length <= INPUT.description;
  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) onNext();
      }}
    >
      <div className={styles.content}>
        <div className={styles.heading}>
          <h2>팀 정보를 입력해 주세요</h2>
          <p>연결 된 GitHub 조직을 확인하고, 팀 정보를 작성해 주세요</p>
        </div>
        <div className={styles.organizationGroup}>
          {installed && organizationUrl ? (
            <a
              className={styles.organization}
              href={organizationUrl}
              onClick={(event) => {
                event.preventDefault();
                openExternal(organizationUrl);
              }}
            >
              <span className={styles.avatar}>
                {installed.org.avatarUrl?.startsWith('https://avatars.githubusercontent.com/') && (
                  <Image src={installed.org.avatarUrl} alt="" width={50} height={50} />
                )}
              </span>
              <span className={styles.organizationText}>
                <span className={styles.organizationName}>{installed.org.login}</span>
                <span className={styles.organizationUrl}>{organizationUrl}</span>
              </span>
              <Image src="/images/team-setup/chevron.svg" alt="" width={44} height={44} />
            </a>
          ) : (
            <div
              className={`${styles.organization} ${styles.unverified}`}
              aria-label="GitHub 조직 연결 확인 전"
            />
          )}
          <p className={styles.organizationCaption}>
            설치 된 GitHub 조직
            <Image src="/images/team-setup/question.svg" alt="" width={16} height={16} />
          </p>
        </div>
        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label htmlFor="team-name">팀 이름</label>
            <span id="team-name-limit">최대 {INPUT.name}자</span>
            <span className={styles.required} aria-hidden="true" />
          </div>
          <input
            id="team-name"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            maxLength={INPUT.name}
            placeholder="프로젝트 제목을 작성해 주세요."
            autoComplete="organization"
            required
            aria-describedby="team-name-limit"
          />
        </div>
        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label htmlFor="team-description">팀 소개</label>
            <span id="team-description-limit">최대 {INPUT.description}자</span>
            <span className={styles.required} aria-hidden="true" />
          </div>
          <div className={styles.descriptionField}>
            <textarea
              id="team-description"
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              maxLength={INPUT.description}
              placeholder="프로젝트에 관해 간단하게 글을 작성해 주세요"
              required
              aria-describedby="team-description-limit team-description-count"
            />
            <span id="team-description-count" className={styles.count}>
              {description.length}/{INPUT.description}
            </span>
          </div>
        </div>
      </div>
      <button type="submit" className={styles.next} disabled={!ready}>
        다음
      </button>
    </form>
  );
}
