import { prisma } from "@/lib/db";
import { calculateRag, worstRag } from "./calculator";
import type { UseCaseProgress, EntityProgress, RagStatus } from "@/types/rag";

interface TicketStats {
  useCaseId: string;
  doneCount: bigint;
  totalCount: bigint;
  donePoints: number;
  totalPoints: number;
}

async function getTicketStats(useCaseIds: string[]): Promise<Map<string, TicketStats>> {
  if (useCaseIds.length === 0) return new Map();

  const rows = await prisma.$queryRaw<TicketStats[]>`
    SELECT
      m."useCaseId",
      COUNT(t.id) FILTER (WHERE t."statusCategory" = 'Done') AS "doneCount",
      COUNT(t.id) AS "totalCount",
      COALESCE(SUM(t."storyPoints") FILTER (WHERE t."statusCategory" = 'Done'), 0) AS "donePoints",
      COALESCE(SUM(t."storyPoints"), 0) AS "totalPoints"
    FROM "TicketUseCaseMapping" m
    JOIN "JiraTicket" t ON t.id = m."ticketId"
    WHERE m."useCaseId" = ANY(${useCaseIds})
    GROUP BY m."useCaseId"
  `;

  const map = new Map<string, TicketStats>();
  for (const row of rows) {
    map.set(row.useCaseId, row);
  }
  return map;
}

export async function computeEntityProgress(
  entityId?: string,
  quarter?: number,
  year?: number
): Promise<EntityProgress[]> {
  const entities = await prisma.entity.findMany({
    where: entityId ? { id: entityId } : { parentId: null },
    include: {
      useCases: {
        where: {
          parentId: null,
          ...(quarter && year ? { targetQuarter: quarter, targetYear: year } : {}),
        },
        include: {
          children: {
            include: { children: true },
          },
        },
        orderBy: { priority: "desc" },
      },
    },
  });

  const allUseCaseIds: string[] = [];
  for (const entity of entities) {
    collectIds(entity.useCases, allUseCaseIds);
  }

  const stats = await getTicketStats(allUseCaseIds);

  return entities.map((entity) => {
    const useCases = entity.useCases.map((uc) => buildProgress(uc, stats));
    const totalDone = useCases.reduce((s, u) => s + u.doneCount, 0);
    const total = useCases.reduce((s, u) => s + u.totalCount, 0);
    const rag: RagStatus = useCases.length > 0 ? worstRag(useCases.map((u) => u.rag)) : "GREEN";

    return {
      entityId: entity.id,
      entityName: entity.name,
      entityColor: entity.color,
      doneCount: totalDone,
      totalCount: total,
      progress: total > 0 ? totalDone / total : 0,
      rag,
      useCases,
    };
  });
}

function collectIds(useCases: UseCaseWithChildren[], acc: string[]) {
  for (const uc of useCases) {
    acc.push(uc.id);
    if (uc.children) collectIds(uc.children, acc);
  }
}

interface UseCaseWithChildren {
  id: string;
  name: string;
  level: string;
  entityId: string;
  targetQuarter: number | null;
  targetYear: number | null;
  statusOverride: string | null;
  priority: number;
  createdAt: Date;
  children?: UseCaseWithChildren[];
}

function buildProgress(
  uc: UseCaseWithChildren,
  stats: Map<string, TicketStats>
): UseCaseProgress {
  const s = stats.get(uc.id);
  const doneCount = s ? Number(s.doneCount) : 0;
  const totalCount = s ? Number(s.totalCount) : 0;
  const donePoints = s ? Number(s.donePoints) : 0;
  const totalPoints = s ? Number(s.totalPoints) : 0;

  const progress = totalPoints > 0
    ? donePoints / totalPoints
    : totalCount > 0
    ? doneCount / totalCount
    : 0;

  const rag = calculateRag({
    donePoints,
    totalPoints,
    doneCount,
    totalCount,
    targetQuarter: uc.targetQuarter,
    targetYear: uc.targetYear,
    createdAt: uc.createdAt,
    statusOverride: uc.statusOverride as RagStatus | null,
  });

  const children = uc.children?.map((child) => buildProgress(child, stats)) ?? [];

  return {
    useCaseId: uc.id,
    name: uc.name,
    level: uc.level,
    entityId: uc.entityId,
    targetQuarter: uc.targetQuarter,
    targetYear: uc.targetYear,
    statusOverride: uc.statusOverride as RagStatus | null,
    doneCount,
    totalCount,
    donePoints,
    totalPoints,
    progress,
    rag,
    children,
  };
}
