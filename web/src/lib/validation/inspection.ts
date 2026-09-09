import { z } from "zod";

export const gpsSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).optional(),
  capturedAt: z.string().datetime().optional(),
});

export const inspectionSchema = z.object({
  plotId: z.string().uuid(),
  approvalId: z.string().uuid().nullable().optional(),
  inspectionType: z.enum(["ROUTINE", "FOLLOW_UP", "COMPLIANCE"]).default("ROUTINE"),
  constructionStage: z.string().max(100).optional(),
  observedFloors: z.number().int().min(0).max(100).optional(),
  observedUnits: z.number().int().min(0).max(1000).optional(),
  observations: z.string().max(5000).optional(),
  recommendations: z.string().max(5000).optional(),
  complianceStatus: z.enum(["COMPLIANT", "MINOR_NON_COMPLIANT", "MAJOR_NON_COMPLIANT", "UNABLE_TO_DETERMINE"]).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  gpsAccuracy: z.number().min(0).optional(),
});

export type InspectionInput = z.infer<typeof inspectionSchema>;
