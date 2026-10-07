import { prisma } from "@/lib/db";

export type TeamMember = {
  id: string;
  role: "OWNER" | "EMPLOYEE";
  user: { id: string; name: string | null; email: string; status: "ACTIVE" | "SUSPENDED" };
};

export type TeamInvitation = {
  id: string;
  email: string;
  role: "OWNER" | "EMPLOYEE";
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  expiresAt: string;
  createdAt: string;
};

export async function getTeamScreen(businessId: string) {
  const [memberships, invitations] = await Promise.all([
    prisma.membership.findMany({
      where: { businessId, deletedAt: null },
      select: { id: true, role: true, user: { select: { id: true, name: true, email: true, status: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invitation.findMany({
      where: { businessId, status: "PENDING", expiresAt: { gt: new Date() } },
      select: { id: true, email: true, role: true, status: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    memberships: memberships as TeamMember[],
    invitations: invitations.map((invitation) => ({
      ...invitation,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
    })) satisfies TeamInvitation[],
  };
}
