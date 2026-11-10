'use client';

import { TeamSetupIntro } from '../team-setup-intro/TeamSetupIntro';
import { TeamSetupInformation } from '../team-setup-information/TeamSetupInformation';
import { TeamSetupRepositories } from '../team-setup-repositories/TeamSetupRepositories';
import { useTeamSetup } from './hook';
import { TeamSetupBoards } from '../team-setup-boards/TeamSetupBoards';

import { TeamSetupCompletion } from '../team-setup-completion/TeamSetupCompletion';
import { TeamSetupPermissionSheet } from '../team-setup-completion/TeamSetupPermissionSheet';

export function TeamSetup() {
  const {
    step,
    setStep,
    installed,
    setupTeamId,
    create,
    finish,
    setName,
    setNameTouched,
    description,
    setDescription,
    selectedRepos,
    setSelectedRepos,
    boardDraft,
    setBoardDraft,
    teams,
    displayName,
    atLimit,
    openExternal,
  } = useTeamSetup();

  if (step === 1)
    return <TeamSetupIntro teams={teams} atLimit={atLimit} openExternal={openExternal} />;

  if (step === 2)
    return (
      <TeamSetupInformation
        installed={installed}
        name={displayName}
        description={description}
        onNameChange={(value) => {
          setName(value);
          setNameTouched(true);
        }}
        onDescriptionChange={setDescription}
        onNext={() => {
          if (!create.isPending) create.mutate();
        }}
        pending={create.isPending}
        error={create.error}
        openExternal={openExternal}
      />
    );

  if (step === 3)
    return (
      <TeamSetupRepositories
        teamId={setupTeamId}
        selected={selectedRepos}
        onChange={setSelectedRepos}
        onNext={() => void setStep(4, { history: 'push' })}
        openExternal={openExternal}
      />
    );

  if (step === 4)
    return (
      <>
        <TeamSetupBoards
          key={setupTeamId}
          teamId={setupTeamId}
          value={boardDraft}
          onChange={setBoardDraft}
          onSaved={finish.start}
          busy={finish.pending}
          completionError={finish.error}
        />
        <TeamSetupPermissionSheet finish={finish} />
      </>
    );

  return <TeamSetupCompletion key={setupTeamId} teamId={setupTeamId} />;
}
