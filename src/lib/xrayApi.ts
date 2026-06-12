import { Client } from "@gradio/client";

const SPACE = "AhmedElwhaiby/med-ai-xray";

export interface DiseaseResult {
  label: string;
  confidence: number;
}

export interface XrayPrediction {
  topDisease: string;
  findings: DiseaseResult[];
  imageUrl?: string;
}

function extractImageUrl(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") {
    if (value.startsWith("data:") || value.startsWith("http") || value.startsWith("blob:")) {
      return value;
    }
    return undefined;
  }
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (typeof v.url === "string") return v.url;
    if (typeof v.path === "string" && v.path.startsWith("http")) return v.path;
    if (typeof v.image === "string") return v.image;
    if (v.image && typeof v.image === "object") return extractImageUrl(v.image);
    if (v.data && typeof v.data === "string") return v.data;
  }
  return undefined;
}

export async function analyzeXray(imageFile: File): Promise<XrayPrediction> {
  const client = await Client.connect(SPACE);
  const result = await client.predict("/predict", { image: imageFile });
  const items = (result as { data: unknown[] }).data;

  // Find the classification payload (with confidences) and the image payload across indices.
  let classification: { label: string; confidences: { label: string; confidence: number }[] } | undefined;
  let imageUrl: string | undefined;

  for (const item of items) {
    if (!item) continue;
    if (typeof item === "object" && "confidences" in (item as object)) {
      classification = item as typeof classification;
      continue;
    }
    const url = extractImageUrl(item);
    if (url && !imageUrl) imageUrl = url;
  }

  if (!classification) throw new Error("Unexpected response from X-ray model");

  const sorted = [...classification.confidences].sort((a, b) => b.confidence - a.confidence);
  return { topDisease: classification.label, findings: sorted, imageUrl };
}
