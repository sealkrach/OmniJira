import type OpenAI from "openai";
import { prisma } from "@/lib/db";
import { searchSimilarTickets } from "@/lib/ai/embeddings";

// ─── Tool definitions ────────────────────────────────────────────────────────

export const agentTools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_tickets",
      description:
        "Recherche des tickets Jira par texte (recherche sémantique ou mots-clés). Utiliser pour trouver des tickets liés à un sujet, une fonctionnalité, un statut ou une assignation.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "La requête de recherche en texte libre" },
          limit: { type: "number", description: "Nombre max de résultats (défaut: 8)", default: 8 },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_dashboard_kpis",
      description:
        "Retourne les KPIs principaux du dashboard : total tickets, use cases, taux de mapping, story points.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_rag_summary",
      description:
        "Retourne la synthèse du statut RAG (Rouge/Amber/Vert) des use cases, avec comptages et pourcentages.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_entity_progress",
      description:
        "Retourne la liste des entités métier avec leur progression (tickets complétés vs total) et statut RAG.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_use_case_details",
      description:
        "Recherche des use cases par nom ou ID et retourne leurs détails (statut, progression, tickets liés).",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nom partiel ou complet du use case" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_sync_status",
      description:
        "Retourne le statut des dernières synchronisations Jira (succès, erreurs, timestamps).",
      parameters: { type: "object", properties: {} },
    },
  },
];

// ─── Tool executors ──────────────────────────────────────────────────────────

async function toolSearchTickets(args: { query: string; limit?: number }): Promise<string> {
  const tickets = await searchSimilarTickets(args.query, args.limit ?? 8);
  if (tickets.length === 0) return "Aucun ticket trouvé pour cette recherche.";

  const lines = tickets.map((t) => {
    const parts = [`[${t.jiraKey}] ${t.summary}`, `  Statut: ${t.status}`, `  Type: ${t.issueType}`];
    if (t.assignee) parts.push(`  Assigné à: ${t.assignee}`);
    if (t.priority) parts.push(`  Priorité: ${t.priority}`);
    if (t.epicName) parts.push(`  Épic: ${t.epicName}`);
    return parts.join("\n");
  });

  return `${tickets.length} ticket(s) trouvé(s) :\n\n${lines.join("\n\n")}`;
}

async function toolGetDashboardKpis(): Promise<string> {
  const [totalTickets, totalUseCases, mappedTickets, spResult] = await Promise.all([
    prisma.jiraTicket.count(),
    prisma.useCase.count(),
    prisma.ticketUseCaseMapping.findMany({ select: { ticketId: true }, distinct: ["ticketId"] }),
    prisma.jiraTicket.aggregate({ _sum: { storyPoints: true } }),
  ]);

  const mappingRate = totalTickets > 0 ? ((mappedTickets.length / totalTickets) * 100).toFixed(1) : "0";
  const sp = spResult._sum.storyPoints ?? 0;

  return [
    `Tickets Jira total : ${totalTickets}`,
    `Use cases total : ${totalUseCases}`,
    `Tickets mappés : ${mappedTickets.length} (${mappingRate}%)`,
    `Story points total : ${sp}`,
  ].join("\n");
}

async function toolGetRagSummary(): Promise<string> {
  const useCases = await prisma.useCase.findMany({
    select: { name: true, statusOverride: true, level: true },
  });

  const counts = { GREEN: 0, AMBER: 0, RED: 0, NONE: 0 };
  for (const uc of useCases) {
    if (uc.statusOverride) counts[uc.statusOverride]++;
    else counts.NONE++;
  }

  const total = useCases.length;
  const pct = (n: number) => total > 0 ? `${((n / total) * 100).toFixed(0)}%` : "0%";

  return [
    `Statuts RAG des ${total} use cases :`,
    `  VERT  : ${counts.GREEN} (${pct(counts.GREEN)})`,
    `  AMBER : ${counts.AMBER} (${pct(counts.AMBER)})`,
    `  ROUGE : ${counts.RED} (${pct(counts.RED)})`,
    `  Non défini : ${counts.NONE} (${pct(counts.NONE)})`,
  ].join("\n");
}

async function toolGetEntityProgress(): Promise<string> {
  const entities = await prisma.entity.findMany({
    include: {
      useCases: {
        include: {
          ticketMappings: { include: { ticket: { select: { status: true, storyPoints: true } } } },
        },
      },
    },
    where: { parentId: null },
  });

  if (entities.length === 0) return "Aucune entité trouvée.";

  const lines = entities.map((e) => {
    const allMappings = e.useCases.flatMap((uc) => uc.ticketMappings);
    const totalSP = allMappings.reduce((s, m) => s + (m.ticket.storyPoints ?? 0), 0);
    const doneSP = allMappings
      .filter((m) => ["Done", "Closed", "Resolved"].includes(m.ticket.status))
      .reduce((s, m) => s + (m.ticket.storyPoints ?? 0), 0);
    const pct = totalSP > 0 ? ((doneSP / totalSP) * 100).toFixed(0) : "N/A";

    return `${e.name} : ${e.useCases.length} use cases, ${doneSP}/${totalSP} SP complétés (${pct}%)`;
  });

  return `Progression par entité :\n${lines.join("\n")}`;
}

async function toolGetUseCaseDetails(args: { name: string }): Promise<string> {
  const useCases = await prisma.useCase.findMany({
    where: { name: { contains: args.name, mode: "insensitive" } },
    include: {
      entity: { select: { name: true } },
      ticketMappings: {
        include: { ticket: { select: { jiraKey: true, summary: true, status: true, storyPoints: true } } },
        take: 10,
      },
    },
    take: 5,
  });

  if (useCases.length === 0) return `Aucun use case trouvé pour "${args.name}".`;

  return useCases
    .map((uc) => {
      const tickets = uc.ticketMappings.map(
        (m) => `  - [${m.ticket.jiraKey}] ${m.ticket.summary} (${m.ticket.status})`
      );
      const totalSP = uc.ticketMappings.reduce((s, m) => s + (m.ticket.storyPoints ?? 0), 0);
      const lines = [
        `Use case : ${uc.name}`,
        `  Entité : ${uc.entity.name}`,
        `  Niveau : ${uc.level}`,
        `  Statut RAG : ${uc.statusOverride ?? "calculé automatiquement"}`,
        `  Story points : ${totalSP}`,
        `  Tickets liés (${uc.ticketMappings.length}) :`,
        ...tickets,
      ];
      return lines.join("\n");
    })
    .join("\n\n");
}

async function toolGetSyncStatus(): Promise<string> {
  const jobs = await prisma.syncJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { jiraInstance: { select: { name: true } } },
  });

  if (jobs.length === 0) return "Aucune synchronisation trouvée.";

  const lines = jobs.map((j) => {
    const parts = [`Instance: ${j.jiraInstance.name}`, `  Statut: ${j.status}`];
    if (j.startedAt) parts.push(`  Démarré: ${j.startedAt.toISOString()}`);
    if (j.completedAt) parts.push(`  Terminé: ${j.completedAt.toISOString()}`);
    if (j.ticketsSynced) parts.push(`  Tickets synchro: ${j.ticketsSynced}`);
    if (j.error) parts.push(`  Erreur: ${j.error}`);
    return parts.join("\n");
  });

  return `Dernières synchronisations :\n\n${lines.join("\n\n")}`;
}

export async function executeTool(name: string, argsJson: string): Promise<string> {
  const args = JSON.parse(argsJson || "{}");
  switch (name) {
    case "search_tickets":      return toolSearchTickets(args);
    case "get_dashboard_kpis":  return toolGetDashboardKpis();
    case "get_rag_summary":     return toolGetRagSummary();
    case "get_entity_progress": return toolGetEntityProgress();
    case "get_use_case_details":return toolGetUseCaseDetails(args);
    case "get_sync_status":     return toolGetSyncStatus();
    default: return `Outil inconnu : ${name}`;
  }
}

// ─── Conversation & Memory ───────────────────────────────────────────────────

export async function getOrCreateConversation(userId: string): Promise<string> {
  const existing = await prisma.chatConversation.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) return existing.id;

  const created = await prisma.chatConversation.create({ data: { userId } });
  return created.id;
}

export async function getConversationHistory(
  conversationId: string
): Promise<OpenAI.Chat.ChatCompletionMessageParam[]> {
  const messages = await prisma.chatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  return messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
}

export async function saveMessages(
  conversationId: string,
  userContent: string,
  assistantContent: string
): Promise<void> {
  await prisma.$transaction([
    prisma.chatMessage.create({
      data: { conversationId, role: "user", content: userContent },
    }),
    prisma.chatMessage.create({
      data: { conversationId, role: "assistant", content: assistantContent },
    }),
    prisma.chatConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    }),
  ]);

  const count = await prisma.chatMessage.count({ where: { conversationId } });
  if (count > 0 && count % 10 === 0) {
    summarizeConversation(conversationId).catch(() => {});
  }
}

async function summarizeConversation(conversationId: string): Promise<void> {
  const { getOpenAI: getClient } = await import("@/lib/ai/openai");
  const { client, model } = await getClient();

  const messages = await prisma.chatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 30,
  });

  const transcript = messages.map((m) => `${m.role === "user" ? "Utilisateur" : "Assistant"}: ${m.content}`).join("\n");

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content:
          "Résume en 3-5 phrases les points clés de cette conversation entre un utilisateur et l'assistant OmniJira. Focus sur ce que l'utilisateur cherchait à savoir.",
      },
      { role: "user", content: transcript },
    ],
    max_tokens: 300,
  });

  const summary = response.choices[0]?.message?.content ?? "";
  await prisma.chatConversation.update({
    where: { id: conversationId },
    data: { summary },
  });
}

export async function buildSystemPrompt(userId: string): Promise<string> {
  const [user, memory, conversation] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, role: true } }),
    prisma.userMemory.findUnique({ where: { userId } }),
    prisma.chatConversation.findFirst({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: { summary: true },
    }),
  ]);

  const userName = user?.name ?? user?.email ?? "Utilisateur";
  const role = user?.role ?? "VIEWER";
  const facts = (memory?.facts as string[]) ?? [];
  const summary = conversation?.summary ?? "";

  const parts = [
    `Tu es l'assistant IA d'OmniJira, un dashboard enterprise de suivi de tickets Jira.`,
    `Tu aides ${userName} (rôle: ${role}) à analyser tickets, use cases, entités et KPIs.`,
    `Utilise les outils disponibles pour répondre avec des données réelles et à jour.`,
    `Réponds en français, de manière concise et structurée. Utilise des listes à puces quand c'est approprié.`,
    `Date du jour : ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}.`,
  ];

  if (facts.length > 0) {
    parts.push(`\nContexte mémorisé sur cet utilisateur :\n${facts.map((f) => `- ${f}`).join("\n")}`);
  }

  if (summary) {
    parts.push(`\nRésumé des échanges précédents :\n${summary}`);
  }

  return parts.join("\n");
}

export async function updateUserMemory(userId: string, userMessage: string, assistantResponse: string): Promise<void> {
  const { getOpenAI: getClient } = await import("@/lib/ai/openai");
  const { client, model } = await getClient();

  const existing = await prisma.userMemory.findUnique({ where: { userId } });
  const currentFacts = (existing?.facts as string[]) ?? [];

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content:
          "Analyse cet échange et retourne un tableau JSON de 0 à 2 faits utiles sur l'utilisateur (entités préférées, use cases suivis, sujets récurrents). Ne retourne rien si l'échange ne révèle rien de notable. Format: [\"fait 1\", \"fait 2\"]",
      },
      { role: "user", content: `Utilisateur: ${userMessage}\nAssistant: ${assistantResponse}` },
    ],
    max_tokens: 150,
    response_format: { type: "json_object" },
  });

  let newFacts: string[] = [];
  try {
    const parsed = JSON.parse(response.choices[0]?.message?.content ?? "{}");
    newFacts = Array.isArray(parsed.facts) ? parsed.facts : Array.isArray(parsed) ? parsed : [];
  } catch {
    return;
  }

  if (newFacts.length === 0) return;

  const merged = [...currentFacts, ...newFacts].slice(-20);
  await prisma.userMemory.upsert({
    where: { userId },
    create: { userId, facts: merged },
    update: { facts: merged },
  });
}
