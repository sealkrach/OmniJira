export type RagStatus = "GREEN" | "AMBER" | "RED";

export interface UseCaseProgress {
  useCaseId: string;
  name: string;
  level: string;
  entityId: string;
  targetQuarter: number | null;
  targetYear: number | null;
  statusOverride: RagStatus | null;
  doneCount: number;
  totalCount: number;
  donePoints: number;
  totalPoints: number;
  progress: number;
  rag: RagStatus;
  children?: UseCaseProgress[];
}

export interface EntityProgress {
  entityId: string;
  entityName: string;
  entityColor: string;
  doneCount: number;
  totalCount: number;
  progress: number;
  rag: RagStatus;
  useCases: UseCaseProgress[];
}
