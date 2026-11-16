import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const dbPath = path.join(process.cwd(), "prisma", "dashboard.db");

function ensureParentDir() {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

function bootstrapWithSqlite() {
  ensureParentDir();
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS "DashboardSession" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "discordId" TEXT NOT NULL,
      "username" TEXT NOT NULL,
      "globalName" TEXT,
      "avatar" TEXT,
      "accessToken" TEXT NOT NULL,
      "refreshToken" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "expiresAt" DATETIME NOT NULL,
      "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS "DashboardSession_discordId_idx" ON "DashboardSession"("discordId");
    CREATE INDEX IF NOT EXISTS "DashboardSession_expiresAt_idx" ON "DashboardSession"("expiresAt");

    CREATE TABLE IF NOT EXISTS "GuildSubscription" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "guildId" TEXT NOT NULL UNIQUE,
      "plan" TEXT NOT NULL DEFAULT 'FREE',
      "active" BOOLEAN NOT NULL DEFAULT 0,
      "source" TEXT NOT NULL DEFAULT 'bot_sync',
      "premiumTier" TEXT,
      "premiumExpiresAt" DATETIME,
      "stripeCustomerId" TEXT,
      "stripeSubId" TEXT,
      "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS "GuildSubscription_active_idx" ON "GuildSubscription"("active");
    CREATE INDEX IF NOT EXISTS "GuildSubscription_premiumExpiresAt_idx" ON "GuildSubscription"("premiumExpiresAt");

    CREATE TABLE IF NOT EXISTS "DashboardAuditEvent" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "guildId" TEXT,
      "actorUserId" TEXT,
      "actorTag" TEXT,
      "area" TEXT NOT NULL,
      "action" TEXT NOT NULL,
      "severity" TEXT NOT NULL DEFAULT 'info',
      "metadata" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS "DashboardAuditEvent_guildId_createdAt_idx" ON "DashboardAuditEvent"("guildId", "createdAt");
    CREATE INDEX IF NOT EXISTS "DashboardAuditEvent_area_createdAt_idx" ON "DashboardAuditEvent"("area", "createdAt");
    CREATE INDEX IF NOT EXISTS "DashboardAuditEvent_actorUserId_createdAt_idx" ON "DashboardAuditEvent"("actorUserId", "createdAt");

    CREATE TABLE IF NOT EXISTS "GuildDiscoveryCache" (
      "cacheKey" TEXT NOT NULL PRIMARY KEY,
      "kind" TEXT NOT NULL,
      "payload" TEXT NOT NULL,
      "expiresAt" DATETIME NOT NULL,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS "GuildDiscoveryCache_kind_expiresAt_idx" ON "GuildDiscoveryCache"("kind", "expiresAt");

    CREATE TABLE IF NOT EXISTS "PersonalSocialAccount" (
      "userId" TEXT NOT NULL, "provider" TEXT NOT NULL, "providerId" TEXT NOT NULL,
      "label" TEXT NOT NULL, "url" TEXT NOT NULL,
      PRIMARY KEY ("userId", "provider")
    );
    CREATE TABLE IF NOT EXISTS "PersonalSocialRevision" (
      "userId" TEXT NOT NULL, "provider" TEXT NOT NULL, "revision" TEXT NOT NULL,
      PRIMARY KEY ("userId", "provider")
    );
    INSERT OR IGNORE INTO "PersonalSocialRevision" ("userId", "provider", "revision")
      SELECT "userId", "provider", lower(hex(randomblob(16))) FROM "PersonalSocialAccount";
    CREATE TABLE IF NOT EXISTS "PersonalSocialVisibility" (
      "userId" TEXT NOT NULL, "provider" TEXT NOT NULL, "guildId" TEXT NOT NULL,
      PRIMARY KEY ("userId", "provider", "guildId")
    );
    CREATE INDEX IF NOT EXISTS "PersonalSocialVisibility_guild_idx"
      ON "PersonalSocialVisibility"("guildId", "userId", "provider");
    CREATE TABLE IF NOT EXISTS "PersonalSocialOAuthState" (
      "stateHash" TEXT NOT NULL PRIMARY KEY, "sessionHash" TEXT NOT NULL,
      "userId" TEXT NOT NULL, "expiresAt" INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "PersonalSocialOAuthAttempt" (
      "stateHash" TEXT NOT NULL PRIMARY KEY, "sessionHash" TEXT NOT NULL,
      "userId" TEXT NOT NULL, "provider" TEXT NOT NULL, "expiresAt" INTEGER NOT NULL,
      "claimed" INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS "PersonalSocialOAuthAttempt_owner_idx"
      ON "PersonalSocialOAuthAttempt"("userId", "provider");
  `);

  db.close();
}

bootstrapWithSqlite();

export { dbPath as DASHBOARD_SQLITE_PATH };
