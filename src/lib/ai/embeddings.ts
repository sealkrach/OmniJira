import { prisma } from "@/lib/db";
import { getOpenAI } from "@/lib/ai/openai";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIM = 1536;

export async function generateEmbedding(text: string): Promise<number[]> {
  const { client } = await getOpenAI();
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8191),
  });
  return response.data[0].embedding;
}

async function ensureVectorColumn(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'JiraTicket' AND column_name = 'embedding'
      ) THEN
        ALTER TABLE "JiraTicket" ADD COLUMN embedding vector(${EMBEDDING_DIM});
        CREATE INDEX ON "JiraTicket" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
      END IF;
    END
    $$;
  `);
}

export async function generateTicketEmbedding(
  ticketId: string,
  text: string
): Promise<void> {
  const vector = await generateEmbedding(text);
  const vectorLiteral = `[${vector.join(",")}]`;
  await prisma.$executeRawUnsafe(
    `UPDATE "JiraTicket" SET embedding = $1::vector WHERE id = $2`,
    vectorLiteral,
    ticketId
  );
}

interface TicketResult {
  id: string;
  jiraKey: string;
  summary: string;
  status: string;
  issueType: string;
  assignee: string | null;
  priority: string | null;
  epicName: string | null;
  similarity?: number;
}

export async function searchSimilarTickets(
  query: string,
  limit = 8
): Promise<TicketResult[]> {
  try {
    await ensureVectorColumn();
    const vector = await generateEmbedding(query);
    const vectorLiteral = `[${vector.join(",")}]`;

    const rows = await prisma.$queryRawUnsafe<TicketResult[]>(
      `SELECT id, "jiraKey", summary, status, "issueType", assignee, priority, "epicName",
              1 - (embedding <=> $1::vector) AS similarity
       FROM "JiraTicket"
       WHERE embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      vectorLiteral,
      limit
    );

    if (rows.length > 0) return rows;
  } catch {
    // pgvector not available — fall through to keyword search
  }

  return keywordSearchTickets(query, limit);
}

async function keywordSearchTickets(
  query: string,
  limit: number
): Promise<TicketResult[]> {
  const tickets = await prisma.jiraTicket.findMany({
    where: {
      OR: [
        { summary: { contains: query, mode: "insensitive" } },
        { epicName: { contains: query, mode: "insensitive" } },
        { labels: { has: query } },
      ],
    },
    take: limit,
    select: {
      id: true,
      jiraKey: true,
      summary: true,
      status: true,
      issueType: true,
      assignee: true,
      priority: true,
      epicName: true,
    },
  });
  return tickets;
}

export async function generatePendingEmbeddings(batchSize = 20): Promise<number> {
  try {
    await ensureVectorColumn();

    const tickets = await prisma.$queryRawUnsafe<{ id: string; summary: string; epicName: string | null }[]>(
      `SELECT id, summary, "epicName" FROM "JiraTicket" WHERE embedding IS NULL LIMIT $1`,
      batchSize
    );

    if (tickets.length === 0) return 0;

    for (const ticket of tickets) {
      const text = [ticket.summary, ticket.epicName].filter(Boolean).join(" — ");
      await generateTicketEmbedding(ticket.id, text);
    }

    return tickets.length;
  } catch {
    return 0;
  }
}
