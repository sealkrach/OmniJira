import { prisma } from "@/lib/db";
import { getOpenAI } from "./openai";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EpicCluster {
  epicKey: string;
  epicName: string;
  ticketCount: number;
  issueTypes: string[];
  sampleSummaries: string[];
  ticketKeys: string[];
}

interface AiInitiative {
  name: string;
  description: string;
  epicKeys: string[];      // epics that map to this initiative
  orphanTicketKeys: string[]; // tickets with no epic that belong here
}

interface AiCapability {
  name: string;
  description: string;
  initiatives: AiInitiative[];
}

interface AiDomain {
  name: string;
  description: string;
  capabilities: AiCapability[];
}

interface AiTaxonomy {
  domains: AiDomain[];
}

// ─── Main: Generate taxonomy from tickets ─────────────────────────────────────

export async function generateUseCasesFromTickets(
  instanceId: string,
  entityId: string,
  options: { targetQuarter?: number | null; targetYear?: number | null } = {}
): Promise<{ created: number; mapped: number; taxonomy: AiTaxonomy }> {
  const tickets = await prisma.jiraTicket.findMany({
    where: { jiraInstanceId: instanceId },
    select: {
      jiraKey: true,
      summary: true,
      issueType: true,
      epicKey: true,
      epicName: true,
      labels: true,
      components: true,
    },
    take: 500,
    orderBy: { jiraUpdatedAt: "desc" },
  });

  if (tickets.length === 0) {
    throw new Error("No tickets found for this Jira instance. Run a sync first.");
  }

  // Phase 1 — Programmatic clustering by epic (no AI needed)
  const epicMap = new Map<string, EpicCluster>();
  const orphans: typeof tickets = [];

  for (const t of tickets) {
    if (t.epicKey) {
      const existing = epicMap.get(t.epicKey);
      if (existing) {
        existing.ticketCount++;
        if (!existing.issueTypes.includes(t.issueType)) existing.issueTypes.push(t.issueType);
        if (existing.sampleSummaries.length < 3) existing.sampleSummaries.push(t.summary);
        existing.ticketKeys.push(t.jiraKey);
      } else {
        epicMap.set(t.epicKey, {
          epicKey: t.epicKey,
          epicName: t.epicName ?? t.epicKey,
          ticketCount: 1,
          issueTypes: [t.issueType],
          sampleSummaries: [t.summary],
          ticketKeys: [t.jiraKey],
        });
      }
    } else {
      orphans.push(t);
    }
  }

  const clusters = Array.from(epicMap.values());

  // Phase 2 — AI organises clusters into Domain → Capability → Initiative
  const taxonomy = await callOpenAI(clusters, orphans);
  const { created, mapped } = await persistTaxonomy(taxonomy, entityId, instanceId, options, epicMap);

  return { created, mapped, taxonomy };
}

// ─── AI call: clusters → taxonomy ─────────────────────────────────────────────

async function callOpenAI(
  clusters: EpicCluster[],
  orphans: Array<{ jiraKey: string; summary: string; issueType: string }>
): Promise<AiTaxonomy> {
  const { client: ai, model } = await getOpenAI();

  const clusterLines = clusters
    .map(
      (c) =>
        `- Epic "${c.epicName}" [${c.epicKey}]: ${c.ticketCount} tickets (${c.issueTypes.join(", ")}) — ex: ${c.sampleSummaries.slice(0, 2).join(" | ")}`
    )
    .join("\n");

  const orphanLines = orphans.length
    ? orphans.map((t) => `  ${t.jiraKey} [${t.issueType}]: ${t.summary}`).join("\n")
    : "  (none)";

  const system = `You are an enterprise architect building a use case taxonomy from a Jira project's epics.

You will receive a list of epic clusters extracted from the project. Your job is to organise them into a 3-level hierarchy:
  Domain → Capability → Initiative

STRICT RULES:
1. Each Initiative corresponds to ONE OR MORE epics from the list — reference them by their epicKey(s)
2. Use the ORIGINAL epic names as Initiative names (preserve the original language: French, English, etc.)
3. Capabilities group thematically related Initiatives
4. Domains are the broadest business areas (2–4 max)
5. Orphan tickets (no epic) must each be assigned to an Initiative via their ticket key in "orphanTicketKeys"
6. Do NOT invent generic names like "Operational Excellence" — name things based on what's actually in the epics
7. Keep all names in the SAME LANGUAGE as the source epics

Return ONLY valid JSON, no markdown, matching this exact schema:
{
  "domains": [
    {
      "name": "string",
      "description": "string (1 sentence, same language as epics)",
      "capabilities": [
        {
          "name": "string",
          "description": "string",
          "initiatives": [
            {
              "name": "string (use the epic name or a very close derivative)",
              "description": "string",
              "epicKeys": ["PROJ-1"],
              "orphanTicketKeys": []
            }
          ]
        }
      ]
    }
  ]
}`;

  const userMsg = `Epic clusters from the project:
${clusterLines}

Orphan tickets (no epic — assign each to the most relevant Initiative):
${orphanLines}

Generate the taxonomy now.`;

  const completion = await ai.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: userMsg },
    ],
    temperature: 0.2,
  });

  const raw = completion.choices[0].message.content ?? "{}";
  const parsed = JSON.parse(raw) as AiTaxonomy;

  if (!Array.isArray(parsed.domains)) {
    throw new Error("OpenAI returned unexpected structure — missing domains array");
  }

  return parsed;
}

// ─── Persist taxonomy ─────────────────────────────────────────────────────────

async function persistTaxonomy(
  taxonomy: AiTaxonomy,
  entityId: string,
  instanceId: string,
  options: { targetQuarter?: number | null; targetYear?: number | null },
  epicMap: Map<string, EpicCluster>
): Promise<{ created: number; mapped: number }> {
  let created = 0;
  let mapped = 0;

  // Build jiraKey → DB id lookup
  const ticketRows = await prisma.jiraTicket.findMany({
    where: { jiraInstanceId: instanceId },
    select: { id: true, jiraKey: true, epicKey: true },
  });
  const keyToId = new Map(ticketRows.map((t) => [t.jiraKey, t.id]));

  for (const domain of taxonomy.domains) {
    const domainUc = await prisma.useCase.create({
      data: { name: domain.name, description: domain.description || null, entityId, level: "DOMAIN", priority: 0 },
    });
    created++;

    for (const cap of domain.capabilities) {
      const capUc = await prisma.useCase.create({
        data: { name: cap.name, description: cap.description || null, entityId, parentId: domainUc.id, level: "CAPABILITY", priority: 0 },
      });
      created++;

      for (const init of cap.initiatives) {
        const initUc = await prisma.useCase.create({
          data: {
            name: init.name,
            description: init.description || null,
            entityId,
            parentId: capUc.id,
            level: "INITIATIVE",
            targetQuarter: options.targetQuarter ?? null,
            targetYear: options.targetYear ?? null,
            priority: 0,
          },
        });
        created++;

        // Map all tickets that belong to any of the referenced epics
        const epicKeys: string[] = Array.isArray(init.epicKeys) ? init.epicKeys : [];
        for (const epicKey of epicKeys) {
          const cluster = epicMap.get(epicKey);
          if (!cluster) continue;
          for (const ticketKey of cluster.ticketKeys) {
            const ticketId = keyToId.get(ticketKey);
            if (!ticketId) continue;
            await prisma.ticketUseCaseMapping.upsert({
              where: { ticketId_useCaseId: { ticketId, useCaseId: initUc.id } },
              create: { ticketId, useCaseId: initUc.id, source: "AUTOMATIC", confidence: 0.9 },
              update: { source: "AUTOMATIC", confidence: 0.9 },
            });
            mapped++;
          }
        }

        // Map orphan tickets explicitly assigned by AI
        const orphanKeys: string[] = Array.isArray(init.orphanTicketKeys) ? init.orphanTicketKeys : [];
        for (const key of orphanKeys) {
          const ticketId = keyToId.get(key);
          if (!ticketId) continue;
          await prisma.ticketUseCaseMapping.upsert({
            where: { ticketId_useCaseId: { ticketId, useCaseId: initUc.id } },
            create: { ticketId, useCaseId: initUc.id, source: "AUTOMATIC", confidence: 0.75 },
            update: { source: "AUTOMATIC", confidence: 0.75 },
          });
          mapped++;
        }
      }
    }
  }

  return { created, mapped };
}

// ─── Map unmapped tickets to existing use cases ───────────────────────────────

export async function mapTicketsToExistingUseCases(
  instanceId: string
): Promise<{ mapped: number; skipped: number }> {
  const { client: ai, model } = await getOpenAI();

  const [unmappedTickets, useCases] = await Promise.all([
    prisma.jiraTicket.findMany({
      where: {
        jiraInstanceId: instanceId,
        useCaseMappings: { none: {} }, // only tickets with zero mappings
      },
      select: { id: true, jiraKey: true, summary: true, issueType: true, epicKey: true, epicName: true, labels: true, components: true },
      take: 200,
    }),
    prisma.useCase.findMany({
      where: { level: "INITIATIVE" },
      select: { id: true, name: true, description: true },
    }),
  ]);

  // Count already-mapped tickets for reporting
  const totalTickets = await prisma.jiraTicket.count({ where: { jiraInstanceId: instanceId } });
  const skipped = totalTickets - unmappedTickets.length;

  if (unmappedTickets.length === 0 || useCases.length === 0) {
    return { mapped: 0, skipped };
  }

  const ucList = useCases
    .map((uc, i) => `[${i}] ${uc.name}${uc.description ? `: ${uc.description}` : ""}`)
    .join("\n");

  let mapped = 0;

  // Batch in groups of 50 to stay within token limits
  const BATCH = 50;
  for (let offset = 0; offset < unmappedTickets.length; offset += BATCH) {
    const batch = unmappedTickets.slice(offset, offset + BATCH);

    const ticketLines = batch
      .map((t) => {
        const meta: string[] = [];
        if (t.epicName) meta.push(`epic: ${t.epicName}`);
        if (t.labels.length) meta.push(`labels: ${t.labels.join(", ")}`);
        if (t.components.length) meta.push(`components: ${t.components.join(", ")}`);
        return `${t.jiraKey}: ${t.summary}${meta.length ? ` (${meta.join("; ")})` : ""}`;
      })
      .join("\n");

    const completion = await ai.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Map each Jira ticket to the most relevant use case by index. Use -1 if no use case fits.
Return JSON: {"mappings": [{"key": "PROJ-1", "useCaseIndex": 0}, ...]}`,
        },
        {
          role: "user",
          content: `Use cases:\n${ucList}\n\nTickets to map:\n${ticketLines}`,
        },
      ],
      temperature: 0.1,
    });

    const raw = completion.choices[0].message.content ?? "{}";
    const result = JSON.parse(raw) as { mappings: Array<{ key: string; useCaseIndex: number }> };
    const keyToTicket = new Map(batch.map((t) => [t.jiraKey, t]));

    for (const m of result.mappings ?? []) {
      if (m.useCaseIndex < 0 || m.useCaseIndex >= useCases.length) continue;
      const ticket = keyToTicket.get(m.key);
      if (!ticket) continue;
      const uc = useCases[m.useCaseIndex];
      await prisma.ticketUseCaseMapping.upsert({
        where: { ticketId_useCaseId: { ticketId: ticket.id, useCaseId: uc.id } },
        create: { ticketId: ticket.id, useCaseId: uc.id, source: "AUTOMATIC", confidence: 0.8 },
        update: { source: "AUTOMATIC", confidence: 0.8 },
      });
      mapped++;
    }
  }

  return { mapped, skipped };
}
