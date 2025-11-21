import {
  pgTable,
  varchar,
  integer,
  jsonb,
  timestamp,
  text,
  index,
} from "drizzle-orm/pg-core";

import type {
  ChallengeQuestion,
  Difficulty,
  ChallengeStatus,
} from "@/db/types";

// ============================================================================
// Learning & Results Tables
// ============================================================================

export const results = pgTable(
  "results",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    subject: varchar("subject", { length: 64 }),
    score: integer("score"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    // Index for leaderboard queries (subject + score + userId)
    userIdIdx: index("idx_results_user_id").on(table.userId),
    subjectIdx: index("idx_results_subject").on(table.subject),
    scoreIdx: index("idx_results_score").on(table.score),
    // Compound index for subject-specific leaderboards
    subjectScoreIdx: index("idx_results_subject_score").on(table.subject, table.score),
    // Compound index for user-specific queries
    userSubjectIdx: index("idx_results_user_subject").on(table.userId, table.subject),
    createdAtIdx: index("idx_results_created_at").on(table.createdAt),
  })
);

// ============================================================================
// Learning & Challenges Tables
// ============================================================================

export const tutorSessions = pgTable(
  "tutor_sessions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    studentId: varchar("student_id", { length: 36 }).notNull(),
    tutorId: varchar("tutor_id", { length: 36 }), // nullable for simulated sessions
    subject: varchar("subject", { length: 64 }).notNull(),
    transcript: text("transcript").notNull(), // full tutor session transcript
    summary: text("summary").notNull(), // LLM-generated summary
    tutorNotes: text("tutor_notes"), // tutor can add notes later
    studentNotes: text("student_notes"), // student can reflect on session
    duration: integer("duration"), // session duration in minutes
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    studentIdIdx: index("idx_tutor_sessions_student_id").on(table.studentId),
    tutorIdIdx: index("idx_tutor_sessions_tutor_id").on(table.tutorId),
    subjectIdx: index("idx_tutor_sessions_subject").on(table.subject),
    createdAtIdx: index("idx_tutor_sessions_created_at").on(table.createdAt),
  })
);

export const challenges = pgTable(
  "challenges",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    sessionId: varchar("session_id", { length: 36 }), // nullable, links to tutor_sessions
    userId: varchar("user_id", { length: 36 }).notNull(), // student who should complete this
    invitedUserId: varchar("invited_user_id", { length: 36 }), // nullable, if this challenge was shared, who was challenged?
    subject: varchar("subject", { length: 64 }).notNull(),
    questions: jsonb("questions").$type<ChallengeQuestion[]>().notNull(),
    difficulty: varchar("difficulty", { length: 12 })
      .notNull()
      .default("medium")
      .$type<Difficulty>(),
    status: varchar("status", { length: 12 })
      .notNull()
      .default("pending")
      .$type<ChallengeStatus>(),
    score: integer("score"), // 0-100, nullable until completed
    completedAt: timestamp("completed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    loop: varchar("loop", { length: 24 }), // viral loop that triggered this
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    sessionIdIdx: index("idx_challenges_session_id").on(table.sessionId),
    userIdIdx: index("idx_challenges_user_id").on(table.userId),
    invitedUserIdIdx: index("idx_challenges_invited_user_id").on(table.invitedUserId),
    statusIdx: index("idx_challenges_status").on(table.status),
    subjectIdx: index("idx_challenges_subject").on(table.subject),
    // Compound index for common query pattern: user's challenges by status
    userStatusIdx: index("idx_challenges_user_status").on(table.userId, table.status),
    // Compound index for invited user challenges by status
    invitedUserStatusIdx: index("idx_challenges_invited_user_status").on(table.invitedUserId, table.status),
  })
);

