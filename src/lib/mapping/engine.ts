import { prisma } from "@/lib/db";
import { evaluateRule } from "./evaluator";
import type { RuleCondition, RuleMatchResult } from "@/types/mapping";

export async function runMappingEngine(
  instanceId: string,
  ticketIds: string[]
): Promise<void> {
  const rules = await prisma.mappingRule.findMany({
    where: {
      enabled: true,
      OR: [
        { jiraInstanceId: instanceId },
        { jiraInstanceId: null },
      ],
    },
    orderBy: { priority: "desc" },
  });

  if (rules.length === 0) return;

  const tickets = await prisma.jiraTicket.findMany({
    where: { id: { in: ticketIds } },
    select: {
      id: true,
      jiraKey: true,
      epicKey: true,
      epicName: true,
      labels: true,
      components: true,
      issueType: true,
      sprintName: true,
      priority: true,
      assignee: true,
      rawData: true,
      useCaseMappings: {
        where: { source: "MANUAL" },
        select: { useCaseId: true },
      },
    },
  });

  const manualMappings = new Map<string, Set<string>>();
  for (const ticket of tickets) {
    manualMappings.set(
      ticket.id,
      new Set(ticket.useCaseMappings.map((m) => m.useCaseId))
    );
  }

  const toUpsert: Array<{
    ticketId: string;
    useCaseId: string;
    confidence: number;
    ruleId: string;
  }> = [];

  for (const ticket of tickets) {
    const manualSet = manualMappings.get(ticket.id) ?? new Set();
    const bestPerUseCase = new Map<string, { confidence: number; ruleId: string }>();

    for (const rule of rules) {
      if (manualSet.has(rule.useCaseId)) continue;

      const conditions = rule.conditions as unknown as RuleCondition[];
      const result = evaluateRule(
        ticket as Parameters<typeof evaluateRule>[0],
        conditions,
        rule.logic
      );

      if (result.matched && result.confidence > 0) {
        const existing = bestPerUseCase.get(rule.useCaseId);
        if (!existing || result.confidence > existing.confidence) {
          bestPerUseCase.set(rule.useCaseId, {
            confidence: result.confidence,
            ruleId: rule.id,
          });
        }
      }
    }

    for (const [useCaseId, { confidence, ruleId }] of Array.from(bestPerUseCase.entries())) {
      toUpsert.push({ ticketId: ticket.id, useCaseId, confidence, ruleId });
    }
  }

  if (toUpsert.length === 0) return;

  // Upsert in batches of 100
  for (let i = 0; i < toUpsert.length; i += 100) {
    const batch = toUpsert.slice(i, i + 100);
    await Promise.all(
      batch.map((m) =>
        prisma.ticketUseCaseMapping.upsert({
          where: { ticketId_useCaseId: { ticketId: m.ticketId, useCaseId: m.useCaseId } },
          create: {
            ticketId: m.ticketId,
            useCaseId: m.useCaseId,
            source: "AUTOMATIC",
            confidence: m.confidence,
            ruleId: m.ruleId,
          },
          update: {
            confidence: m.confidence,
            ruleId: m.ruleId,
            source: "AUTOMATIC",
          },
        })
      )
    );
  }
}

export async function remapAllTickets(): Promise<void> {
  const instances = await prisma.jiraInstance.findMany({ select: { id: true } });
  for (const instance of instances) {
    const tickets = await prisma.jiraTicket.findMany({
      where: { jiraInstanceId: instance.id },
      select: { id: true },
    });
    const ids = tickets.map((t) => t.id);
    if (ids.length > 0) {
      await runMappingEngine(instance.id, ids);
    }
  }
}
