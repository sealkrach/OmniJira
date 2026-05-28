import { requireSession, ok } from "@/lib/api-utils";
import { prisma } from "@/lib/db";

export async function DELETE() {
  const { error } = await requireSession();
  if (error) return error;

  // Delete all automatic mappings first (FK constraint)
  const { count: mappingsDeleted } = await prisma.ticketUseCaseMapping.deleteMany({
    where: { source: "AUTOMATIC" },
  });

  // Delete all use cases (cascade will remove any remaining mappings)
  const { count: useCasesDeleted } = await prisma.useCase.deleteMany({});

  return ok({ useCasesDeleted, mappingsDeleted });
}
