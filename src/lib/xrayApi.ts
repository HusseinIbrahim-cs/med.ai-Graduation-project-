import { Client } from "@gradio/client";

const SPACE = "AhmedElwhaiby/med-ai-xray";

export interface DiseaseResult {
  label: string;
  confidence: number;
}

export interface XrayPrediction {
  topDisease: string;
  findings: DiseaseResult[];
}

export async function analyzeXray(imageFile: File): Promise<XrayPrediction> {
  const client = await Client.connect(SPACE);
  const result = await client.predict("/predict", { image: imageFile });
  const output = (result as { data: unknown[] }).data[0] as {
    label: string;
    confidences: { label: string; confidence: number }[];
  };
  const sorted = [...output.confidences].sort((a, b) => b.confidence - a.confidence);
  return { topDisease: output.label, findings: sorted };
}
