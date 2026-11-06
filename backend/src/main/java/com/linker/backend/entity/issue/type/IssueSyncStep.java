package com.linker.backend.entity.issue.type;

/** issue_sync_jobs.step. CREATE is the page 13 creation intent; the rest are page 12 edits. */
public enum IssueSyncStep {
	CREATE, ADD_TO_PROJECT, SET_START, SET_DUE, SET_STATUS, CLOSE, REOPEN, SET_ASSIGNEES, SET_LABELS
}
