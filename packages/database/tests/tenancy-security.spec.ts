import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import crypto from "crypto";
import {
  createApiPrismaClient,
  createOrganization,
  listUserOrganizations,
  getOrganizationMembership,
  updateMemberRole,
  removeMember,
  transferOwnership,
  createInvitation,
  listPendingInvitations,
  revokeInvitation,
  getInvitationByTokenHash,
  acceptInvitationByTokenHash,
  OrgRole,
} from "../src/index";

const API_DB_URL =
  process.env.DATABASE_URL ||
  "postgresql://teamos_api_role:teamos_api_password@localhost:5432/teamos?schema=public";

const OWNER_DB_URL =
  process.env.DATABASE_URL_MIGRATION ||
  "postgresql://teamos_owner:teamos_owner_password@localhost:5432/teamos?schema=public";

describe("Milestone 4: Organizations, Memberships, Invitations & RBAC Specification", () => {
  let apiPrisma: ReturnType<typeof createApiPrismaClient>;
  let ownerPool: Pool;
  let apiPool: Pool;

  const testUser1Id = "70000000-0000-0000-0000-000000000001";
  const testUser2Id = "70000000-0000-0000-0000-000000000002";
  const testUser3Id = "70000000-0000-0000-0000-000000000003";

  let orgAId: string;
  let orgBId: string;

  beforeAll(async () => {
    apiPrisma = createApiPrismaClient(API_DB_URL);
    ownerPool = new Pool({ connectionString: OWNER_DB_URL });
    apiPool = new Pool({ connectionString: API_DB_URL });

    await apiPrisma.$connect();

    // Ensure test users exist
    await ownerPool.query(`
      INSERT INTO public.users (id, github_user_id, login, display_name) VALUES
        ('${testUser1Id}', 7001, 'spec-user-1', 'Spec User 1'),
        ('${testUser2Id}', 7002, 'spec-user-2', 'Spec User 2'),
        ('${testUser3Id}', 7003, 'spec-user-3', 'Spec User 3')
      ON CONFLICT (id) DO UPDATE SET login = EXCLUDED.login;
    `);

    // Ensure clean test organizations
    await ownerPool.query(`
      DELETE FROM public.invitations WHERE org_id IN (
        SELECT id FROM public.organizations WHERE slug IN ('spec-org-a', 'spec-org-b')
      );
      DELETE FROM public.memberships WHERE org_id IN (
        SELECT id FROM public.organizations WHERE slug IN ('spec-org-a', 'spec-org-b')
      );
      DELETE FROM public.organizations WHERE slug IN ('spec-org-a', 'spec-org-b');
    `);
  });

  afterAll(async () => {
    try {
      await ownerPool.query(`
        DELETE FROM public.invitations WHERE org_id IN (
          SELECT id FROM public.organizations WHERE slug IN ('spec-org-a', 'spec-org-b')
        );
        DELETE FROM public.memberships WHERE org_id IN (
          SELECT id FROM public.organizations WHERE slug IN ('spec-org-a', 'spec-org-b')
        );
        DELETE FROM public.organizations WHERE slug IN ('spec-org-a', 'spec-org-b');
        DELETE FROM public.users WHERE id IN ('${testUser1Id}', '${testUser2Id}', '${testUser3Id}');
      `);
    } finally {
      await apiPrisma.$disconnect();
      await ownerPool.end();
      await apiPool.end();
    }
  });

  describe("Organization Creation & Ownership Assignment", () => {
    it("creates an organization and automatically assigns creator as OWNER", async () => {
      const result = await createOrganization(
        apiPrisma,
        testUser1Id,
        "Spec Organization A",
        "spec-org-a",
      );

      expect(result.organization.name).toBe("Spec Organization A");
      expect(result.organization.slug).toBe("spec-org-a");
      expect(result.membership.role).toBe(OrgRole.OWNER);
      expect(result.membership.userId).toBe(testUser1Id);

      orgAId = result.organization.id;
    });

    it("creates a second organization for user 2", async () => {
      const result = await createOrganization(
        apiPrisma,
        testUser2Id,
        "Spec Organization B",
        "spec-org-b",
      );

      expect(result.membership.role).toBe(OrgRole.OWNER);
      orgBId = result.organization.id;
    });

    it("isolates organization listings so users only see their own organizations", async () => {
      const user1Orgs = await listUserOrganizations(apiPrisma, testUser1Id);
      const user2Orgs = await listUserOrganizations(apiPrisma, testUser2Id);

      expect(user1Orgs.some((o) => o.id === orgAId)).toBe(true);
      expect(user1Orgs.some((o) => o.id === orgBId)).toBe(false);

      expect(user2Orgs.some((o) => o.id === orgBId)).toBe(true);
      expect(user2Orgs.some((o) => o.id === orgAId)).toBe(false);
    });
  });

  describe("Role Management & Last Owner Protection", () => {
    it("prevents demoting the final owner of an organization", async () => {
      await expect(
        updateMemberRole(apiPrisma, orgAId, testUser1Id, OrgRole.ADMIN),
      ).rejects.toThrow(/Cannot demote the final owner of the organization/i);
    });

    it("prevents direct elevation to OWNER via updateMemberRole", async () => {
      await expect(
        updateMemberRole(apiPrisma, orgAId, testUser2Id, OrgRole.OWNER),
      ).rejects.toThrow(/Direct role elevation to OWNER is not permitted/i);
    });

    it("prevents removing the final owner of an organization", async () => {
      await expect(
        removeMember(apiPrisma, orgAId, testUser1Id),
      ).rejects.toThrow(/Cannot remove the final owner of the organization/i);
    });
  });

  describe("Invitations Lifecycle & Cryptographic Hashing", () => {
    const rawToken = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    let invitationId: string;

    it("creates an invitation storing only SHA-256 token hash (never raw token)", async () => {
      const inv = await createInvitation(
        apiPrisma,
        orgAId,
        testUser1Id,
        tokenHash,
        OrgRole.MEMBER,
        "invited-user@example.com",
        7,
      );

      expect(inv.id).toBeDefined();
      expect(inv.tokenHash).toBe(tokenHash);
      expect(inv.email).toBe("invited-user@example.com");
      expect(inv.role).toBe(OrgRole.MEMBER);
      invitationId = inv.id;

      // Verify rawToken is not stored in the database
      const row = await ownerPool.query(
        "SELECT * FROM public.invitations WHERE token_hash = $1",
        [tokenHash],
      );
      expect(row.rows.length).toBe(1);
      expect(row.rows[0].token_hash).toBe(tokenHash);
      expect(row.rows[0].token_hash).not.toBe(rawToken);
    });

    it("inspects invitation details via get_invitation_by_token", async () => {
      const details = await getInvitationByTokenHash(apiPrisma, tokenHash);

      expect(details).not.toBeNull();
      expect(details?.orgId).toBe(orgAId);
      expect(details?.orgName).toBe("Spec Organization A");
      expect(details?.role).toBe(OrgRole.MEMBER);
      expect(details?.isValid).toBe(true);
      expect(details?.invalidReason).toBeNull();
    });

    it("accepts an invitation and assigns membership atomically", async () => {
      const acceptResult = await acceptInvitationByTokenHash(
        apiPrisma,
        tokenHash,
        testUser3Id,
      );

      expect(acceptResult.success).toBe(true);
      expect(acceptResult.orgId).toBe(orgAId);
      expect(acceptResult.role).toBe(OrgRole.MEMBER);

      // Verify membership was created
      const membership = await getOrganizationMembership(apiPrisma, orgAId, testUser3Id);
      expect(membership).not.toBeNull();
      expect(membership?.role).toBe(OrgRole.MEMBER);
    });

    it("returns idempotent success when same user accepts already-accepted invitation", async () => {
      const acceptResult = await acceptInvitationByTokenHash(
        apiPrisma,
        tokenHash,
        testUser3Id,
      );

      expect(acceptResult.success).toBe(true);
      expect(acceptResult.message).toContain("Already accepted by user");
    });

    it("rejects when a different user attempts to accept already-accepted invitation", async () => {
      const acceptResult = await acceptInvitationByTokenHash(
        apiPrisma,
        tokenHash,
        testUser2Id,
      );

      expect(acceptResult.success).toBe(false);
      expect(acceptResult.message).toContain("already been accepted");
    });
  });

  describe("Invitation Revocation & Expiration", () => {
    it("revokes a pending invitation", async () => {
      const rawToken = crypto.randomBytes(32).toString("base64url");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

      const inv = await createInvitation(
        apiPrisma,
        orgAId,
        testUser1Id,
        tokenHash,
        OrgRole.ADMIN,
        "revoke-test@example.com",
      );

      const revoked = await revokeInvitation(apiPrisma, orgAId, inv.id);
      expect(revoked).toBe(true);

      // Inspection shows invalid
      const details = await getInvitationByTokenHash(apiPrisma, tokenHash);
      expect(details?.isValid).toBe(false);
      expect(details?.invalidReason).toBe("REVOKED");

      // Acceptance is rejected
      const accept = await acceptInvitationByTokenHash(apiPrisma, tokenHash, testUser2Id);
      expect(accept.success).toBe(false);
      expect(accept.message).toContain("revoked");
    });

    it("rejects acceptance of an expired invitation", async () => {
      const rawToken = crypto.randomBytes(32).toString("base64url");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

      // Create already expired invitation directly
      await ownerPool.query(
        `INSERT INTO public.invitations (org_id, token_hash, role, created_by, expires_at)
         VALUES ($1, $2, 'MEMBER', $3, clock_timestamp() - INTERVAL '1 hour')`,
        [orgAId, tokenHash, testUser1Id],
      );

      const details = await getInvitationByTokenHash(apiPrisma, tokenHash);
      expect(details?.isValid).toBe(false);
      expect(details?.invalidReason).toBe("EXPIRED");

      const accept = await acceptInvitationByTokenHash(apiPrisma, tokenHash, testUser2Id);
      expect(accept.success).toBe(false);
      expect(accept.message).toContain("expired");
    });
  });

  describe("Ownership Transfer", () => {
    it("atomically transfers ownership to an existing member and demotes previous owner", async () => {
      // testUser3Id is currently a MEMBER in orgAId
      const transfer = await transferOwnership(apiPrisma, orgAId, testUser1Id, testUser3Id);
      expect(transfer.success).toBe(true);

      const newOwner = await getOrganizationMembership(apiPrisma, orgAId, testUser3Id);
      expect(newOwner?.role).toBe(OrgRole.OWNER);

      const oldOwner = await getOrganizationMembership(apiPrisma, orgAId, testUser1Id);
      expect(oldOwner?.role).toBe(OrgRole.ADMIN);

      // Transfer back to testUser1Id
      await transferOwnership(apiPrisma, orgAId, testUser3Id, testUser1Id);
      const restored = await getOrganizationMembership(apiPrisma, orgAId, testUser1Id);
      expect(restored?.role).toBe(OrgRole.OWNER);
    });
  });

  describe("PostgreSQL Forced RLS Isolation on Invitations", () => {
    it("returns 0 rows when queried under teamos_api_role with no tenant context", async () => {
      const result = await apiPool.query("SELECT * FROM public.invitations");
      expect(result.rows.length).toBe(0);
    });

    it("returns only tenant-isolated invitations when app.org_id is set", async () => {
      await apiPool.query("BEGIN;");
      await apiPool.query(`SELECT set_config('app.org_id', $1, true)`, [orgAId]);
      const resA = await apiPool.query("SELECT * FROM public.invitations");
      await apiPool.query("COMMIT;");

      expect(resA.rows.length).toBeGreaterThan(0);
      expect(resA.rows.every((row) => row.org_id === orgAId)).toBe(true);
    });
  });
});
